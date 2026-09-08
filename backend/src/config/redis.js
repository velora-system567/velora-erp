import IORedis from "ioredis";
import { env } from "./env.js";

let redis = null;
let redisAvailable = false;
let probeStarted = false;

/**
 * In-memory fallback for local dev / when Redis is unavailable.
 *
 * Mirrors the subset of the ioredis API used across the codebase:
 *   get, set, del, exists, incr, expire, ttl, flushall, multi, eval
 * so OTP generation/verification, rate limiting and session blacklisting
 * keep working gracefully without a running Redis server.
 *
 * Values are stored as raw strings (JSON-encoded by callers) with a lazy
 * expiry enforced on read. This makes the OTP system fully functional even
 * when Redis is not running (it is merely per-process rather than shared).
 */
const memStore = new Map();

function memGet(key) {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.exp && entry.exp <= Date.now()) {
    memStore.delete(key);
    return null;
  }
  return entry.val;
}

function memPut(key, val, mode, ttl) {
  let seconds = Number(ttl);
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) seconds = 0;
  memStore.set(key, { val, exp: seconds ? Date.now() + seconds * 1000 : null });
}

function memMulti(store) {
  const commands = [];
  const chain = {
    set(key, val, mode, ttl) { commands.push(["set", key, val, mode, ttl]); return chain; },
    del(...keys) { commands.push(["del", ...keys]); return chain; },
    incr(key) { commands.push(["incr", key]); return chain; },
    expire(key, s) { commands.push(["expire", key, s]); return chain; },
    async exec() {
      const results = [];
      for (const [cmd, ...args] of commands) {
        if (cmd === "set") { memPut(args[0], args[1], args[2], args[3]); results.push(["OK", null]); }
        else if (cmd === "del") { let n = 0; for (const k of args) if (memGet(k) !== null) { store.delete(k); n++; } results.push([n, null]); }
        else if (cmd === "incr") { const v = (Number(memGet(args[0])) || 0) + 1; memPut(args[0], String(v), null, null); results.push([v, null]); }
        else if (cmd === "expire") { const e = store.get(args[0]); if (e) { e.exp = Date.now() + Number(args[1]) * 1000; results.push([1, null]); } else results.push([0, null]); }
        else results.push([null, new Error(`Unsupported mem-multi command: ${cmd}`)]);
      }
      return results;
    },
  };
  return chain;
}

// Re-implements the OTP verification Lua script used by otp.service.js
// (return values: 1 = matched & deleted, 0 = missing/expired, -1 = too many
// attempts & deleted, -2 = mismatch & attempts incremented). Correct even
// without a Lua interpreter.
function memEval(_luaScript, _keyCount, key, ...args) {
  const recordRaw = memGet(key);
  if (recordRaw === null) return 0;
  let record;
  try { record = JSON.parse(recordRaw); } catch { return 0; }
  const expectedHash = args[0];
  const maxAttempts = Number(args[1]);
  if (record.hash === expectedHash) {
    memStore.delete(key);
    return 1;
  }
  record.attempts = (record.attempts || 0) + 1;
  if (record.attempts >= maxAttempts) {
    memStore.delete(key);
    return -1;
  }
  memPut(key, JSON.stringify(record), null, null);
  return -2;
}

const _memoryFallback = {
  async get(key) { return memGet(key); },
  async set(key, val, mode, ttl) { memPut(key, val, mode, ttl); return "OK"; },
  async del(...keys) { let n = 0; for (const k of keys) if (memGet(k) !== null) { memStore.delete(k); n++; } return n; },
  async exists(...keys) { return keys.filter((k) => memGet(k) !== null).length; },
  async incr(key) { const v = (Number(memGet(key)) || 0) + 1; memPut(key, String(v), null, null); return v; },
  async expire(key, seconds) { const e = memStore.get(key); if (!e) return 0; e.exp = Date.now() + Number(seconds) * 1000; return 1; },
  async ttl(key) { const e = memStore.get(key); if (!e) return -2; if (e.exp == null) return -1; return Math.max(0, Math.floor((e.exp - Date.now()) / 1000)); },
  multi() { return memMulti(memStore); },
  eval(luaScript, keyCount, key, ...args) { return memEval(luaScript, keyCount, key, ...args); },
  async flushall() { memStore.clear(); return "OK"; },
};

/**
 * Begin probing for a real Redis connection. While the probe is in flight or
 * has failed, callers transparently use the in-memory fallback; once Redis
 * connects they switch to the real shared store permanently.
 */
function startProbe() {
  if (probeStarted || redis) return;
  probeStarted = true;
  try {
    redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 2) return null; // stop reconnect attempts; keep fallback
        return Math.min(times * 200, 1000);
      },
      lazyConnect: false,
      connectTimeout: 2000,
    });
    redis.on("ready", () => {
      redisAvailable = true;
      console.log("✅ Connected to Redis");
    });
    redis.on("error", () => {
      redisAvailable = false;
      console.warn("⚠️  Redis unavailable — using in-memory fallback");
    });
    redis.on("close", () => {
      redisAvailable = false;
    });
  } catch {
    redisAvailable = false;
  }
}

export function getRedis() {
  startProbe();
  if (!redis || !redisAvailable) return _memoryFallback;
  return redis;
}
