import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

/** Outcome of the server-side Supabase storage configuration probe. */
export type ServerStorageStatus = {
  /** True when BOTH the Supabase URL and the service-role key are configured. */
  configured: boolean;
  /** Probe outcome: false when unconfigured (there is nothing to reach),
   *  true/false from the authenticated probe when configured. */
  connected: boolean | null;
  /** Probe failure message (secrets redacted) when configured but unreachable. */
  error?: string;
};

/**
 * Probe the server storage configuration WITHOUT exposing any secret: check
 * env presence, then run one cheap authenticated call (storage.listBuckets())
 * through the service-role client. Shared by the boot log
 * (src/instrumentation.ts) and the Connections page status chip.
 *
 * Never throws — every outcome lands in the returned status, so a hung or
 * misconfigured storage can never crash boot or a page render. The key itself
 * never appears in the result: probe error messages are redacted defensively.
 */
export async function getServerStorageConfigStatus(): Promise<ServerStorageStatus> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { configured: false, connected: false };
  }
  try {
    const { error } = await createServiceClient().storage.listBuckets();
    if (error) {
      return { configured: true, connected: false, error: redactKey(error.message, serviceKey) };
    }
    return { configured: true, connected: true };
  } catch (e) {
    return {
      configured: true,
      connected: false,
      error: redactKey(e instanceof Error ? e.message : "Unknown storage error", serviceKey),
    };
  }
}

/** Defensive: if a probe error ever quotes the key (or the URL carrying it),
 *  strip it before the message can reach a log or the UI. */
function redactKey(message: string, key: string): string {
  return key && message.includes(key) ? message.split(key).join("[redacted]") : message;
}
