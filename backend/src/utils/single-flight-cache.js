/**
 * single-flight-cache — Cached computation with cache-stampede protection.
 *
 * Expensive dashboard endpoints were stampeding the database: N concurrent
 * requests for the same key all missed the cache and all recomputed the same
 * heavy queries in parallel, exhausting the Prisma connection pool under load
 * (P2028 "Timed out fetching a new connection" → 500s → error pages).
 *
 * `cachedCompute` collapses that: concurrent callers for the same key await a
 * SINGLE in-flight computation instead of each recomputing.  It is a standard
 * enterprise pattern (single-flight + cache) and intentionally lives behind
 * the Redis abstraction so it works with both real Redis and the local
 * in-memory fallback.
 */
import { getRedis } from "../config/redis.js";

// In-process single-flight map: key -> in-flight Promise<value>
const inflight = new Map();

/**
 * @param {string} key   Cache key (tenant/company-scoped).
 * @param {number} ttlSeconds  Cache TTL.
 * @param {() => Promise<any>} compute  Expensive computation producing the value.
 * @returns {Promise<any>} The cached or freshly-computed value.
 */
export async function cachedCompute(key, ttlSeconds, compute) {
  const redis = getRedis();

  // 1. Fast path — already cached.
  const cached = await redis.get(key).catch(() => null);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* corrupt — recompute */ }
  }

  // 2. Single-flight — another request is computing this key; wait for it.
  const existing = inflight.get(key);
  if (existing) return existing;

  // 3. Compute once, cache, and let concurrent callers share this promise.
  const promise = (async () => {
    try {
      const value = await compute();
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds).catch(() => {});
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/** Drop the in-flight promise for a key (used on explicit invalidation). */
export function invalidateInflight(key) {
  inflight.delete(key);
}
