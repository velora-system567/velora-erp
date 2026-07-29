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

/**
 * Normalize a phone number: strip non-digits, keep as-is.
 */
function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, "");
}

function targetDigest(identifier) {
  return crypto.createHmac("sha256", getSecret())
    .update(identifier.toLowerCase().trim())
    .digest("hex");
}

function otpHash(identifier, code) {
  return crypto.createHmac("sha256", getSecret())
    .update(`${identifier.toLowerCase().trim()}:${code}`)
    .digest("hex");
}

// ─── Redis Keys ───────────────────────────────────────────────────

function otpKey(identifier)      { return `otp:${identifier.startsWith("+") ? "phone" : "email"}:${targetDigest(identifier)}`; }
function cooldownKey(identifier) { return `otp:cooldown:${targetDigest(identifier)}`; }
function sendWindowKey(identifier) { return `otp:sends:${targetDigest(identifier)}`; }
function sendLockKey(identifier) { return `otp:lock:${targetDigest(identifier)}`; }

// ─── Login Rate Limiting ──────────────────────────────────────────

function loginAttemptsKey(email) { return `login:attempts:${email.toLowerCase()}`; }
function loginBanKey(email)      { return `login:banned:${email.toLowerCase()}`; }

export async function checkLoginRateLimit(email) {
  try {
    const redis = getRedis();
    const banned = await redis.get(loginBanKey(email));
    if (banned) {
      const ttl = await redis.ttl(loginBanKey(email));
      const err = new Error(`Too many login attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`);
      err.statusCode = 429;
      throw err;
    }
  } catch (err) {
    if (err.statusCode === 429) throw err;
    // Redis unavailable — allow login (no rate limiting)
  }
}

export async function recordLoginAttempt(email, success) {
  try {
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
  } catch {
    // Redis unavailable — skip rate limiting
  }
}

// ─── OTP Generation ───────────────────────────────────────────────

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

// ─── OTP Request ──────────────────────────────────────────────────

/**
 * Generates a 6-digit OTP, stores its hash in Redis, and delivers it.
 * Supports both email (via Resend) and phone (logged to console; SMS provider integration-ready).
 *
 * Rate limiting:
 *  - 60s cooldown between requests to the same target
 *  - Max 5 requests per hour per target
 *
 * @param {string} target - Email address or phone number (starting with +)
 * @param {string} purpose - "verification" | "password-reset" | "phone-login"
 * @returns {{ expiresInSeconds: number, resendAfterSeconds: number }}
 */
export async function requestOtp({ target, purpose = "verification" }) {
  const isPhone = typeof target === "string" && target.startsWith("+");
  const identifier = isPhone ? normalizePhone(target) : target.toLowerCase().trim();
  const redis = getRedis();

  // Cooldown check
  if (await redis.exists(cooldownKey(identifier))) {
    const err = new Error("Please wait 60 seconds before requesting another code.");
    err.statusCode = 429;
    throw err;
  }

  // Lock to prevent concurrent requests
  const locked = await redis.set(sendLockKey(identifier), "1", "EX", 30, "NX");
  if (!locked) {
    const err = new Error("A verification request is already in progress. Please wait a moment.");
    err.statusCode = 429;
    throw err;
  }

  try {
    // Hourly rate limit
    const windowKey = sendWindowKey(identifier);
    const sends = await redis.incr(windowKey);
    if (sends === 1) await redis.expire(windowKey, 60 * 60);
    if (sends > MAX_SENDS_PER_HOUR) {
      const err = new Error("Too many verification requests. Please try again in an hour.");
      err.statusCode = 429;
      throw err;
    }

    const code = generateOtp();

    if (isPhone) {
      // Phone OTP — log to console; ready for SMS provider integration
      console.log(`[otp] 💡 OTP for phone ${identifier}: ${code}`);
      // Future: integrate Twilio, AWS SNS, or MSG91 here
      // const { sendSms } = await import("../../utils/sms.js");
      // await sendSms({ to: identifier, code, purpose });
    } else {
      // Email OTP — send via Resend
      const { sendOtpEmail, checkConfig } = await import("../../utils/email.js");
      const missing = checkConfig();
      if (missing.length > 0) {
        console.warn(`[otp] ⚠️ Email delivery not configured. Missing: ${missing.join(", ")}`);
        console.warn(`[otp] 💡 OTP for ${identifier}: ${code}`);
        console.warn(`[otp] 📧 To enable email delivery, set ${missing.join(" and ")} in your environment.`);
      } else {
        try {
          const result = await sendOtpEmail({ to: identifier, code, purpose });
          console.log(`[otp] ✅ Email sent to ${identifier} via Resend:`, result?.id || "unknown");
        } catch (err) {
          console.error(`[otp] ❌ Failed to send email to ${identifier}:`, err.message);
        }
      }
    }

    // Store hashed OTP in Redis with atomic transaction
    await redis
      .multi()
      .set(otpKey(identifier), JSON.stringify({ hash: otpHash(identifier, code), attempts: 0 }), "EX", OTP_TTL_SECONDS)
      .set(cooldownKey(identifier), "1", "EX", RESEND_COOLDOWN_SECONDS)
      .del(sendLockKey(identifier))
      .exec();

    return { expiresInSeconds: OTP_TTL_SECONDS, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
  } catch (error) {
    await redis.del(sendLockKey(identifier));
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
  const isPhone = typeof target === "string" && target.startsWith("+");
  const identifier = isPhone ? normalizePhone(target) : target.toLowerCase().trim();
  if (!/^\d{6}$/.test(String(code))) {
    const err = new Error("Verification code must contain 6 digits.");
    err.statusCode = 422;
    throw err;
  }

  const redis = getRedis();
  const key = otpKey(identifier);
  const expectedHash = otpHash(identifier, String(code));

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
