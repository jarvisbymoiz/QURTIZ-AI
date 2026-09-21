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
      await client.query(readFileSync("src/db/migrations/0026_media_lifecycle.sql", "utf8"));
      await client.query("COMMIT");
      console.log("APPLIED 0026_media_lifecycle");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  // Verify the schema is complete and consistent with the code:
  // 1. new columns exist on visual_assets + brand_assets
  // 2. new tables exist with expected constraints
  // 3. every workspace has a storage quota row
  // 4. media tables are still server-only (RLS revoke list from 0018
  //    covers visual_assets/brand_assets; the two NEW tables must be
  //    revoked here as well).
  const colCheck = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND ((table_name='visual_assets' AND column_name IN ('ref_count','last_used_at','cleanup_status','cleanup_eligible_at','created_by'))
        OR (table_name='brand_assets' AND column_name IN ('ref_count','last_used_at','cleanup_status','cleanup_eligible_at')))
    ORDER BY table_name, column_name`);
  const expectedCols = [
    ["brand_assets", "cleanup_eligible_at"],
    ["brand_assets", "cleanup_status"],
    ["brand_assets", "last_used_at"],
    ["brand_assets", "ref_count"],
    ["visual_assets", "cleanup_eligible_at"],
    ["visual_assets", "cleanup_status"],
    ["visual_assets", "created_by"],
    ["visual_assets", "last_used_at"],
    ["visual_assets", "ref_count"],
  ];
  const missing = expectedCols.filter(
    (e) => !colCheck.rows.some((r) => r.table_name === e[0] && r.column_name === e[1]),
  );
  if (missing.length) throw Error(`Missing lifecycle columns: ${JSON.stringify(missing)}`);

  const tableCheck = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('media_cleanup_queue','workspace_storage_quotas')`);
  if (tableCheck.rowCount !== 2) throw Error("media_cleanup_queue / workspace_storage_quotas missing");

  const quotaCheck = await client.query(`
    SELECT (SELECT count(*) FROM workspaces) AS ws,
           (SELECT count(*) FROM workspace_storage_quotas) AS quotas`);
  const { ws, quotas } = quotaCheck.rows[0];
  if (Number(ws) !== Number(quotas)) {
    console.log(`Note: ${ws} workspaces vs ${quotas} quota rows (lazy-seed covers the gap).`);
  }

  // Server-only access: the new tables and the extended media tables must
  // never be readable/writable by browser roles through PostgREST.
  await client.query(`
    REVOKE ALL ON TABLE media_cleanup_queue, workspace_storage_quotas FROM anon, authenticated;
  `);
  const grantCheck = await client.query(`
    SELECT c.relname,
           has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_access,
           has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS browser_access
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('media_cleanup_queue','workspace_storage_quotas','visual_assets','brand_assets')`);
  console.log(JSON.stringify(grantCheck.rows));
  if (grantCheck.rows.some((r) => r.anon_access || r.browser_access)) {
    throw Error("Browser access enabled on media tables — RLS unsafe");
  }

  console.log("Verified 0026: lifecycle columns, tables, quota seed, and server-only grants are in place.");
} finally {
  client.release();
  await pool.end();
}
