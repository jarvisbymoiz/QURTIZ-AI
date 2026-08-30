/**
 * In-memory sliding-window rate limiter.
 * Suitable for a single server instance. For multi-instance production
 * deployments swap the store for Redis/Upstash — the interface stays identical.
 */
type Bucket = { hits: number[] };

const store = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (store.size > MAX_KEYS) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const oldestHit = bucket.hits[0];
    store.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldestHit)) / 1000)),
    };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}
