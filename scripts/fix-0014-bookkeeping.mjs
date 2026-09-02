// One-off Phase 2 bookkeeping: 0014_rls_backfill.sql was fixed (invalid
// "CREATE POLICY IF NOT EXISTS" -> "DROP POLICY IF EXISTS; CREATE POLICY").
// The drizzle migrator only compares created_at, but the recorded sha256 hash
// should match the committed file so the bookkeeping stays honest. Re-run:
// node scripts/fix-0014-bookkeeping.mjs
import fs from "node:fs";
import crypto from "node:crypto";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const sql = fs.readFileSync("src/db/migrations/0014_rls_backfill.sql", "utf8");
const hash = crypto.createHash("sha256").update(sql).digest("hex");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const r = await client.query(
    "update drizzle.__drizzle_migrations set hash = $1 where created_at = $2 returning id, hash, created_at",
    [hash, "1788250798702"],
  );
  console.log("updated rows:", r.rowCount);
  console.log("new hash:", hash);
} finally {
  await client.end();
}
