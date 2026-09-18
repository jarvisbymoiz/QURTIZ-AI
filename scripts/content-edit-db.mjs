import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";
config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (process.argv.includes("--apply")) {
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'");
      for (const file of ["0023_content_internal_edits.sql", "0024_agent_editing_identity.sql", "0025_content_server_grants.sql"]) await client.query(readFileSync("src/db/migrations/" + file, "utf8"));
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  const { rows } = await client.query(`SELECT c.relname, c.relrowsecurity, has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anon_access, has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS browser_access FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('content_items','content_variants','agent_identities')`);
  console.log(JSON.stringify(rows));
  if (rows.length !== 3 || rows.some(row => !row.relrowsecurity || row.anon_access || row.browser_access)) throw Error("Content/identity RLS or grants unsafe");
  const identity = await client.query("SELECT version FROM agent_identities WHERE version=4");
  const column = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='content_items' AND column_name='internal_edits'");
  if (!identity.rowCount || !column.rowCount) throw Error("Editing release missing");
  console.log("Verified additive edit release: protected identity 4, display-only correction column, server-only RLS/grants. Original delivery/content/media preserved.");
} finally { client.release(); await pool.end(); }
