import { getRedis } from "../../config/redis.js";
import { env } from "../../config/env.js";

const OTP_TTL_SECONDS = 10 * 60;

function otpKey(channel, target) {
  return `otp:${channel}:${target.toLowerCase()}`;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendEmailOtp(target, code) {
  if (!env.RESEND_API_KEY || !env.OTP_FROM_EMAIL) {
    const error = new Error("Email OTP provider is not configured. Add RESEND_API_KEY and OTP_FROM_EMAIL in Vercel.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.OTP_FROM_EMAIL,
      to: target,
      subject: "Velora ERP email verification code",
      text: `Your Velora ERP verification code is ${code}. It expires in 10 minutes.`,
    }),
  });

  if (!response.ok) {
    const error = new Error("Email OTP could not be sent.");
    error.statusCode = 502;
    throw error;
  }
}

async function sendPhoneOtp(target, code) {
  console.log(`[SMS] Initiating Phone OTP send to target: ${target}`);

  // Resolve config keys (custom keys first, fallback to Twilio)
  const apiKey = env.SMS_API_KEY || env.TWILIO_ACCOUNT_SID;
  const secret = env.SMS_SECRET || env.TWILIO_AUTH_TOKEN;
  const endpoint = env.SMS_ENDPOINT || (apiKey ? `https://api.twilio.com/2010-04-01/Accounts/${apiKey}/Messages.json` : null);
  const senderId = env.SENDER_ID || env.TWILIO_FROM_PHONE;

  const missing = [];
  if (!apiKey) missing.push("SMS API Key / TWILIO_ACCOUNT_SID");
  if (!secret) missing.push("SMS Secret / TWILIO_AUTH_TOKEN");
  if (!endpoint) missing.push("SMS Endpoint");
  if (!senderId) missing.push("Sender ID / TWILIO_FROM_PHONE");

  if (missing.length > 0) {
    const errorMsg = `Phone OTP provider is not fully configured. Missing environment variables: ${missing.join(", ")}`;
    console.error(`[SMS] [Error] Configuration check failed: ${errorMsg}`);
    const error = new Error(errorMsg);
    error.statusCode = 503;
    throw error;
  }

  // Determine if it is Twilio or generic
  const isTwilio = endpoint.includes("api.twilio.com");
  const authHeader = env.AUTH_TOKENS || (isTwilio
    ? `Basic ${Buffer.from(`${apiKey}:${secret}`).toString("base64")}`
    : `Bearer ${secret}`);

  let headers = {
    Authorization: authHeader,
  };
  let body;

  if (isTwilio) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams({
      To: target,
      From: senderId,
      Body: `Your Velora ERP verification code is ${code}. It expires in 10 minutes.`,
    });
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      to: target,
      from: senderId,
      body: `Your Velora ERP verification code is ${code}. It expires in 10 minutes.`,
    });
  }

  console.log(`[SMS] Sending POST request to URL: ${endpoint}. Payload: target=${target}, sender=${senderId}`);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: isTwilio ? body : body,
    });
  } catch (fetchErr) {
    console.error(`[SMS] [Error] Failed to connect to SMS provider network:`, fetchErr);
    const error = new Error(`SMS service unavailable. Network error: ${fetchErr.message}`);
    error.statusCode = 502;
    throw error;
  }

  console.log(`[SMS] SMS provider returned HTTP status: ${response.status}`);

  if (!response.ok) {
    let responseText = "";
    try {
      responseText = await response.text();
    } catch (_) {}

    console.error(`[SMS] [Error] SMS provider error response. HTTP Status: ${response.status}. Response: ${responseText}`);

    let errorDetail = "";
    try {
      const json = JSON.parse(responseText);
      errorDetail = json.message || json.error_message || json.error || responseText;
    } catch (_) {
      errorDetail = responseText;
    }

    const error = new Error(`SMS service failed: ${errorDetail || "Unknown error"}`);
    error.statusCode = response.status === 401 || response.status === 403 ? 401 : 502;
    throw error;
  }

  console.log(`[SMS] Phone OTP successfully sent to: ${target}`);
}

export async function requestOtp({ channel, target }) {
  console.log(`[OTP] API request received for channel: ${channel}, target: ${target}`);

  // Validation
  if (channel === "phone") {
    if (!/^\+?[0-9]{8,15}$/.test(target)) {
      console.warn(`[OTP] Validation failed. Invalid phone number: "${target}"`);
      const error = new Error("Invalid phone number format. Please enter a valid number (e.g. +919823456710).");
      error.statusCode = 400;
      throw error;
    }
  } else if (channel === "email") {
    if (!/\S+@\S+\.\S+/.test(target)) {
      console.warn(`[OTP] Validation failed. Invalid email: "${target}"`);
      const error = new Error("Invalid email format.");
      error.statusCode = 400;
      throw error;
    }
  }

  const redis = getRedis();

  // Rate Limiting (prevent spam, 1 request per 60 seconds per target)
  const rateLimitKey = `otp-limit:${channel}:${target.toLowerCase()}`;
  try {
    const isRateLimited = await redis.get(rateLimitKey);
    if (isRateLimited) {
      console.warn(`[OTP] Rate limit hit for ${channel}:${target}`);
      const error = new Error("Rate limit exceeded. Please wait 60 seconds before requesting another code.");
      error.statusCode = 429;
      throw error;
    }
  } catch (redisErr) {
    console.error(`[OTP] [Error] Redis read failed during rate-limit check:`, redisErr);
    // Continue despite Redis rate-limit read error, so we don't block users if cache has transient issues
  }

  const code = generateOtp();
  console.log(`[OTP] Successfully generated OTP code for ${channel}:${target}`);

  try {
    await redis.set(otpKey(channel, target), code, "EX", OTP_TTL_SECONDS);
    console.log(`[OTP] OTP code saved to Redis for ${channel}:${target}`);
    
    // Set rate limit key
    await redis.set(rateLimitKey, "1", "EX", 60);
    console.log(`[OTP] Rate limit lock set for ${channel}:${target} (60s)`);
  } catch (redisErr) {
    console.error(`[OTP] [Error] Failed to store OTP / limit in Redis:`, redisErr);
    const error = new Error("Internal server error. Failed to cache verification code.");
    error.statusCode = 500;
    throw error;
  }

  // Delegate sending
  if (channel === "email") {
    try {
      await sendEmailOtp(target, code);
    } catch (err) {
      console.error(`[OTP] [Error] Email OTP sending failed for ${target}:`, err);
      throw err;
    }
  } else if (channel === "phone") {
    try {
      await sendPhoneOtp(target, code);
    } catch (err) {
      console.error(`[OTP] [Error] Phone OTP sending failed for ${target}:`, err);
      throw err;
    }
  }
}

export async function verifyOtp({ channel, target, code }) {
  console.log(`[OTP] Verifying code for channel: ${channel}, target: ${target}`);
  const redis = getRedis();
  let stored;
  
  try {
    stored = await redis.get(otpKey(channel, target));
  } catch (redisErr) {
    console.error(`[OTP] [Error] Redis get failed during verification:`, redisErr);
    const error = new Error("Cache service unavailable. Verification could not be completed.");
    error.statusCode = 500;
    throw error;
  }

  if (!stored || stored !== code) {
    console.warn(`[OTP] Verification failed for ${channel}:${target}. Code matches: ${stored === code}`);
    const error = new Error(`${channel === "email" ? "Email" : "Phone"} OTP is invalid or expired`);
    error.statusCode = 422;
    throw error;
  }

  try {
    await redis.del(otpKey(channel, target));
    console.log(`[OTP] Verification successful. Deleted cached OTP for ${channel}:${target}`);
  } catch (redisErr) {
    console.error(`[OTP] [Error] Failed to clean up OTP key from Redis:`, redisErr);
  }
}
