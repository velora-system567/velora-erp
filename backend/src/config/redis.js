import IORedis from "ioredis";
import { env } from "./env.js";

let redis;
let redisAvailable = true;

/**
 * Minimal in-memory fallback for local dev without Redis.
 * Replaces Redis get/set/del so the app works when Redis is down.
 */
const memStore = new Map();
const _memoryFallback = {
  async get(key) { return memStore.get(key) ?? null; },
  async set(key, val, _mode, ttl) { memStore.set(key, val); if (ttl) setTimeout(() => memStore.delete(key), (typeof ttl === "number" ? ttl : 300) * 1000); return "OK"; },
  async del(...keys) { keys.forEach((k) => memStore.delete(k)); return 1; },
  async flushall() { memStore.clear(); return "OK"; },
};

export function getRedis() {
  if (!redisAvailable) return _memoryFallback;
  if (!redis) {
    redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 2) {
          redisAvailable = false;
          console.warn("⚠️  Redis unavailable — using in-memory fallback");
          return null;
        }
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
      connectTimeout: 2000,
    });
    redis.on("error", () => { redisAvailable = false; });
  }
  return redis;
}
