import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});

try {
  await client.connect();
  const workspaces = await client.query(`
    select w.id, w.name, q.plan, q.max_storage_bytes,
           ai.text_provider, ai.text_model, ai.text_base_url, ai.task_overrides,
           (select value from settings s where s.workspace_id = w.id and s.key = 'content_creation_entitlement') as content_entitlement,
           (select count(*)::int from content_items ci where ci.workspace_id = w.id) as lifetime_content_used,
           (select count(*)::int from content_items ci where ci.workspace_id = w.id and ci.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc') as monthly_content_used,
           (select count(*)::int from content_items ci where ci.workspace_id = w.id and ci.deleted_at is null) as posts,
           (select count(*)::int from agent_steps s where s.workspace_id = w.id and s.tool_name = 'create_content') as create_calls
    from workspaces w
    left join workspace_storage_quotas q on q.workspace_id = w.id
    left join workspace_ai_config ai on ai.workspace_id = w.id
    where w.deleted_at is null order by w.created_at
  `);
  const steps = await client.query(`
    select s.workspace_id, s.status, s.created_at, s.output->>'error' as error
    from agent_steps s where s.tool_name = 'create_content'
    order by s.created_at desc limit 20
  `);
  const runs = await client.query(`
    select workspace_id, kind, status, model, started_at, left(error, 400) as error
    from agent_runs where kind = 'content_generation'
    order by started_at desc limit 8
  `);
  console.log(JSON.stringify({ workspaces: workspaces.rows.map(row => ({
    ...row, text_base_url: row.text_base_url ? new URL(row.text_base_url).host : null,
  })), recentCreateSteps: steps.rows.map(row => ({
    ...row,
    error: typeof row.error === "string" ? row.error.replace(/Bearer\s+\S+|sk-[A-Za-z0-9_-]+/gi, "[redacted]").slice(0, 300) : null,
  })), recentGenerationRuns: runs.rows.map(row => ({ ...row,
    error: typeof row.error === "string" ? row.error.replace(/Bearer\s+\S+|sk-[A-Za-z0-9_-]+/gi, "[redacted]") : null,
  })) }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Database audit failed");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
