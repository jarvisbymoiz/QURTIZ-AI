-- Restore the server-only content access design from 0018.
-- AI and Studio share authenticated, workspace-scoped server services.
-- Preserve existing RLS, data, provider payloads and media relationships.
REVOKE ALL ON content_items, content_variants FROM PUBLIC, anon, authenticated;
