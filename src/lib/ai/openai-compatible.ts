import "server-only";

import {
  APICallError,
  EmptyResponseBodyError,
  UnsupportedFunctionalityError,
  type LanguageModelV2,
  type LanguageModelV2CallOptions,
  type LanguageModelV2Content,
  type LanguageModelV2FinishReason,
  type LanguageModelV2FunctionTool,
  type LanguageModelV2Prompt,
  type LanguageModelV2StreamPart,
  type LanguageModelV2ToolCallPart,
  type LanguageModelV2Usage,
} from "@ai-sdk/provider";
import { convertUint8ArrayToBase64, generateId } from "@ai-sdk/provider-utils";

/**
 * Minimal OpenAI Chat Completions-compatible LanguageModelV2.
 *
 * The repo deliberately ships no `@ai-sdk/openai*` packages, so the
 * `openai-compatible` provider is a small native client built on the
 * public `@ai-sdk/provider` interfaces: it speaks the standard
 * POST /chat/completions REST API (streaming + non-streaming, tools,
 * JSON mode) and works with any OpenAI-compatible endpoint
 * (OpenAI, OpenRouter, Together, Groq, vLLM, LM Studio, ...) via the
 * workspace's own base URL + API key. No third-party code is involved,
 * so BYOK keys never leave the server.
 *
 * Honest limitations surfaced as errors (never silently dropped):
 * - Non-image file attachments (e.g. PDF) are unsupported.
 * - JSON output uses `response_format: json_object`; servers that do not
 *   implement it return a clear API error which propagates unchanged.
 */

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ChatContentPart[] | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

const REQUEST_TIMEOUT_MS = 120_000;

function mapFinishReason(reason: string | null | undefined): LanguageModelV2FinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
      return "tool-calls";
    case "content_filter":
      return "content-filter";
    case null:
    case undefined:
    case "":
      return "unknown";
    default:
      return "other";
  }
}

function filePartToContent(part: {
  type: "file";
  data: Uint8Array | string | URL;
  mediaType: string;
}): ChatContentPart {
  const mt = part.mediaType;
  if (!mt.startsWith("image/")) {
    throw new UnsupportedFunctionalityError({
      functionality: `file attachments of type "${mt}"`,
      message: `The openai-compatible provider does not support ${mt} attachments (only images). Use the Gemini provider for PDF/image files, or attach an image instead.`,
    });
  }
  let url: string;
  if (part.data instanceof URL) {
    url = part.data.toString();
  } else if (typeof part.data === "string") {
    url = part.data.startsWith("data:") ? part.data : `data:${mt};base64,${part.data}`;
  } else {
    url = `data:${mt};base64,${convertUint8ArrayToBase64(part.data)}`;
  }
  return { type: "image_url", image_url: { url } };
}

/** Convert an AI SDK v2 prompt into OpenAI chat message objects. */
function toChatMessages(prompt: LanguageModelV2Prompt): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const msg of prompt) {
    if (msg.role === "system") {
      messages.push({ role: "system", content: msg.content });
      continue;
    }
    if (msg.role === "user") {
      let text = "";
      const parts: ChatContentPart[] = [];
      for (const p of msg.content) {
        if (p.type === "text") text += p.text;
        else if (p.type === "file") parts.push(filePartToContent(p));
      }
      messages.push({
        role: "user",
        content: parts.length > 0 ? [...(text ? [{ type: "text" as const, text }] : []), ...parts] : text,
      });
      continue;
    }
    if (msg.role === "assistant") {
      const text = msg.content
        .filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join("");
      const toolCalls = msg.content
        .filter((p) => p.type === "tool-call")
        .map((p) => {
          const tc = p as unknown as LanguageModelV2ToolCallPart;
          return {
            id: tc.toolCallId,
            type: "function" as const,
            function: { name: tc.toolName, arguments: JSON.stringify(tc.input) },
          };
        });
      const out: ChatMessage = { role: "assistant", content: toolCalls.length > 0 ? text || null : text };
      if (toolCalls.length > 0) out.tool_calls = toolCalls;
      messages.push(out);
      continue;
    }
    if (msg.role === "tool") {
      const part = msg.content[0] as
        | { type: "tool-result"; toolCallId: string; output: { type: "text" | "json"; value: unknown } }
        | undefined;
      if (!part) continue;
      const value = part.output.type === "json" ? JSON.stringify(part.output.value) : String(part.output.value);
      messages.push({ role: "tool", tool_call_id: part.toolCallId, content: value });
    }
  }
  return messages;
}

function buildRequestBody(args: {
  modelId: string;
  messages: ChatMessage[];
  callOptions: LanguageModelV2CallOptions;
  stream: boolean;
}): Record<string, unknown> {
  const o = args.callOptions;
  const body: Record<string, unknown> = {
    model: args.modelId,
    messages: args.messages,
    stream: args.stream,
  };
  if (o.maxOutputTokens != null) body.max_tokens = o.maxOutputTokens;
  if (o.temperature != null) body.temperature = o.temperature;
  if (o.topP != null) body.top_p = o.topP;
  if (o.topK != null) body.top_k = o.topK;
  if (o.presencePenalty != null) body.presence_penalty = o.presencePenalty;
  if (o.frequencyPenalty != null) body.frequency_penalty = o.frequencyPenalty;
  if (o.stopSequences && o.stopSequences.length > 0) body.stop = o.stopSequences;
  if (o.seed != null) body.seed = o.seed;
  const tools = o.tools?.filter((t): t is LanguageModelV2FunctionTool => t.type === "function");
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description ?? "", parameters: t.inputSchema },
    }));
  }
  if (o.toolChoice) {
    if (o.toolChoice.type === "auto") body.tool_choice = "auto";
    else if (o.toolChoice.type === "none") body.tool_choice = "none";
    else if (o.toolChoice.type === "tool") {
      body.tool_choice = { type: "function", function: { name: o.toolChoice.toolName } };
    }
  }
  // JSON mode: schema-aware servers can be targeted later; every
  // OpenAI-compatible server implements json_object at minimum.
  if (o.responseFormat?.type === "json") body.response_format = { type: "json_object" };
  return body;
}

async function throwForHttpError(
  res: Response,
  url: string,
  requestBody: unknown,
): Promise<never> {
  const responseBody = await res.text().catch(() => "");
  let message = `HTTP ${res.status}`;
  try {
    const j = JSON.parse(responseBody) as { error?: { message?: string } };
    if (j?.error?.message) message = j.error.message;
  } catch {
    // keep HTTP status message
  }
  throw new APICallError({
    message,
    url,
    requestBodyValues: requestBody,
    statusCode: res.status,
    responseBody,
    responseHeaders: Object.fromEntries(res.headers.entries()),
    isRetryable: res.status === 429 || res.status >= 500,
  });
}

function readUsage(json: { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }): LanguageModelV2Usage {
  const u = json.usage;
  if (!u) return { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
  return {
    inputTokens: u.prompt_tokens ?? undefined,
    outputTokens: u.completion_tokens ?? undefined,
    totalTokens: u.total_tokens ?? undefined,
  };
}

/**
 * Create an OpenAI-compatible language model for one workspace's config.
 * `baseUrl` defaults to the official OpenAI API when not configured.
 */
export function createOpenAICompatibleModel(opts: {
  modelId: string;
  apiKey: string;
  baseUrl: string | null;
}): LanguageModelV2 {
  const baseUrl = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;
  const authHeaders = { Authorization: `Bearer ${opts.apiKey}` };

  const model: LanguageModelV2 = {
    specificationVersion: "v2",
    provider: "openai-compatible",
    modelId: opts.modelId,
    // No native URL support: the SDK downloads attachments and hands us
    // bytes, which we embed as data URLs.
    supportedUrls: {},

    async doGenerate(callOptions: LanguageModelV2CallOptions) {
      const messages = toChatMessages(callOptions.prompt);
      const requestBody = buildRequestBody({ modelId: opts.modelId, messages, callOptions, stream: false });
      const res = await fetch(url, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json", ...callOptions.headers },
        body: JSON.stringify(requestBody),
        signal: callOptions.abortSignal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) await throwForHttpError(res, url, requestBody);

      const json = (await res.json().catch(() => null)) as
        | {
            id?: string;
            model?: string;
            choices?: {
              message?: { content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] };
              finish_reason?: string;
            }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
          }
        | null;
      if (!json) throw new EmptyResponseBodyError({});

      const choice = json.choices?.[0];
      const content: LanguageModelV2Content[] = [];
      if (choice?.message?.content) content.push({ type: "text", text: choice.message.content });
      for (const tc of choice?.message?.tool_calls ?? []) {
        content.push({
          type: "tool-call",
          toolCallId: tc.id ?? generateId(),
          toolName: tc.function?.name ?? "",
          input: tc.function?.arguments ?? "{}",
        });
      }

      return {
        content,
        finishReason: mapFinishReason(choice?.finish_reason),
        usage: readUsage(json),
        warnings: [],
        request: { body: requestBody },
        response: { id: json.id, modelId: json.model, timestamp: new Date() },
      };
    },

    async doStream(callOptions: LanguageModelV2CallOptions) {
      const messages = toChatMessages(callOptions.prompt);
      const requestBody = buildRequestBody({ modelId: opts.modelId, messages, callOptions, stream: true });
      const res = await fetch(url, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json", ...callOptions.headers },
        body: JSON.stringify(requestBody),
        signal: callOptions.abortSignal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) await throwForHttpError(res, url, requestBody);
      if (!res.body) throw new EmptyResponseBodyError({});

      const stream = parseSseStream(res.body);
      return {
        stream,
        request: { body: requestBody },
        response: { headers: Object.fromEntries(res.headers.entries()) },
      };
    },
  };

  return model;
}

/**
 * Parse an SSE byte stream from /chat/completions into V2 stream parts.
 * Honest terminal behavior: a truncated stream ends with finishReason
 * "error" instead of pretending success.
 */
function parseSseStream(body: ReadableStream<Uint8Array>): ReadableStream<LanguageModelV2StreamPart> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  const textId = generateId();
  let startedText = false;
  const reasoningId = generateId();
  let startedReasoning = false;
  const toolStates = new Map<number, { id: string; name: string; args: string; started: boolean }>();
  let usage: LanguageModelV2Usage = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
  let emittedFinish = false;
  let streamError: string | null = null;

  function push(controller: ReadableStreamDefaultController<LanguageModelV2StreamPart>, part: LanguageModelV2StreamPart) {
    try {
      controller.enqueue(part);
    } catch {
      // controller already closed (client aborted) — stop pushing
    }
  }

  function flushToolStates(controller: ReadableStreamDefaultController<LanguageModelV2StreamPart>) {
    for (const st of toolStates.values()) {
      if (!st.started) {
        push(controller, { type: "tool-input-start", id: st.id, toolName: st.name || "function" });
        if (st.args) push(controller, { type: "tool-input-delta", id: st.id, delta: st.args });
      }
      push(controller, { type: "tool-input-end", id: st.id });
    }
    toolStates.clear();
  }

  return new ReadableStream<LanguageModelV2StreamPart>({
    async start(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            for (const line of rawEvent.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              let chunk: {
                choices?: { delta?: Record<string, unknown>; finish_reason?: string }[];
                usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
              };
              try {
                chunk = JSON.parse(data) as typeof chunk;
              } catch {
                continue;
              }
              const delta = chunk.choices?.[0]?.delta ?? {};

              const reasoning = delta.reasoning_content;
              if (typeof reasoning === "string" && reasoning.length > 0) {
                if (!startedReasoning) {
                  push(controller, { type: "reasoning-start", id: reasoningId });
                  startedReasoning = true;
                }
                push(controller, { type: "reasoning-delta", id: reasoningId, delta: reasoning });
              }

              const textDelta = delta.content;
              if (typeof textDelta === "string" && textDelta.length > 0) {
                if (!startedText) {
                  push(controller, { type: "text-start", id: textId });
                  startedText = true;
                }
                push(controller, { type: "text-delta", id: textId, delta: textDelta });
              }

              const rawToolCalls = delta.tool_calls as
                | { index?: number; id?: string; function?: { name?: string; arguments?: string } }[]
                | undefined;
              if (Array.isArray(rawToolCalls)) {
                for (const tc of rawToolCalls) {
                  const idx = tc.index ?? 0;
                  let st = toolStates.get(idx);
                  if (!st) {
                    st = { id: tc.id ?? generateId(), name: "", args: "", started: false };
                    toolStates.set(idx, st);
                  }
                  if (tc.id) st.id = tc.id;
                  if (st.started) {
                    if (tc.function?.arguments) {
                      push(controller, { type: "tool-input-delta", id: st.id, delta: tc.function.arguments });
                    }
                  } else if (tc.function?.name) {
                    st.name = tc.function.name;
                    push(controller, { type: "tool-input-start", id: st.id, toolName: st.name });
                    st.started = true;
                    if (st.args) {
                      push(controller, { type: "tool-input-delta", id: st.id, delta: st.args });
                      st.args = "";
                    }
                    if (tc.function.arguments) {
                      push(controller, { type: "tool-input-delta", id: st.id, delta: tc.function.arguments });
                    }
                  } else if (tc.function?.arguments) {
                    // arguments arrived before the tool name — buffer until start
                    st.args += tc.function.arguments;
                  }
                }
              }

              const fr = chunk.choices?.[0]?.finish_reason;
              if (fr) {
                if (chunk.usage) usage = readUsage({ usage: chunk.usage });
                flushToolStates(controller);
                if (startedReasoning) push(controller, { type: "reasoning-end", id: reasoningId });
                if (startedText) push(controller, { type: "text-end", id: textId });
                push(controller, { type: "finish", finishReason: mapFinishReason(fr), usage });
                emittedFinish = true;
                break;
              }
            }
            if (emittedFinish) break;
          }
          if (emittedFinish) break;
        }
        // Stream ended without a finish part (truncated / server closed early).
        if (!emittedFinish) {
          streamError = "Provider stream ended unexpectedly (no finish_reason received).";
          push(controller, { type: "error", error: streamError });
          flushToolStates(controller);
          if (startedReasoning) push(controller, { type: "reasoning-end", id: reasoningId });
          if (startedText) push(controller, { type: "text-end", id: textId });
          push(controller, { type: "finish", finishReason: "error", usage });
        }
        controller.close();
      } catch (error) {
        streamError = error instanceof Error ? error.message : "Provider stream error";
        try {
          push(controller, { type: "error", error: streamError });
          push(controller, { type: "finish", finishReason: "error", usage });
        } catch {
          // already closed
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    },
    cancel() {
      void reader.cancel().catch(() => undefined);
    },
  });
}
