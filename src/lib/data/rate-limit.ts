/**
 * In-memory sliding-window rate limiter.
 *
 * Keyed by client IP. Each window tracks a count and a reset timestamp.
 * Expired entries are pruned on every check to prevent memory leaks.
 *
 * NOTE: This works for single-instance deployments. For multi-instance
 * production, replace with a Redis-backed implementation.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number; // Unix ms
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix seconds
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

/**
 * Prune expired entries from the store to prevent unbounded growth.
 * Called on every check — O(n) but n is bounded by active IPs.
 */
function pruneExpired(store: Map<string, RateLimitEntry>, now: number): void {
  for (const [key, entry] of store) {
    if (now >= entry.resetTime) {
      store.delete(key);
    }
  }
}

export interface RateLimiterOptions {
  /** Unique name for this limiter (allows multiple independent limits). */
  name: string;
  /** Maximum requests allowed per window. */
  limit: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { name, limit, windowSeconds } = options;
  const windowMs = windowSeconds * 1000;

  return function check(key: string): RateLimitResult {
    const store = getStore(name);
    const now = Date.now();

    // Periodic cleanup — run every check (cheap for small maps)
    pruneExpired(store, now);

    const entry = store.get(key);

    if (!entry || now >= entry.resetTime) {
      // New window
      const resetTime = now + windowMs;
      store.set(key, { count: 1, resetTime });
      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: Math.ceil(resetTime / 1000),
      };
    }

    // Existing window
    entry.count += 1;

    if (entry.count > limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: Math.ceil(entry.resetTime / 1000),
      };
    }

    return {
      success: true,
      limit,
      remaining: limit - entry.count,
      reset: Math.ceil(entry.resetTime / 1000),
    };
  };
}

/**
 * Extract a stable client identifier from the request.
 * Prefers X-Forwarded-For (set by most reverse proxies / Vercel),
 * falls back to X-Real-Ip, then a generic fallback.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs; the first is the client
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}
