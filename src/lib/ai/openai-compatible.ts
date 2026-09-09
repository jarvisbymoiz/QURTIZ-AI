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
import { safeToolResultJson, unwrapWrappedJsonInput } from "./stream-errors";

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
 *   implement it return a clear API error which propagates unchanged. Since
 *   json_object mode additionally requires the word "json" in the messages,
 *   a minimal "Respond with JSON." system message is appended when the
 *   prompt does not already mention JSON (never mutating the caller's
 *   prompt), so OpenAI/gpt-oss/OpenRouter-compatible endpoints never reject
 *   the request for the missing token.
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

/**
 * Normalize a tool call's raw accumulated `arguments` text before it becomes
 * the terminal `tool-call` part input: models occasionally wrap their JSON in
 * a `{"json": {...}}` envelope, which the SDK's schema validation then
 * rejects (missing properties + additionalProperties 'json'). Unwrap it here
 * as defense-in-depth alongside the streamText repair hook, so the part the
 * SDK receives is already normalized.
 *
 * The input MUST remain a STRING: the SDK's parseToolCall runs
 * `toolCall.input.trim()` and `safeParseJSON({ text })` on it
 * (node_modules/ai/dist/index.js parse-tool-call.ts) — the `unknown` in
 * LanguageModelV2ToolCallPart is permissive, but the runtime implementation
 * is string-only, and an object here would break tool execution. Values
 * without a wrapper are returned byte-identical (the raw string is kept),
 * and malformed JSON stays raw so validation fails honestly.
 */
function normalizeToolCallArguments(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const unwrapped = unwrapWrappedJsonInput(parsed);
    if (unwrapped !== parsed) {
      const json = JSON.stringify(unwrapped);
      if (typeof json === "string") return json;
    }
  } catch {
    // not JSON — keep the raw string, validation fails honestly
  }
  return raw;
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
            // Safe serialization: never let an exotic input value throw out
            // of doStream and kill the whole agent stream.
            function: { name: tc.toolName, arguments: safeToolResultJson(tc.input) },
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
      // Safe serialization for json outputs (BigInt/circular values must
      // degrade to a parseable string, never throw inside doStream); text
      // outputs stay stringified as before.
      const value =
        part.output.type === "json" ? safeToolResultJson(part.output.value) : String(part.output.value);
      messages.push({ role: "tool", tool_call_id: part.toolCallId, content: value });
    }
  }
  return messages;
}

/** True when a message's visible text already mentions JSON (case-insensitive). */
function messageMentionsJson(msg: ChatMessage): boolean {
  if (typeof msg.content === "string") return msg.content.toLowerCase().includes("json");
  if (Array.isArray(msg.content)) {
    return msg.content.some((part) => part.type === "text" && part.text.toLowerCase().includes("json"));
  }
  return false;
}

/**
 * OpenAI-compatible servers reject `response_format: { type: "json_object" }`
 * with HTTP 400 unless the word "json" appears somewhere in the messages
 * ("'messages' must contain the word 'json' in some form...") — OpenAI,
 * OpenRouter and gpt-oss all enforce this. `generateObject` prompts may
 * legitimately never mention JSON (the schema is only conveyed via prompt
 * injection for generic providers), so append a minimal system hint when the
 * token is missing. A fresh array is returned; the caller's messages are
 * never mutated, and already-satisfied prompts are left byte-identical.
 */
function ensureJsonTokenPresent(messages: ChatMessage[]): ChatMessage[] {
  if (messages.some(messageMentionsJson)) return messages;
  return [...messages, { role: "system", content: "Respond with JSON." }];
}

function buildRequestBody(args: {
  modelId: string;
  messages: ChatMessage[];
  callOptions: LanguageModelV2CallOptions;
  stream: boolean;
}): Record<string, unknown> {
  const o = args.callOptions;
  const messages =
    o.responseFormat?.type === "json" ? ensureJsonTokenPresent(args.messages) : args.messages;
  const body: Record<string, unknown> = {
    model: args.modelId,
    messages,
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
  // OpenAI-compatible server implements json_object at minimum, and the
  // required "json" token in the messages is guaranteed above
  // (ensureJsonTokenPresent) so the request is never rejected for its
  // absence. json_schema mode is deliberately not used: the SDK does pass
  // a schema through responseFormat.schema, but many compatible endpoints
  // (vLLM, LM Studio, older Groq/Together) only implement json_object, and
  // this provider must not branch per model.
  if (o.responseFormat?.type === "json") body.response_format = { type: "json_object" };
  if (args.stream) {
    // Standard OpenAI field that makes the server report token usage in the
    // final stream chunk (OpenAI, OpenRouter, vLLM, Groq, ... all support
    // it). Without it usage — and therefore cost bookkeeping — stays null.
    body.stream_options = { include_usage: true };
  }
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
          input: normalizeToolCallArguments(tc.function?.arguments ?? "{}"),
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
 * "error" instead of pretending success, and a mid-stream provider error
 * chunk (`{"error": {"message", "code"}}` — how OpenRouter reports 429s and
 * upstream drops mid-stream) becomes an error part + finish(error) instead
 * of being silently ignored.
 *
 * Tool calls: tool-input-start/delta are streamed for the UI, and a terminal
 * `tool-call` part (with the accumulated arguments) is emitted for every tool
 * state before the finish part. The terminal tool-call part is what tells
 * streamText to actually EXECUTE the tool — without it the call dangles as a
 * UI-only "input-streaming" fragment, no tool ever runs, and the run still
 * finishes "completed" (the exact bug that froze chat tool parts and produced
 * false "interrupted" states for every openai-compatible provider).
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
  let finishReason: string | null = null;
  let sawDone = false;
  let streamError: string | null = null;
  let terminatedByError = false;

  function push(controller: ReadableStreamDefaultController<LanguageModelV2StreamPart>, part: LanguageModelV2StreamPart) {
    try {
      controller.enqueue(part);
    } catch {
      // controller already closed (client aborted) — stop pushing
    }
  }

  /**
   * Close every open tool state: end the streamed input and emit the
   * terminal `tool-call` part so the SDK executes the tool. Partial/malformed
   * arguments stay honest — streamText flags them as an invalid tool call and
   * feeds the error back to the model instead of executing them.
   */
  function flushToolStates(controller: ReadableStreamDefaultController<LanguageModelV2StreamPart>) {
    for (const st of toolStates.values()) {
      if (!st.started) {
        push(controller, { type: "tool-input-start", id: st.id, toolName: st.name || "function" });
        if (st.args) push(controller, { type: "tool-input-delta", id: st.id, delta: st.args });
      }
      push(controller, { type: "tool-input-end", id: st.id });
      push(controller, {
        type: "tool-call",
        toolCallId: st.id,
        toolName: st.name || "function",
        // Normalized (wrapped `{"json": ...}` payloads unwrapped) while the
        // tool-input-delta display parts above keep the RAW text unchanged.
        input: normalizeToolCallArguments(st.args || "{}"),
      });
    }
    toolStates.clear();
  }

  function pushTerminal(controller: ReadableStreamDefaultController<LanguageModelV2StreamPart>) {
    flushToolStates(controller);
    if (startedReasoning) push(controller, { type: "reasoning-end", id: reasoningId });
    if (startedText) push(controller, { type: "text-end", id: textId });
    if (finishReason !== null) {
      push(controller, { type: "finish", finishReason: mapFinishReason(finishReason), usage });
    } else {
      // Stream ended without a finish_reason (truncated / server closed early).
      streamError = "Provider stream ended unexpectedly (no finish_reason received).";
      push(controller, { type: "error", error: streamError });
      push(controller, { type: "finish", finishReason: "error", usage });
    }
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
              if (data === "[DONE]") {
                sawDone = true;
                break;
              }
              if (!data) continue;
              let chunk: {
                choices?: { delta?: Record<string, unknown>; finish_reason?: string }[];
                usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
                error?: { message?: string; code?: string | number } | string | null;
              };
              try {
                chunk = JSON.parse(data) as typeof chunk;
              } catch {
                continue;
              }

              // Mid-stream provider error (OpenRouter shape:
              // data: {"error": {"message": ..., "code": ...}}). Surface it
              // honestly instead of silently swallowing the chunk and ending
              // with a bogus finish reason — and never wait for [DONE] after
              // an error chunk.
              const chunkError = chunk.error;
              if (chunkError != null) {
                let detail: string;
                let code: string | null = null;
                if (typeof chunkError === "string") {
                  detail = chunkError;
                } else if (typeof chunkError === "object") {
                  const err = chunkError as { message?: unknown; code?: unknown };
                  code = err.code == null ? null : String(err.code);
                  detail =
                    typeof err.message === "string" && err.message.length > 0
                      ? err.message
                      : "Provider stream error (no detail)";
                } else {
                  detail = "Provider stream error (no detail)";
                }
                streamError = code ? `${detail} (code: ${code})` : detail;
                push(controller, { type: "error", error: streamError });
                push(controller, { type: "finish", finishReason: "error", usage });
                terminatedByError = true;
                void reader.cancel().catch(() => undefined);
                break;
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
                      st.args += tc.function.arguments;
                      push(controller, { type: "tool-input-delta", id: st.id, delta: tc.function.arguments });
                    }
                  } else if (tc.function?.name) {
                    st.name = tc.function.name;
                    push(controller, { type: "tool-input-start", id: st.id, toolName: st.name });
                    st.started = true;
                    if (tc.function.arguments) {
                      st.args += tc.function.arguments;
                      push(controller, { type: "tool-input-delta", id: st.id, delta: tc.function.arguments });
                    }
                  } else if (tc.function?.arguments) {
                    // arguments arrived before the tool name — buffer until start
                    st.args += tc.function.arguments;
                  }
                }
              }

              const fr = chunk.choices?.[0]?.finish_reason;
              if (fr && finishReason === null) finishReason = fr;
              // Usage can arrive with the finish chunk, or (with
              // stream_options.include_usage) in a trailing usage-only chunk
              // after it — keep reading until [DONE] / end of stream.
              if (chunk.usage) usage = readUsage({ usage: chunk.usage });
            }
            if (sawDone || terminatedByError) break;
          }
          if (sawDone || terminatedByError) break;
        }
        // After a provider error chunk the error + finish(error) parts are
        // already on the wire — pushTerminal must not add a second finish.
        if (!terminatedByError) pushTerminal(controller);
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
