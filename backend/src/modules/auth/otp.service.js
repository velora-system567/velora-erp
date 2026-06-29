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
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_PHONE) {
    const error = new Error("Phone OTP provider is not configured. Add Twilio SMS credentials in Vercel.");
    error.statusCode = 503;
    throw error;
  }

  const body = new URLSearchParams({
    To: target,
    From: env.TWILIO_FROM_PHONE,
    Body: `Your Velora ERP verification code is ${code}. It expires in 10 minutes.`,
  });
  const token = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const error = new Error("Phone OTP could not be sent.");
    error.statusCode = 502;
    throw error;
  }
}

export async function requestOtp({ channel, target }) {
  const redis = getRedis();
  const code = generateOtp();
  await redis.set(otpKey(channel, target), code, "EX", OTP_TTL_SECONDS);

  if (channel === "email") await sendEmailOtp(target, code);
  if (channel === "phone") await sendPhoneOtp(target, code);
}

export async function verifyOtp({ channel, target, code }) {
  const redis = getRedis();
  const stored = await redis.get(otpKey(channel, target));
  if (!stored || stored !== code) {
    const error = new Error(`${channel === "email" ? "Email" : "Phone"} OTP is invalid or expired`);
    error.statusCode = 422;
    throw error;
  }
  await redis.del(otpKey(channel, target));
}
