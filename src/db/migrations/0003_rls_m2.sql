-- RLS for M2 tables (same member-based pattern as 0001).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'content_pillars',
    'research_items',
    'content_variants'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY "%s_member_select" ON %I FOR SELECT USING (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_member_insert" ON %I FOR INSERT WITH CHECK (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_member_update" ON %I FOR UPDATE USING (qurtiz_is_workspace_member(workspace_id)) WITH CHECK (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_member_delete" ON %I FOR DELETE USING (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
  END LOOP;
END $$;
