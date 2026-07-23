import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required (used for OTP, rate limiting, sessions)"),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(24, "JWT_ACCESS_SECRET must be at least 24 characters"),
  JWT_REFRESH_SECRET: z.string().min(24, "JWT_REFRESH_SECRET must be at least 24 characters"),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("8h"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),

  // Frontend
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  // Resend — email delivery for OTP, verification, and notifications
  // In development, emails are logged to console if these are not set.
  // In production, these are required.
  RESEND_API_KEY: z.string().optional(),
  OTP_FROM_EMAIL: z.string().email("OTP_FROM_EMAIL must be a valid email").optional(),

  // Optional: separate secret for OTP hash (defaults to JWT_ACCESS_SECRET)
  OTP_HASH_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\nFix these in your .env file or environment, then restart.");
  process.exit(1);
}

export const env = parsed.data;
