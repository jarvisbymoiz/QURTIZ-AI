-- Row-Level Security: defense-in-depth for workspace isolation.
-- The application connects as the table owner (bypasses RLS) and enforces
-- tenancy in its data-access layer; these policies protect any direct
-- client access path (e.g. PostgREST with a user JWT).

-- Helper: is the current auth user a member of the workspace?
-- SECURITY DEFINER prevents recursion on workspace_members policies.
CREATE OR REPLACE FUNCTION qurtiz_is_workspace_member(ws uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members m
    WHERE m.workspace_id = ws
      AND m.user_id = auth.uid()
  );
$$;

-- workspace_members: users can see their own memberships.
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_select_own" ON workspace_members
  FOR SELECT USING (user_id = auth.uid());

-- workspaces: members can read/update their workspaces (key column: id).
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_member_select" ON workspaces
  FOR SELECT USING (qurtiz_is_workspace_member(id));

CREATE POLICY "workspaces_member_update" ON workspaces
  FOR UPDATE USING (qurtiz_is_workspace_member(id))
  WITH CHECK (qurtiz_is_workspace_member(id));

-- Generic member-based policies for every table that carries workspace_id.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'settings',
    'brands',
    'brand_memory',
    'platform_connections',
    'chat_threads',
    'chat_messages',
    'agent_runs',
    'agent_steps',
    'content_items'
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
