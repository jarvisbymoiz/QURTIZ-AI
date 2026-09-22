import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? false
    : { rejectUnauthorized: false },
});
const client = await pool.connect();

try {
  if (process.argv.includes("--apply")) {
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='120s'");
      await client.query(readFileSync("src/db/migrations/0027_brave_research.sql", "utf8"));
      await client.query("COMMIT");
      console.log("APPLIED 0027_brave_research");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  // Verify the schema is complete and consistent with the code:
  // 1. table exists with the expected columns
  // 2. indexes for workspace-scoped reporting exist
  // 3. browser roles (anon/authenticated) have NO access (server-only data)
  const colCheck = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='research_usage_events'
    ORDER BY column_name`);
  const expectedCols = [
    "cache_hit",
    "created_at",
    "freshness",
    "http_status",
    "id",
    "language",
    "latency_ms",
    "provider",
    "query",
    "query_hash",
    "region",
    "status",
    "strategy",
    "user_id",
    "workspace_id",
  ];
  const missing = expectedCols.filter((c) => !colCheck.rows.some((r) => r.column_name === c));
  if (missing.length) throw Error(`Missing research_usage_events columns: ${JSON.stringify(missing)}`);

  const idxCheck = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='research_usage_events'`);
  const idxNames = idxCheck.rows.map((r) => r.indexname);
  for (const required of ["research_usage_events_ws_created_idx", "research_usage_events_created_hash_idx"]) {
    if (!idxNames.includes(required)) throw Error(`Missing index: ${required}`);
  }

  // Server-only access: usage rows are platform telemetry, never readable
  // by browser roles through PostgREST (mirrors the 0025/0026 convention).
  await client.query(`
    REVOKE ALL ON TABLE research_usage_events FROM PUBLIC, anon, authenticated;
  `);
  const grantCheck = await client.query(`
    SELECT c.relname,
           has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_access,
           has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS browser_access
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname = 'research_usage_events'`);
  console.log(JSON.stringify(grantCheck.rows));
  if (grantCheck.rows.some((r) => r.anon_access || r.browser_access)) {
    throw Error("Browser access enabled on research_usage_events — RLS unsafe");
  }

  console.log("Verified 0027: research_usage_events columns, indexes, and server-only grants are in place.");
} finally {
  client.release();
  await pool.end();
}
