import { Loader2 } from "lucide-react";

/** Root route-loading state: matches the app's existing Loader2 spinner pattern. */
export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </main>
  );
}
