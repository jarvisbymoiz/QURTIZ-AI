"use client";
import { createClient } from "@supabase/supabase-js";
import { beginMediaUploadAction, completeMediaUploadAction } from "@/server/actions/media-upload";

/** File bytes go directly to Storage, avoiding server-action/hosting limits. */
const pendingFinalization = new WeakMap<File, { itemId: string; ticket: string; variantId?: string }>();
export async function uploadStudioMedia(itemId: string, file: File, slideIndex?: number, variantId?: string) {
  try {
    const pending = pendingFinalization.get(file);
    if (pending?.itemId === itemId && pending.variantId === variantId) {
      const complete = await completeMediaUploadAction(pending.ticket);
      if (complete.ok) pendingFinalization.delete(file);
      else if (/expired/i.test(complete.error)) pendingFinalization.delete(file);
      return complete.ok ? { ok: true as const, uploaded: [complete], failures: [] as { name: string; error: string }[] } : complete;
    }
    const start = await beginMediaUploadAction({ itemId, name: file.name, mime: file.type as Parameters<typeof beginMediaUploadAction>[0]["mime"], size: file.size, slideIndex, variantId });
    if (!start.ok) return start;
    // Signed upload authorization is scoped by the server ticket. This isolated
    // storage client does not alter the application's browser auth singleton.
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(120_000) }) },
    });
    const result = await storage.storage.from("brand-assets").uploadToSignedUrl(start.path, start.token, file, { contentType: file.type });
    if (result.error) return { ok: false as const, error: result.error.message };
    pendingFinalization.set(file, { itemId, ticket: start.ticket, variantId });
    const complete = await completeMediaUploadAction(start.ticket);
    if (complete.ok) pendingFinalization.delete(file);
    return complete.ok ? { ok: true as const, uploaded: [complete], failures: [] as { name: string; error: string }[] } : complete;
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Upload interrupted. Please retry." }; }
}
