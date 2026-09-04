import type { UIMessage } from "ai";

/**
 * Run truth shared between the chat route (producer), the cancel/status
 * routes, and the chat panel (consumer). Mirrors agentRunStatusEnum.
 */
export type ChatRunStatus = "running" | "completed" | "failed" | "cancelled";

/**
 * Message metadata streamed to the client via
 * `toUIMessageStreamResponse({ messageMetadata })`. The `start` stream event
 * delivers `{ runId, runStatus: "running" }` immediately (so Stop can target
 * the run), and the `finish` event delivers the terminal run status.
 */
export type ChatRunMetadata = {
  runId: string;
  runStatus: ChatRunStatus;
  runError?: string;
};

export function chatRunMetadataOf(message: UIMessage | undefined): ChatRunMetadata | null {
  const meta = message?.metadata as Partial<ChatRunMetadata> | undefined;
  if (
    !meta ||
    typeof meta.runId !== "string" ||
    typeof meta.runStatus !== "string" ||
    !["running", "completed", "failed", "cancelled"].includes(meta.runStatus)
  ) {
    return null;
  }
  return {
    runId: meta.runId,
    runStatus: meta.runStatus as ChatRunStatus,
    runError: typeof meta.runError === "string" ? meta.runError : undefined,
  };
}

/** Backend truth returned by GET /api/chat/run/[runId] (reconnect primitive). */
export type ChatRunStatusResponse = {
  status: ChatRunStatus;
  error: string | null;
  steps: { name: string; createdAt: string; ok: boolean }[];
};
