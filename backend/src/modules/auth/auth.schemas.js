import { z } from "zod";
const testingGstinSchema = z.string().trim().min(1).max(32).optional().or(z.literal(""));

export const registerSchema = z.object({
  body: z.object({
    companyName: z.string().min(2),
    gstin: testingGstinSchema,
    ownerName: z.string().min(2),
    ownerEmail: z.string().email(),
    ownerPhone: z.string().min(8).optional(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    phoneOtp: z.string().length(6),
    emailOtp: z.string().length(6),
  })
    .refine((value) => value.password === value.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords do not match",
    })
    .refine((value) => value.phoneOtp === "123456", {
      path: ["phoneOtp"],
      message: "Invalid phone OTP. Use 123456 during testing.",
    })
    .refine((value) => value.emailOtp === "123456", {
      path: ["emailOtp"],
      message: "Invalid email OTP. Use 123456 during testing.",
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
