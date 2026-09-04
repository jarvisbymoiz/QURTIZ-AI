import "server-only";

/**
 * Module-level registry of in-flight chat runs for real cancellation.
 *
 * The chat route registers an AbortController per run; POST /api/chat/cancel
 * aborts it, which trips the same abortSignal streamText is listening on
 * (combined with the 600s safety timeout via AbortSignal.any). Entries are
 * removed when the run finishes — aborting an unknown runId is a no-op, which
 * makes cancel idempotent.
 *
 * Single-process by design (Batch 1): a run started on another server
 * instance cannot be aborted here; the run-status endpoint is the recovery
 * primitive for that case (full cross-instance resume is Batch 2).
 */
const activeRuns = new Map<string, AbortController>();

export function registerRunController(runId: string, controller: AbortController): void {
  activeRuns.set(runId, controller);
}

export function unregisterRunController(runId: string): void {
  activeRuns.delete(runId);
}

/** Abort the run's controller if it is still in flight. Returns true when aborted. */
export function abortRun(runId: string): boolean {
  const controller = activeRuns.get(runId);
  if (!controller) return false;
  activeRuns.delete(runId);
  controller.abort();
  return true;
}

/**
 * Whether the run is still registered (in flight and not user-cancelled —
 * the cancel route removes the entry before aborting). Used to distinguish
 * a user cancel from the 600s safety-cap timeout in onAbort.
 */
export function isRunRegistered(runId: string): boolean {
  return activeRuns.has(runId);
}
