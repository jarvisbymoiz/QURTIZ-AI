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
      // Keep pool small on serverless platforms (Vercel) to prevent Supabase connection exhaustion
      max: process.env.VERCEL ? 3 : 5,
      // Remote hosts like Supabase require SSL. rejectUnauthorized: false allows cloud poolers.
      ssl: isLocal ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 20000,
      allowExitOnIdle: true,
    });

    pool.on("error", (err) => {
      console.error("[postgres pool] Unexpected error on idle client:", err);
    });

    globalThis.__qurtiz_pg_pool = pool;
    globalThis.__qurtiz_drizzle_db = drizzle(pool, { schema });
  }

  return globalThis.__qurtiz_drizzle_db;
}

