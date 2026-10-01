import { createHmac, timingSafeEqual } from "node:crypto";

/** Supabase sends an endpoint-scoped, short-lived signature so pg_net never
 * queues the permanent scheduler credential. GitHub manual recovery uses bearer. */
export function validCronAuthorization(header: string | null, secret: string, endpoint: string, now = Date.now()): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  const match = /^v1:(\d{10}):([a-f0-9]{64})$/.exec(token);
  const expected = match
    ? createHmac("sha256", secret).update(`${endpoint}:${match[1]}`).digest("hex")
    : secret;
  if (match && Math.abs(Math.floor(now / 1000) - Number(match[1])) > 60) return false;
  const actualBytes = Buffer.from(match ? match[2] : token);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
