import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";
config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (process.argv.includes("--apply")) {
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s'");
      await client.query(readFileSync(process.argv.includes("--identity-release") ? "src/db/migrations/0021_proactive_agent_identity.sql" : "src/db/migrations/0020_agent_memory.sql", "utf8"));
      if (process.argv.includes("--identity-release")) await client.query(readFileSync("src/db/migrations/0022_compact_agent_identity.sql", "utf8"));
      await client.query("COMMIT");
      console.log("Applied additive agent migration. Existing identity/history/content records preserved.");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  const { rows } = await client.query(`SELECT c.relname, c.relrowsecurity,
    has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS browser_read,
    has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anonymous_read
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    AND c.relname IN ('agent_identities','workspace_agent_profiles','user_agent_memories','brand_memory') ORDER BY c.relname`);
  if (rows.length !== 4 || rows.some(row => !row.relrowsecurity || row.browser_read || row.anonymous_read)) throw new Error("Memory RLS/grant verification failed");
  console.log("Verified four protected memory/profile tables: RLS enabled, anonymous/browser direct access denied.");
} finally { client.release(); await pool.end(); }
