-- These tables are accessed exclusively by authenticated server services.
-- RLS is defense in depth; no browser role may mutate quotas or cleanup jobs.
ALTER TABLE public.media_cleanup_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_storage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_cleanup_queue, public.workspace_storage_quotas,
  public.research_usage_events FROM PUBLIC, anon, authenticated;
