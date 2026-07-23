/**
 * OTP Service — Email-only, Redis-backed, Resend-delivered
 *
 * ── Security ──────────────────────────────────────────────────
 * • 6-digit OTP generated with crypto.randomInt (CSPRNG)
 * • OTP is hashed (HMAC-SHA256) before storing in Redis
 * • 10-minute expiry (Redis TTL)
 * • One-time usage: deleted from Redis on successful verify
 * • Max 5 verify attempts per code (auto-deletes after)
 * • Rate limited: 5 sends/hour per email, 60s cooldown
 * ──────────────────────────────────────────────────────────────
 */
import crypto from "crypto";
import { getRedis } from "../../config/redis.js";
import { env } from "../../config/env.js";

// ─── Constants ────────────────────────────────────────────────────
const OTP_TTL_SECONDS = 10 * 60;          // 10 minutes
const RESEND_COOLDOWN_SECONDS = 60;       // 1 minute between resends
const MAX_SENDS_PER_HOUR = 5;              // max OTP requests per email per hour
const MAX_VERIFY_ATTEMPTS = 5;            // max failed attempts before code is revoked

// Login rate limiting
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;     // 15 minutes
const LOGIN_BAN_SECONDS = 30 * 60;        // 30 minute ban

// ─── Hashing ──────────────────────────────────────────────────────

function getSecret() {
  return env.OTP_HASH_SECRET || env.JWT_ACCESS_SECRET;
}

function targetDigest(email) {
  return crypto.createHmac("sha256", getSecret())
    .update(`email:${email.toLowerCase().trim()}`)
    .digest("hex");
}

function otpHash(email, code) {
  return crypto.createHmac("sha256", getSecret())
    .update(`email:${email.toLowerCase().trim()}:${code}`)
    .digest("hex");
}

// ─── Redis Keys ───────────────────────────────────────────────────

function otpKey(email)      { return `otp:email:${targetDigest(email)}`; }
function cooldownKey(email) { return `otp:cooldown:${targetDigest(email)}`; }
function sendWindowKey(email) { return `otp:sends:${targetDigest(email)}`; }
function sendLockKey(email) { return `otp:lock:${targetDigest(email)}`; }

// ─── Login Rate Limiting ──────────────────────────────────────────

function loginAttemptsKey(email) { return `login:attempts:${email.toLowerCase()}`; }
function loginBanKey(email)      { return `login:banned:${email.toLowerCase()}`; }

export async function checkLoginRateLimit(email) {
  const redis = getRedis();
  const banned = await redis.get(loginBanKey(email));
  if (banned) {
    const ttl = await redis.ttl(loginBanKey(email));
    const err = new Error(`Too many login attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`);
    err.statusCode = 429;
    throw err;
  }
}

export async function recordLoginAttempt(email, success) {
  const redis = getRedis();
  if (success) {
    await redis.del(loginAttemptsKey(email));
    await redis.del(loginBanKey(email));
    return;
  }
  const key = loginAttemptsKey(email);
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, LOGIN_WINDOW_SECONDS);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    await redis.set(loginBanKey(email), "1", "EX", LOGIN_BAN_SECONDS);
    await redis.del(key);
  }
}

// ─── OTP Generation ───────────────────────────────────────────────

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

// ─── OTP Request ──────────────────────────────────────────────────

/**
 * Generates a 6-digit OTP, stores its hash in Redis, and sends it via Resend.
 *
 * Rate limiting:
 *  - 60s cooldown between requests to the same email
 *  - Max 5 requests per hour per email
 *
 * @returns {{ expiresInSeconds: number, resendAfterSeconds: number }}
 */
export async function requestOtp({ target, purpose = "verification" }) {
  const email = target.toLowerCase().trim();
  const redis = getRedis();

  // Cooldown check
  if (await redis.exists(cooldownKey(email))) {
    const err = new Error("Please wait 60 seconds before requesting another code.");
    err.statusCode = 429;
    throw err;
  }

  // Lock to prevent concurrent requests
  const locked = await redis.set(sendLockKey(email), "1", "EX", 30, "NX");
  if (!locked) {
    const err = new Error("A verification request is already in progress. Please wait a moment.");
    err.statusCode = 429;
    throw err;
  }

  try {
    // Hourly rate limit
    const windowKey = sendWindowKey(email);
    const sends = await redis.incr(windowKey);
    if (sends === 1) await redis.expire(windowKey, 60 * 60);
    if (sends > MAX_SENDS_PER_HOUR) {
      const err = new Error("Too many verification requests. Please try again in an hour.");
      err.statusCode = 429;
      throw err;
    }

    const code = generateOtp();

    // Send via Resend (or log to console in dev)
    const { sendOtpEmail } = await import("../../utils/email.js");
    await sendOtpEmail({ to: email, code, purpose }).catch((err) => {
      console.error("[otp] Failed to send email:", err.message);
    });

    // Store hashed OTP in Redis with atomic transaction
    await redis
      .multi()
      .set(otpKey(email), JSON.stringify({ hash: otpHash(email, code), attempts: 0 }), "EX", OTP_TTL_SECONDS)
      .set(cooldownKey(email), "1", "EX", RESEND_COOLDOWN_SECONDS)
      .del(sendLockKey(email))
      .exec();

    return { expiresInSeconds: OTP_TTL_SECONDS, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
  } catch (error) {
    await redis.del(sendLockKey(email));
    throw error;
  }
}

// ─── OTP Verification ─────────────────────────────────────────────

/**
 * Verifies a 6-digit OTP using Redis Lua script for atomicity.
 *
 * Returns: true on success
 * Throws:  on invalid/expired code or too many attempts
 *
 * Lua script return values:
 *   1  → code matched → OTP deleted → success
 *   0  → key not found → expired or never requested
 *  -1  → too many failed attempts → key deleted
 *  -2  → code didn't match → attempts incremented
 */
export async function verifyOtp({ target, code }) {
  const email = target.toLowerCase().trim();
  if (!/^\d{6}$/.test(String(code))) {
    const err = new Error("Verification code must contain 6 digits.");
    err.statusCode = 422;
    throw err;
  }

  const redis = getRedis();
  const key = otpKey(email);
  const expectedHash = otpHash(email, String(code));

  const result = await redis.eval(
    `local value = redis.call('GET', KEYS[1])
     if not value then return 0 end
     local record = cjson.decode(value)
     if record.hash == ARGV[1] then redis.call('DEL', KEYS[1]); return 1 end
     record.attempts = (record.attempts or 0) + 1
     if record.attempts >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]); return -1 end
     redis.call('SET', KEYS[1], cjson.encode(record), 'KEEPTTL')
     return -2`,
    1,
    key,
    expectedHash,
    String(MAX_VERIFY_ATTEMPTS),
  );

  if (Number(result) === 1) return true;
  if (Number(result) === -1) {
    const err = new Error("Too many incorrect codes. Request a new verification code.");
    err.statusCode = 429;
    throw err;
  }
  const err = new Error("Verification code is invalid or expired.");
  err.statusCode = 422;
  throw err;
}
