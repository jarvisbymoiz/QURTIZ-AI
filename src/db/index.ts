import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

/**
 * Lazily create the Postgres connection. We must NOT throw at module scope
 * so that `next build` succeeds without environment variables configured.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not configured. Create .env.local from .env.example (see SETUP.md).",
    );
  }
  if (!db) {
    pool = new Pool({ connectionString, max: 5 });
    db = drizzle(pool, { schema });
  }
  return db;
}
