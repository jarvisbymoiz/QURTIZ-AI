"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Server, ShieldAlert } from "lucide-react";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "QURTIZ AI";

type HealthReport = {
  status: string;
  environment?: string;
  env?: {
    configured: Record<string, boolean>;
    missing: string[];
  };
  database?: {
    connected: boolean;
    error: string | null;
    schemaStatus: string;
    tablesFound: string[];
    tablesMissing: string[];
  };
  quickFix?: string;
};

/**
 * Root error boundary: shown when any route crashes during render or an
 * action throws. Enhanced with automated health diagnostics so developers
 * and operators can immediately identify missing env vars, database connection
 * issues, or unmigrated Supabase schemas on Vercel.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    console.error("[QURTIZ AI App Error]:", error);

    let active = true;
    async function runCheck() {
      try {
        setCheckingHealth(true);
        const res = await fetch("/api/health");
        const data = await res.json();
        if (active) setHealth(data);
      } catch (e) {
        if (active) {
          setHealth({
            status: "error",
            quickFix: "Could not reach health check endpoint: " + String(e),
          });
        }
      } finally {
        if (active) setCheckingHealth(false);
      }
    }

    void runCheck();
    return () => {
      active = false;
    };
  }, [error]);

  const hasDbIssue =
    health?.database && (!health.database.connected || health.database.schemaStatus === "tables_missing");
  const hasMissingEnv = health?.env?.missing && health.env.missing.length > 0;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-sm">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            {APP_NAME} hit an unexpected error. Your data is safe — try again, or check the
            system diagnosis below to resolve any deployment configuration issues.
          </p>
        </div>

        {/* Automated Vercel / Supabase Diagnostics Banner */}
        {health && (hasDbIssue || hasMissingEnv) && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-left shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="space-y-2 text-xs">
                <p className="font-semibold text-destructive">
                  Configuration issue detected on your deployment:
                </p>
                {hasMissingEnv && (
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">Missing Vercel Environment Variables:</strong>{" "}
                    {health.env?.missing.join(", ")}
                  </p>
                )}
                {health.database?.error && (
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">Database Connection Error:</strong>{" "}
                    {health.database.error}
                  </p>
                )}
                {health.database?.schemaStatus === "tables_missing" && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">
                      <strong className="text-foreground">Database Schema Missing:</strong> The database is
                      connected, but required tables ({health.database.tablesMissing.slice(0, 3).join(", ")}
                      ...) were not found.
                    </p>
                    <p className="rounded bg-background/80 p-2 font-mono text-[11px] text-foreground">
                      Fix: In Supabase Dashboard → <strong>SQL Editor</strong>, paste the contents of{" "}
                      <strong>supabase-schema.sql</strong> and click <strong>Run</strong>.
                    </p>
                  </div>
                )}
                {health.quickFix && (
                  <p className="rounded bg-background/80 p-2 font-mono text-[11px] text-foreground">
                    💡 <strong>Suggested fix:</strong> {health.quickFix}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="size-4" />
            Try again
          </button>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            Go to sign in
          </Link>
          <Link
            href="/api/health"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
          >
            <Server className="size-4" />
            View health JSON
          </Link>
        </div>

        {/* Technical Error Details Accordion */}
        <div className="pt-2 text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <span>Technical details & logs</span>
            {showDetails ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {showDetails && (
            <div className="mt-2 space-y-2 rounded-lg border border-border bg-card p-3 font-mono text-[11px] text-muted-foreground">
              {error.message && (
                <div>
                  <span className="font-semibold text-foreground">Message: </span>
                  <span className="text-destructive">{error.message}</span>
                </div>
              )}
              {error.digest && (
                <div>
                  <span className="font-semibold text-foreground">Digest: </span>
                  <span>{error.digest}</span>
                </div>
              )}
              {checkingHealth && (
                <div className="text-muted-foreground">Checking backend health...</div>
              )}
              {health && (
                <pre className="max-h-48 overflow-auto rounded bg-background p-2 text-[10px] text-foreground">
                  {JSON.stringify(health, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

