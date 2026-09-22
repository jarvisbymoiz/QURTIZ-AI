-- Supabase may grant EXECUTE to anon explicitly through default privileges;
-- revoking PUBLIC alone (0018) does not remove that inherited default grant.
REVOKE ALL ON FUNCTION public.qurtiz_storage_access(text, boolean) FROM anon;
ALTER FUNCTION public.qurtiz_storage_access(text, boolean)
  SET search_path = public, pg_temp;
