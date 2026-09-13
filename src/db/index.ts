import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __qurtiz_pg_pool: Pool | undefined;
  var __qurtiz_drizzle_db: NodePgDatabase<typeof schema> | undefined;
}

/**
 * Lazily create or retrieve the Postgres connection pool and Drizzle client.
 * Global caching prevents connection pool exhaustion in serverless environments (e.g. Vercel)
 * and during local development fast refresh.
 *
 * SSL is enabled with rejectUnauthorized: false for all remote databases (such as Supabase,
 * Neon, AWS RDS) to prevent certificate validation errors over public cloud networks.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not configured. Please add DATABASE_URL to your Vercel project environment variables (see SETUP.md).",
    );
  }

  if (!globalThis.__qurtiz_drizzle_db) {
    const isLocal =
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1") ||
      connectionString.includes("::1");

    const pool = new Pool({
      connectionString,
      // In serverless platforms (Vercel), keep max: 1 to prevent Supabase connection pool exhaustion
      max: process.env.VERCEL ? 1 : 5,
      // Remote hosts like Supabase require SSL with rejectUnauthorized: false for pooled certificates
      ssl: isLocal ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });

    pool.on("error", (err) => {
      console.error("[postgres pool] Idle client error, recycling pool:", err);
      // Reset the cached pool so the next request reconnects cleanly
      globalThis.__qurtiz_pg_pool = undefined;
      globalThis.__qurtiz_drizzle_db = undefined;
    });

    globalThis.__qurtiz_pg_pool = pool;
    globalThis.__qurtiz_drizzle_db = drizzle(pool, { schema });
  }

  return globalThis.__qurtiz_drizzle_db;
}

/** Reset cached database pool to force a fresh connection on subsequent queries */
export function resetDbPool(): void {
  if (globalThis.__qurtiz_pg_pool) {
    try {
      globalThis.__qurtiz_pg_pool.end().catch(() => {});
    } catch {
      // ignore
    }
    globalThis.__qurtiz_pg_pool = undefined;
    globalThis.__qurtiz_drizzle_db = undefined;
  }
}

