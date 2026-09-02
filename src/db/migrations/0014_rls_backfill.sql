-- RLS backfill for the 11 tables created after 0001/0003 that have no RLS
-- SQL in the repo. The live DB enabled RLS on them out-of-band, so a fresh
-- environment would otherwise ship them unprotected with a public anon key.
-- Same member-based policy pattern as 0001_rls_policies.sql / 0003_rls_m2.sql
-- (qurtiz_is_workspace_member helper + SELECT/INSERT/UPDATE/DELETE per table).
-- All 11 tables carry a workspace_id column (verified in 0004/0005/0006/
-- 0009/0010 and src/db/schema.ts).
--
-- DROP POLICY IF EXISTS + CREATE POLICY keeps this safe to run against a DB
-- that already received out-of-band RLS, while staying valid Postgres
-- (CREATE POLICY has no IF NOT EXISTS clause — the original file was a
-- syntax error on fresh deploys, 42601). Fresh deployments get exactly the
-- 0001/0003 policy shape; re-runs are no-ops.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brand_assets',
    'visual_assets',
    'jobs',
    'notifications',
    'publishing_jobs',
    'campaigns',
    'campaign_items',
    'post_metrics',
    'ai_insights',
    'competitors',
    'competitor_snapshots'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_member_select" ON %I; CREATE POLICY "%s_member_select" ON %I FOR SELECT USING (qurtiz_is_workspace_member(workspace_id));',
      t, t, t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_member_insert" ON %I; CREATE POLICY "%s_member_insert" ON %I FOR INSERT WITH CHECK (qurtiz_is_workspace_member(workspace_id));',
      t, t, t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_member_update" ON %I; CREATE POLICY "%s_member_update" ON %I FOR UPDATE USING (qurtiz_is_workspace_member(workspace_id)) WITH CHECK (qurtiz_is_workspace_member(workspace_id));',
      t, t, t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_member_delete" ON %I; CREATE POLICY "%s_member_delete" ON %I FOR DELETE USING (qurtiz_is_workspace_member(workspace_id));',
      t, t, t, t
    );
  END LOOP;
END $$;
