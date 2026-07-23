import { z } from "zod";

const gstinOptional = z.string().trim().min(1).max(32).optional().or(z.literal(""));

export const requestOtpSchema = z.object({
  body: z.object({
    channel: z.enum(["email"]).default("email"),
    target: z.string().email("A valid email address is required"),
    purpose: z.enum(["verification", "password-reset"]).optional().default("verification"),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    companyName: z.string().min(2, "Company name must be at least 2 characters"),
    gstin: gstinOptional,
    ownerName: z.string().min(2, "Owner name must be at least 2 characters"),
    ownerEmail: z.string().email("A valid email address is required"),
    ownerPhone: z.string().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one digit")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string(),
    emailOtp: z.string().length(6, "Email OTP must be 6 digits"),
  })
    .refine((data) => data.password === data.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords do not match",
    }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Please enter a valid email address"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().length(6, "OTP must be 6 digits"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one digit")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Verification token is required"),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
  }),
});
