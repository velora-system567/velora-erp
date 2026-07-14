import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(24),
  JWT_REFRESH_SECRET: z.string().min(24),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("8h"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  RESEND_API_KEY: z.string().optional(),
  OTP_FROM_EMAIL: z.string().email().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_PHONE: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SECRET: z.string().optional(),
  SMS_ENDPOINT: z.string().optional(),
  SENDER_ID: z.string().optional(),
  AUTH_TOKENS: z.string().optional(),
});

export const env = envSchema.parse(process.env);
