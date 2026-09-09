import { APICallError } from "@ai-sdk/provider";
import { InvalidToolInputError, NoSuchToolError } from "ai";
import { describe, expect, it } from "vitest";
import {
  describeStreamError,
  normalizeToolOutput,
  repairWrappedToolCall,
  safeToolResultJson,
  scrubCredentials,
  unwrapWrappedJsonInput,
} from "@/lib/ai/stream-errors";

/**
 * Hermetic tests for the shared stream-error helpers.
 *
 * describeStreamError is the fix for the "Provider stream error" wall: the
 * SDK's stream onError passes an EVENT ({ error }), and the old route code
 * treated the event object as the error itself — so every failure collapsed
 * into the opaque fallback. These tests pin the honest matrix: Error
 * instances, APICallError status prefixes, strings, objects, null, and the
 * credential scrub + rate-limit hint that make the persisted run error
 * actionable.
 */

describe("describeStreamError", () => {
  it("uses the message of a plain Error", () => {
    expect(describeStreamError(new Error("boom"))).toBe("boom");
  });

  it("prefixes APICallError with its HTTP status and appends the rate-limit hint", () => {
    const error = new APICallError({
      message: "rate limit exceeded",
      url: "https://openrouter.ai/api/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 429,
      responseBody: "{}",
      responseHeaders: {},
      isRetryable: true,
    });
    const message = describeStreamError(error);
    expect(message).toContain("HTTP 429: rate limit exceeded");
    expect(message).toContain("non-free model");
  });

  it("passes a string through unchanged", () => {
    expect(describeStreamError("upstream failed")).toBe("upstream failed");
  });

  it("serializes an object error shape into readable text", () => {
    const message = describeStreamError({ code: "limit_rpd", message: "daily cap reached" });
    expect(message).toContain("limit_rpd");
    expect(message).toContain("daily cap reached");
  });

  it("falls back to an honest no-detail message for null/undefined", () => {
    expect(describeStreamError(null)).toBe("Provider stream error (no detail)");
    expect(describeStreamError(undefined)).toBe("Provider stream error (no detail)");
  });

  it("falls back to the no-detail message for an empty Error", () => {
    expect(describeStreamError(new Error(""))).toBe("Provider stream error (no detail)");
  });

  it("redacts credential-shaped content", () => {
    const message = describeStreamError(
      new Error("failed with key sk-abc1234567890 and Bearer tok_12345 via api_key=xyz123"),
    );
    expect(message).not.toContain("sk-abc1234567890");
    expect(message).not.toContain("tok_12345");
    expect(message).not.toContain("xyz123");
    expect(message).toContain("[redacted]");
  });

  it("caps overly long messages", () => {
    const message = describeStreamError(new Error("x".repeat(5000)));
    expect(message.length).toBeLessThanOrEqual(301);
    expect(message.endsWith("…")).toBe(true);
  });

  it("appends the rate-limit hint for timeout-shaped errors", () => {
    const message = describeStreamError(new Error("The operation timed out"));
    expect(message).toContain("timed out");
    expect(message).toContain("non-free model");
  });
});

describe("scrubCredentials", () => {
  it("redacts API-key prefixes, bearer tokens and api_key assignments", () => {
    expect(scrubCredentials("token sk-1234567890ab leaked")).toBe("token [redacted] leaked");
    expect(scrubCredentials("Authorization: Bearer abc.def")).toBe("Authorization: [redacted]");
    expect(scrubCredentials("api_key=zzz top")).toBe("[redacted] top");
  });
});

describe("safeToolResultJson", () => {
  it("round-trips normal values unchanged", () => {
    expect(safeToolResultJson({ ok: true, n: 1 })).toBe('{"ok":true,"n":1}');
  });

  it("converts BigInt values to strings", () => {
    expect(safeToolResultJson({ total: BigInt("9007199254740993") })).toBe('{"total":"9007199254740993"}');
  });

  it("serializes circular values lossily without throwing", () => {
    const loop: Record<string, unknown> = { name: "x" };
    loop.self = loop;
    const json = safeToolResultJson(loop);
    expect(json).toContain('"<circular>"');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("falls back to a note for values that defeat even the lossy walk", () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("nope");
        },
      },
    );
    expect(safeToolResultJson(hostile)).toBe('{"note":"unserializable tool result"}');
  });
});

describe("normalizeToolOutput", () => {
  it("passes normal outputs through untouched", () => {
    const value = { results: [{ id: "a" }] };
    expect(normalizeToolOutput(value)).toBe(value);
  });

  it("truncates oversized strings with a truncated marker", () => {
    const output = normalizeToolOutput<unknown>("a".repeat(30_000)) as {
      truncated: boolean;
      preview: string;
    };
    expect(output.truncated).toBe(true);
    expect(output.preview.length).toBeLessThan(5_000);
  });

  it("truncates oversized arrays with a truncated marker", () => {
    const output = normalizeToolOutput<unknown>(
      Array.from({ length: 1000 }, (_, i) => ({ i, pad: "x".repeat(100) })),
    ) as { truncated: boolean; preview: string };
    expect(output.truncated).toBe(true);
    expect(JSON.stringify(output).length).toBeLessThan(8_000);
  });

  it("replaces circular outputs with a safe representation", () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    const output = normalizeToolOutput<unknown>(loop) as { note: string; preview: string };
    expect(output.note).toContain("cannot be serialized");
    expect(() => JSON.parse(output.preview)).not.toThrow();
  });

  it("replaces BigInt-bearing outputs with a safe representation", () => {
    const output = normalizeToolOutput<unknown>({ total: BigInt("123") }) as {
      note: string;
      preview: string;
    };
    expect(output.note).toContain("cannot be serialized");
    expect(output.preview).toContain('"total":"123"');
    expect(() => JSON.parse(output.preview)).not.toThrow();
  });
});

describe("unwrapWrappedJsonInput", () => {
  it("unwraps an object wrapper", () => {
    expect(unwrapWrappedJsonInput({ json: { topic: "x", platforms: ["facebook"] } })).toEqual({
      topic: "x",
      platforms: ["facebook"],
    });
  });

  it("unwraps a JSON-string wrapper", () => {
    expect(unwrapWrappedJsonInput('{"json":{"topic":"x","platforms":["facebook"]}}')).toEqual({
      topic: "x",
      platforms: ["facebook"],
    });
  });

  it("unwraps a nested string wrapper (stringified payload inside the envelope)", () => {
    expect(unwrapWrappedJsonInput('{"json":"{\\"topic\\":\\"x\\",\\"platforms\\":[\\"facebook\\"]}"}')).toEqual({
      topic: "x",
      platforms: ["facebook"],
    });
  });

  it("passes non-wrapper objects through by reference", () => {
    const input = { topic: "x", platforms: ["facebook"] };
    expect(unwrapWrappedJsonInput(input)).toBe(input);
  });

  it("returns the parsed value for a non-wrapper JSON string", () => {
    expect(unwrapWrappedJsonInput('{"topic":"x"}')).toEqual({ topic: "x" });
  });

  it("passes primitives and unparseable strings through unchanged", () => {
    expect(unwrapWrappedJsonInput(42)).toBe(42);
    expect(unwrapWrappedJsonInput(null)).toBe(null);
    expect(unwrapWrappedJsonInput("not json")).toBe("not json");
    expect(unwrapWrappedJsonInput('{"topic":')).toBe('{"topic":');
    expect(unwrapWrappedJsonInput('"42"')).toBe('"42"');
  });

  it("passes arrays through unchanged", () => {
    const input = ["facebook"];
    expect(unwrapWrappedJsonInput(input)).toBe(input);
  });

  it("passes circular objects through unchanged", () => {
    const loop: Record<string, unknown> = { topic: "x" };
    loop.self = loop;
    expect(unwrapWrappedJsonInput(loop)).toBe(loop);
  });

  it("leaves multi-key objects with a json field alone (ambiguous shape)", () => {
    const input = { json: { topic: "x" }, topic: "y" };
    expect(unwrapWrappedJsonInput(input)).toBe(input);
  });

  it("leaves wrappers with non-object payloads alone", () => {
    expect(unwrapWrappedJsonInput({ json: 42 })).toEqual({ json: 42 });
    expect(unwrapWrappedJsonInput('{"json":42}')).toEqual('{"json":42}');
  });
});

describe("repairWrappedToolCall", () => {
  const invalidInputError = (input: string) =>
    new InvalidToolInputError({
      toolName: "create_content",
      toolInput: input,
      cause: new Error("missing properties: topic, platforms"),
    });

  function repairOptions(
    input: string,
    error: Parameters<typeof repairWrappedToolCall>[0]["error"],
  ): Parameters<typeof repairWrappedToolCall>[0] {
    return {
      system: undefined,
      messages: [],
      toolCall: { type: "tool-call", toolCallId: "call-1", toolName: "create_content", input },
      tools: {},
      inputSchema: () => ({ type: "object" }),
      error,
    };
  }

  it("repairs a wrapped object-form input", async () => {
    const input = '{"json":{"topic":"Juma specials","platforms":["facebook"]}}';
    const repaired = await repairWrappedToolCall(repairOptions(input, invalidInputError(input)));
    expect(repaired).toEqual({
      type: "tool-call",
      toolCallId: "call-1",
      toolName: "create_content",
      input: '{"topic":"Juma specials","platforms":["facebook"]}',
    });
  });

  it("repairs a wrapped string-form input", async () => {
    const input =
      '{"json":"{\\"topic\\":\\"Juma specials\\",\\"platforms\\":[\\"facebook\\"]}"}';
    const repaired = await repairWrappedToolCall(repairOptions(input, invalidInputError(input)));
    expect(repaired).toMatchObject({
      type: "tool-call",
      toolCallId: "call-1",
      toolName: "create_content",
      input: '{"topic":"Juma specials","platforms":["facebook"]}',
    });
  });

  it("declines a non-wrapper input so the original validation error surfaces", async () => {
    const input = '{"topic":"x"}';
    expect(await repairWrappedToolCall(repairOptions(input, invalidInputError(input)))).toBeNull();
  });

  it("declines unparseable input", async () => {
    const input = '{"topic":';
    expect(await repairWrappedToolCall(repairOptions(input, invalidInputError(input)))).toBeNull();
  });

  it("declines errors that are not input-validation failures", async () => {
    const input = '{"json":{"topic":"Juma specials","platforms":["facebook"]}}';
    const repaired = await repairWrappedToolCall(
      repairOptions(input, new NoSuchToolError({ toolName: "create_content", availableTools: [] })),
    );
    expect(repaired).toBeNull();
  });

  it("declines non-string tool-call inputs", async () => {
    const options = {
      ...repairOptions('{"json":{}}', invalidInputError('{"json":{}}')),
      toolCall: {
        type: "tool-call" as const,
        toolCallId: "call-1",
        toolName: "create_content",
        input: { json: {} } as unknown as string,
      },
    };
    expect(await repairWrappedToolCall(options)).toBeNull();
  });
});
