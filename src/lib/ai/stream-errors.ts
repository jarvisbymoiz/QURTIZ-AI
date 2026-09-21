import { APICallError } from "@ai-sdk/provider";
import { InvalidToolInputError } from "ai";
import { parseRateLimitError, rateLimitHint, type RateLimitInfo } from "./provider";

const RATE_LIMIT_HINT =
  " (Rate limit reached — consider switching to a non-free model or increasing retry backoff if rate limits persist).";

const CREDENTIAL_REGEXES = [
  /sk-[a-zA-Z0-9_-]{10,}/g,
  /Bearer\s+[a-zA-Z0-9._\-~+/]+=*/gi,
  /api_key=[a-zA-Z0-9._\-~+/]+/gi,
  /AIza[0-9A-Za-z-_]{35}/g,
];

export function scrubCredentials(text: string): string {
  if (!text) return "";
  let out = String(text);
  for (const regex of CREDENTIAL_REGEXES) {
    out = out.replace(regex, (match) => {
      if (match.toLowerCase().startsWith("authorization: bearer")) {
        return "Authorization: [redacted]";
      }
      if (match.toLowerCase().startsWith("api_key=")) {
        return "[redacted]";
      }
      return "[redacted]";
    });
  }
  return out;
}

export function appendRateLimitHint(message: string): string {
  if (!message) return "";
  const lower = message.toLowerCase();
  if (
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("timed out") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted")
  ) {
    if (!message.includes("non-free model")) {
      return `${message}${RATE_LIMIT_HINT}`;
    }
  }
  return message;
}

export function capMessage(message: string, max = 300): string {
  if (!message) return "";
  const s = String(message).trim();
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export function describeStreamError(error: unknown): string {
  if (error === null || error === undefined) {
    return "Provider stream error (no detail)";
  }

  let message = "";

  if (APICallError.isInstance(error)) {
    const statusPrefix = error.statusCode ? `HTTP ${error.statusCode}: ` : "";
    message = `${statusPrefix}${error.message}`;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object") {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  } else {
    message = String(error);
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return "Provider stream error (no detail)";
  }

  const scrubbed = scrubCredentials(trimmed);

  // TPD/RPD/quota errors get a precise, actionable hint instead of the
  // generic "switch to a non-free model" — the user deserves to know
  // whether retrying in 30 seconds will help (no) or whether they need to
  // pick a different model right now (yes).
  const info = parseRateLimitError(error);
  if (isClassifiedRateLimit(info)) {
    return capMessage(rateLimitHint(info), 300);
  }

  const hinted = appendRateLimitHint(scrubbed);
  return capMessage(hinted, 300);
}

function isClassifiedRateLimit(info: RateLimitInfo): boolean {
  return info.kind === "tpd" || info.kind === "rpd" || info.kind === "quota";
}

export function safeToolResultJson(value: unknown): string {
  if (value === undefined) return "{}";
  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") return val.toString();
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "<circular>";
        seen.add(val);
      }
      return val;
    });
  } catch {
    return '{"note":"unserializable tool result"}';
  }
}

export function normalizeToolOutput<T>(output: T): unknown {
  if (output === null || output === undefined) return output;

  if (typeof output === "string") {
    if (output.length > 5_000) {
      return {
        truncated: true,
        preview: output.slice(0, 4_000),
      };
    }
    return output;
  }

  if (Array.isArray(output)) {
    if (output.length > 200) {
      return {
        truncated: true,
        preview: output.slice(0, 20),
      };
    }
    return output;
  }

  if (typeof output === "object") {
    try {
      const seen = new WeakSet();
      let hasBigInt = false;
      let hasCircular = false;

      const serialized = JSON.stringify(output, (_key, val) => {
        if (typeof val === "bigint") {
          hasBigInt = true;
          return val.toString();
        }
        if (typeof val === "object" && val !== null) {
          if (seen.has(val)) {
            hasCircular = true;
            return "<circular>";
          }
          seen.add(val);
        }
        return val;
      });

      if (hasCircular || hasBigInt) {
        return {
          note: "Output contained complex types and cannot be serialized directly.",
          preview: serialized,
        };
      }
    } catch {
      return {
        note: "Output contained complex types and cannot be serialized directly.",
        preview: safeToolResultJson(output),
      };
    }
  }

  return output;
}

export function unwrapWrappedJsonInput(input: unknown): unknown {
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (
          "json" in parsed &&
          Object.keys(parsed).length === 1
        ) {
          const inner = (parsed as { json: unknown }).json;
          if (inner && typeof inner === "object" && !Array.isArray(inner)) {
            return inner;
          }
          if (typeof inner === "string") {
            try {
              const nested = JSON.parse(inner);
              if (nested && typeof nested === "object" && !Array.isArray(nested)) {
                return nested;
              }
            } catch {
              // keep as is
            }
          }
          return input;
        }
        return parsed;
      }
      return input;
    } catch {
      return input;
    }
  }

  if (input && typeof input === "object" && !Array.isArray(input)) {
    if ("json" in input && Object.keys(input).length === 1) {
      const inner = (input as { json: unknown }).json;
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        return inner;
      }
      if (typeof inner === "string") {
        try {
          const nested = JSON.parse(inner);
          if (nested && typeof nested === "object" && !Array.isArray(nested)) {
            return nested;
          }
        } catch {
          // keep as is
        }
      }
    }
  }

  return input;
}

export async function repairWrappedToolCall(options: {
  toolCall: { type: "tool-call"; toolCallId: string; toolName: string; input: unknown };
  error: unknown;
  system?: unknown;
  messages?: unknown;
  tools?: unknown;
  inputSchema?: unknown;
}): Promise<{ type: "tool-call"; toolCallId: string; toolName: string; input: string } | null> {
  const isInputError =
    options.error instanceof InvalidToolInputError ||
    (options.error &&
      typeof options.error === "object" &&
      (options.error as { name?: string }).name === "InvalidToolInputError");

  if (!isInputError) {
    return null;
  }

  if (typeof options.toolCall.input !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(options.toolCall.input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    if (!("json" in parsed) || Object.keys(parsed).length !== 1) {
      return null;
    }
    const inner = (parsed as { json: unknown }).json;
    if (typeof inner !== "object" && typeof inner !== "string") {
      return null;
    }
    if (inner === null) {
      return null;
    }
    if (typeof inner === "string") {
      const nested = JSON.parse(inner);
      if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
        return null;
      }
    }
  } catch {
    return null;
  }

  const unwrapped = unwrapWrappedJsonInput(options.toolCall.input);
  if (unwrapped === options.toolCall.input) {
    return null;
  }

  return {
    type: "tool-call",
    toolCallId: options.toolCall.toolCallId,
    toolName: options.toolCall.toolName,
    input: typeof unwrapped === "string" ? unwrapped : JSON.stringify(unwrapped),
  };
}
