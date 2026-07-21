import crypto from "crypto";
import { getRedis } from "../../config/redis.js";
import { env } from "../../config/env.js";

const OTP_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

function normalizedTarget(channel, target) {
  const value = String(target || "").trim();
  if (channel === "email") return value.toLowerCase();
  if (!/^\+[1-9]\d{7,14}$/.test(value)) {
    const error = new Error("Phone numbers must use E.164 format, for example +919823456710.");
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function targetDigest(channel, target) {
  return crypto.createHmac("sha256", env.OTP_HASH_SECRET || env.JWT_ACCESS_SECRET).update(`${channel}:${target}`).digest("hex");
}

function otpHash(channel, target, code) {
  return crypto.createHmac("sha256", env.OTP_HASH_SECRET || env.JWT_ACCESS_SECRET).update(`${channel}:${target}:${code}`).digest("hex");
}

function otpKey(channel, target) { return `otp:v2:${channel}:${targetDigest(channel, target)}`; }
function cooldownKey(channel, target) { return `otp:v2:cooldown:${channel}:${targetDigest(channel, target)}`; }
function sendWindowKey(channel, target) { return `otp:v2:sends:${channel}:${targetDigest(channel, target)}`; }
function sendLockKey(channel, target) { return `otp:v2:lock:${channel}:${targetDigest(channel, target)}`; }

function generateOtp() { return crypto.randomInt(100000, 1000000).toString(); }

function providerError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function sendEmailOtp(target, code) {
  if (!env.RESEND_API_KEY || !env.OTP_FROM_EMAIL) throw providerError("Email verification is not configured. Set RESEND_API_KEY and OTP_FROM_EMAIL.", 503);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.OTP_FROM_EMAIL,
      to: [target],
      subject: "Your Velora ERP verification code",
      text: `Your Velora ERP verification code is ${code}. It expires in 10 minutes. Do not share this code with anyone.`,
      html: `<main style="font-family:Arial,sans-serif;color:#0f172a"><h1 style="font-size:20px">Verify your Velora ERP account</h1><p>Use this one-time verification code:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. Do not share it with anyone.</p></main>`,
    }),
  });
  if (!response.ok) throw providerError("Email verification could not be sent. Please try again shortly.");
}

async function sendPhoneOtp(target, code) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_PHONE) {
    throw providerError("SMS verification is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE.", 503);
  }
  const credentials = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: target, From: env.TWILIO_FROM_PHONE, Body: `Your Velora ERP verification code is ${code}. It expires in 10 minutes. Do not share it.` }),
  });
  if (!response.ok) throw providerError("SMS verification could not be sent. Please try again shortly.");
}

export async function requestOtp({ channel, target }) {
  const normalized = normalizedTarget(channel, target);
  const redis = getRedis();
  const cooldown = cooldownKey(channel, normalized);
  const lock = sendLockKey(channel, normalized);
  if (await redis.exists(cooldown)) throw providerError("Please wait 60 seconds before requesting another code.", 429);
  const locked = await redis.set(lock, "1", "EX", 30, "NX");
  if (!locked) throw providerError("A verification request is already in progress. Please wait a moment.", 429);

  try {
    const windowKey = sendWindowKey(channel, normalized);
    const sends = await redis.incr(windowKey);
    if (sends === 1) await redis.expire(windowKey, 60 * 60);
    if (sends > MAX_SENDS_PER_HOUR) throw providerError("Too many verification requests. Please try again in an hour.", 429);

    const code = generateOtp();
    if (channel === "email") await sendEmailOtp(normalized, code);
    else await sendPhoneOtp(normalized, code);

    await redis.multi()
      .set(otpKey(channel, normalized), JSON.stringify({ hash: otpHash(channel, normalized, code), attempts: 0 }), "EX", OTP_TTL_SECONDS)
      .set(cooldown, "1", "EX", RESEND_COOLDOWN_SECONDS)
      .del(lock)
      .exec();
    return { expiresInSeconds: OTP_TTL_SECONDS, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
  } catch (error) {
    await redis.del(lock);
    throw error;
  }
}

export async function verifyOtp({ channel, target, code }) {
  const normalized = normalizedTarget(channel, target);
  if (!/^\d{6}$/.test(String(code))) throw providerError("Verification code must contain 6 digits.", 422);
  const redis = getRedis();
  const key = otpKey(channel, normalized);
  const expectedHash = otpHash(channel, normalized, String(code));
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
  if (Number(result) === -1) throw providerError("Too many incorrect codes. Request a new verification code.", 429);
  throw providerError("Verification code is invalid or expired.", 422);
}
