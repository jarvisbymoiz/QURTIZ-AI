-- Application data is accessed through authenticated server actions/Drizzle.
-- Browsers use Supabase only for auth and Storage. Do not expose encrypted
-- credentials, jobs or private conversations through PostgREST.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workspaces','workspace_members','settings','brands',
    'brand_memory','platform_connections','chat_threads','chat_messages',
    'agent_runs','agent_steps','content_items','content_variants','content_pillars',
    'research_items','brand_assets','visual_assets','jobs','publishing_jobs',
    'notifications','campaigns','campaign_items','post_metrics','ai_insights',
    'competitors','competitor_snapshots','workspace_ai_config']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.qurtiz_storage_access(object_name text, write_access boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members m
    WHERE m.user_id = auth.uid() AND m.workspace_id::text = split_part(object_name, '/', 1)
      AND (NOT write_access OR m.role IN ('owner','admin','editor')));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.qurtiz_storage_access(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qurtiz_storage_access(text, boolean) TO authenticated;
--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('brand-assets', 'brand-assets', false, 52428800,
  ARRAY['image/png','image/jpeg','image/webp','video/mp4','video/quicktime','video/webm'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
--> statement-breakpoint
CREATE POLICY qurtiz_storage_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brand-assets' AND public.qurtiz_storage_access(name, false));
CREATE POLICY qurtiz_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand-assets' AND public.qurtiz_storage_access(name, true));
CREATE POLICY qurtiz_storage_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'brand-assets' AND public.qurtiz_storage_access(name, true))
WITH CHECK (bucket_id = 'brand-assets' AND public.qurtiz_storage_access(name, true));
CREATE POLICY qurtiz_storage_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'brand-assets' AND public.qurtiz_storage_access(name, true));
--> statement-breakpoint
-- Restrictive policies also constrain any pre-existing permissive policies.
CREATE POLICY qurtiz_storage_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (bucket_id <> 'brand-assets' OR public.qurtiz_storage_access(name, false));
CREATE POLICY qurtiz_storage_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id <> 'brand-assets' OR public.qurtiz_storage_access(name, true));
CREATE POLICY qurtiz_storage_update_boundary ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (bucket_id <> 'brand-assets' OR public.qurtiz_storage_access(name, true))
WITH CHECK (bucket_id <> 'brand-assets' OR public.qurtiz_storage_access(name, true));
CREATE POLICY qurtiz_storage_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (bucket_id <> 'brand-assets' OR public.qurtiz_storage_access(name, true));
CREATE POLICY qurtiz_storage_anonymous_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO anon
USING (bucket_id <> 'brand-assets') WITH CHECK (bucket_id <> 'brand-assets');
