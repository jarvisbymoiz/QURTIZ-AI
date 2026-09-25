/**
 * Runs once when the Next.js server process starts.
 * Boots the pg-boss queue and registers background workers.
 *
 * NOTE: Node-specific imports live in ./instrumentation.node so Next.js's
 * Edge runtime compiler does not bundle native binaries into edge targets.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation.node");
    registerNode();
  }
}
