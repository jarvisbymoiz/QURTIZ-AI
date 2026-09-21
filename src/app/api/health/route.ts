import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/workspace";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!rateLimit(`health:${user.id}`, 12, 60_000).allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const envStatus = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ENCRYPTION_KEY: Boolean(process.env.ENCRYPTION_KEY),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || null,
    // Presence boolean only for the shared platform research key — the
    // value itself must never be returned anywhere.
    BRAVE_SEARCH_API_KEY: Boolean(process.env.BRAVE_SEARCH_API_KEY),
  };

  const missingEnvVars = Object.entries(envStatus)
    .filter(([k, v]) => !v && k !== "NEXT_PUBLIC_APP_URL")
    .map(([k]) => k);

  let databaseConnected = false;
  let databaseError: string | null = null;
  const existingTables: string[] = [];
  const requiredTables = [
    "workspaces",
    "workspace_members",
    "brands",
    "content_items",
    "platform_connections",
    "notifications",
    "agent_runs",
  ];
  let missingTables: string[] = [];

  if (envStatus.DATABASE_URL) {
    try {
      const db = getDb();
      // Test basic connectivity
      await db.execute(sql`SELECT 1 AS alive`);
      databaseConnected = true;

      // Check for tables
      const tableQuery = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      const found = new Set(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((tableQuery as any).rows || []).map((r: any) => String(r.table_name || "").toLowerCase()),
      );

      missingTables = requiredTables.filter((t) => !found.has(t));
      for (const t of requiredTables) {
        if (found.has(t)) existingTables.push(t);
      }
    } catch {
      databaseConnected = false;
      databaseError = "Database connectivity or schema check failed. Contact the application administrator.";
    }
  }

  const isHealthy =
    missingEnvVars.length === 0 && databaseConnected && missingTables.length === 0;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "action_required",
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL ? "vercel" : process.env.NODE_ENV,
      env: {
        configured: Object.fromEntries(
          Object.entries(envStatus).map(([k, v]) => [k, Boolean(v)]),
        ),
        missing: missingEnvVars,
      },
      database: {
        connected: databaseConnected,
        error: databaseError,
        schemaStatus:
          !databaseConnected
            ? "unreachable"
            : missingTables.length === 0
              ? "all_tables_present"
              : "tables_missing",
        tablesFound: existingTables,
        tablesMissing: missingTables,
      },
      quickFix:
        missingTables.length > 0
          ? "Ask the administrator to review and apply the committed database migrations using the deployment guide."
          : databaseError
            ? process.env.DATABASE_URL?.includes("db.") && process.env.DATABASE_URL?.includes(".supabase.co")
              ? `You appear to be using Supabase Direct Connection (db.[ref].supabase.co), which uses IPv6 and is unreachable from Vercel serverless. Please switch to your Supabase Connection Pooler URI (aws-0-[region].pooler.supabase.com:5432) in Supabase Dashboard → Settings → Database → Connection string → URI → Session (port 5432). Error was: ${databaseError}`
              : `Check your DATABASE_URL in Vercel. Error was: ${databaseError}. Note: On Vercel, you must use the Supabase Connection Pooler (pooler.supabase.com:5432 Session mode), not direct db.[ref].supabase.co.`
            : missingEnvVars.length > 0
              ? `Add the following missing variables in Vercel Project Settings: ${missingEnvVars.join(", ")}`
              : "All system checks passed.",
    },
    { status: isHealthy ? 200 : 503 },
  );
}
