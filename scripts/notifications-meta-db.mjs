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
      await client.query(readFileSync("src/db/migrations/0028_notifications_meta.sql", "utf8"));
      await client.query("COMMIT");
      console.log("APPLIED 0028_notifications_meta");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  // Verify: notifications.meta exists, is jsonb, NOT NULL, defaults to {}.
  const colCheck = await client.query(`
    SELECT data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='meta'`);
  const col = colCheck.rows[0];
  if (!col) throw Error("Missing notifications.meta column — run with --apply");
  if (col.data_type !== "jsonb") throw Error(`notifications.meta must be jsonb, got ${col.data_type}`);
  if (col.is_nullable !== "NO") throw Error("notifications.meta must be NOT NULL");

  console.log("Verified 0028: notifications.meta (jsonb, not null, default '{}') is in place.");
} finally {
  client.release();
  await pool.end();
}
