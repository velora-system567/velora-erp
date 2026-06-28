import { z } from "zod";
import { gstinRegex } from "../../utils/validators.js";

export const registerSchema = z.object({
  body: z.object({
    tenantName: z.string().min(2),
    companyName: z.string().min(2),
    legalName: z.string().min(2),
    gstin: z.string().regex(gstinRegex).optional(),
    ownerName: z.string().min(2),
    ownerEmail: z.string().email(),
    ownerPhone: z.string().min(8).optional(),
    password: z.string().min(8),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().min(4),
    password: z.string().min(8),
  }),
});
