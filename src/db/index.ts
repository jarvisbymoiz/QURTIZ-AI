import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __qurtiz_pg_pool: Pool | undefined;
  var __qurtiz_drizzle_db: NodePgDatabase<typeof schema> | undefined;
  var __qurtiz_db_warned_direct: boolean | undefined;
}

/**
 * Transient Postgres connection error indicators (e.g. Supabase pooler limit, connection drops).
 */
export function isTransientDbError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const code = (err as { code?: string })?.code;
  return (
    code === "53300" || // too_many_connections
    code === "08006" || // connection_failure
    code === "08001" || // sqlclient_unable_to_establish_sqlconnection
    code === "08004" || // sqlserver_rejected_establishment_of_sqlconnection
    code === "57P01" || // admin_shutdown
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    msg.includes("emaxconnsession") ||
    msg.includes("max clients reached") ||
    msg.includes("too many clients") ||
    msg.includes("remaining connection slots are reserved") ||
    msg.includes("connection timeout") ||
    msg.includes("connection terminated") ||
    msg.includes("connection pool")
  );
}

/**
 * Execute a database query with automatic retry for transient connection exhaustion.
 */
export async function withDbRetry<T>(
  operation: (db: NodePgDatabase<typeof schema>) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const db = getDb();
      return await operation(db);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isTransientDbError(err)) {
        console.warn(
          `[qurtiz db] Transient connection error on attempt ${attempt}/${maxRetries} (${err instanceof Error ? err.message : String(err)}). Retrying...`,
        );
        // If the pool connection dropped or broke, recycle the pool
        resetDbPool();
        // Exponential backoff with jitter (50ms - 250ms)
        const delay = Math.min(50 * Math.pow(2, attempt - 1) + Math.random() * 50, 300);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Lazily create or retrieve the Postgres connection pool and Drizzle client.
 * Global caching prevents connection pool exhaustion in serverless environments (e.g. Vercel)
 * and during local development fast refresh.
 *
 * Safe pool configuration:
 * - Vercel / Serverless: max: 1, idleTimeoutMillis: 2000ms to immediately release connections to Supabase.
 * - Long-running Node: max: 5, idleTimeoutMillis: 10000ms.
 * - Remote hosts like Supabase require SSL with rejectUnauthorized: false for pooled certificates.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not configured. Please add DATABASE_URL to your Vercel project environment variables (see SETUP.md).",
    );
  }

  // Diagnostic check for Supabase direct vs pooler connection
  if (
    !globalThis.__qurtiz_db_warned_direct &&
    connectionString.includes(".supabase.co") &&
    !connectionString.includes("pooler.supabase.com")
  ) {
    globalThis.__qurtiz_db_warned_direct = true;
    console.warn(
      "[qurtiz db] NOTICE: DATABASE_URL appears to be a direct Supabase connection (db.[ref].supabase.co). On Vercel / serverless, we strongly recommend using the Supabase Session Pooler URI (aws-0-[region].pooler.supabase.com:5432) to prevent EMAXCONNSESSION / IPv6 errors.",
    );
  }

  if (!globalThis.__qurtiz_drizzle_db || !globalThis.__qurtiz_pg_pool) {
    const isLocal =
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1") ||
      connectionString.includes("::1");

    const isVercel = Boolean(process.env.VERCEL);

    const pool = new Pool({
      connectionString,
      // In serverless platforms (Vercel), max: 1 prevents Supabase session pool exhaustion across concurrent lambdas.
      max: isVercel ? 1 : Number(process.env.MAX_DB_CONNECTIONS) || 5,
      // Remote hosts like Supabase require SSL with rejectUnauthorized: false for pooled certificates
      ssl: isLocal ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      // Quickly release idle client back to Supabase pooler in serverless environments
      idleTimeoutMillis: isVercel ? 2000 : 10000,
      allowExitOnIdle: true,
      maxUses: 7500,
    });

    pool.on("error", (err) => {
      console.error("[postgres pool] Idle client error, recycling pool:", err.message);
      try {
        pool.end().catch(() => {});
      } catch {
        // ignore
      }
      if (globalThis.__qurtiz_pg_pool === pool) {
        globalThis.__qurtiz_pg_pool = undefined;
        globalThis.__qurtiz_drizzle_db = undefined;
      }
    });

    globalThis.__qurtiz_pg_pool = pool;
    globalThis.__qurtiz_drizzle_db = drizzle(pool, { schema });
  }

  return globalThis.__qurtiz_drizzle_db;
}

/** Reset cached database pool to force a fresh connection on subsequent queries */
export function resetDbPool(): void {
  const existingPool = globalThis.__qurtiz_pg_pool;
  globalThis.__qurtiz_pg_pool = undefined;
  globalThis.__qurtiz_drizzle_db = undefined;
  if (existingPool) {
    try {
      existingPool.end().catch(() => {});
    } catch {
      // ignore
    }
  }
}


