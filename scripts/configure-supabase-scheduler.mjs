import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });
const mode = process.argv[2] ?? "--status";
if (!["--status", "--apply", "--disable"].includes(mode)) throw new Error("Use --status, --apply or --disable");
const origin = new URL(process.env.SCHEDULER_APP_URL ?? "https://qurtiz-ai.vercel.app");
if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
  throw new Error("SCHEDULER_APP_URL must be an HTTPS origin");
}
const db = new pg.Client({ connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "") ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000 });
try {
  await db.connect();
  if (mode === "--apply") {
    const secret = fs.readFileSync(process.env.SCHEDULER_SECRET_FILE ?? path.join(os.tmpdir(), "qurtiz-scheduler-secret.txt"), "utf8").trim();
    if (secret.length < 32 || /\s/.test(secret)) throw new Error("Invalid scheduler credential");
    // Verify the deployed credential before activating unattended work.
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secret).update(`publish:${timestamp}`).digest("hex");
    const response = await fetch(`${origin.origin}/api/cron/publish`, {
      headers: { Authorization: `Bearer v1:${timestamp}:${signature}` }, signal: AbortSignal.timeout(295000),
    });
    if (!response.ok) throw new Error(`Deployed scheduler verification failed: HTTP ${response.status}`);
    await db.query("begin");
    await db.query("create extension if not exists pg_cron");
    await db.query("create extension if not exists pg_net with schema extensions");
    const existing = await db.query("select id from vault.secrets where name = $1", ["qurtiz_cron_secret"]);
    if (existing.rows.length > 1) throw new Error("Duplicate scheduler vault records");
    if (existing.rows.length) await db.query("select vault.update_secret($1, $2)", [existing.rows[0].id, secret]);
    else await db.query("select vault.create_secret($1, $2, $3)", [secret, "qurtiz_cron_secret", "Qurtiz Production scheduler credential; no ChatGPT credentials"]);
    for (const endpoint of ["maintenance", "publish"]) {
      // Only an endpoint-scoped 60-second signature enters pg_net's queue.
      // Never enqueue the permanent Vault credential in HTTP headers.
      const command = `with tick as (select floor(extract(epoch from now()))::bigint::text as ts) select net.http_get(url := '${origin.origin}/api/cron/${endpoint}', headers := jsonb_build_object('Authorization', 'Bearer v1:' || tick.ts || ':' || encode(extensions.hmac('${endpoint}:' || tick.ts, (select decrypted_secret from vault.decrypted_secrets where name = 'qurtiz_cron_secret'), 'sha256'), 'hex')), timeout_milliseconds := 295000) from tick;`;
      await db.query("select cron.schedule($1, $2, $3)", [`qurtiz-${endpoint}`, "*/5 * * * *", command]);
    }
    await db.query("commit");
  } else if (mode === "--disable") {
    await db.query("select cron.unschedule(jobid) from cron.job where jobname in ('qurtiz-maintenance','qurtiz-publish')");
  }
  const installed = await db.query("select extname from pg_extension where extname = 'pg_cron'");
  if (!installed.rows.length) console.log(JSON.stringify({ configured: false }));
  else {
    // Never print job commands, queued request headers or decrypted vault values.
    const jobs = await db.query("select jobid, jobname, schedule, active from cron.job where jobname in ('qurtiz-maintenance','qurtiz-publish') order by jobname");
    console.log(JSON.stringify({ configured: jobs.rows.length === 2, jobs: jobs.rows }));
  }
} catch (error) {
  await db.query("rollback").catch(() => {});
  console.error(JSON.stringify({ error: "Scheduler setup failed", code: error.code ?? "configuration_or_network" }));
  process.exitCode = 1;
} finally { await db.end(); }
