"use client";

import { useEffect } from "react";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "QURTIZ AI";

/**
 * Root error boundary: shown when any route crashes during render or an
 * action throws. Retry re-runs the route; the error is logged for diagnosis.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {APP_NAME} hit an unexpected error. Your data is safe — try again, and if the problem
        persists, check your configuration.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try again
      </button>
    </main>
  );
}
