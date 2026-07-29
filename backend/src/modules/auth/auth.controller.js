import { created, ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { writeAudit } from "../../utils/audit.js";
import {
  loginUser,
  refreshAccessToken,
  registerTenant,
  logoutUser,
  logoutAllDevices,
  getActiveSessions,
  forgotPassword,
  resetPassword,
} from "./auth.service.js";
import { requestOtp as requestOtpCode, verifyOtp, checkLoginRateLimit, recordLoginAttempt } from "./otp.service.js";
import { sendEmailVerification, verifyEmail, resendVerification } from "./verification.service.js";
import { env } from "../../config/env.js";
import { getPrisma } from "../../config/db.js";
import { checkConfig } from "../../utils/email.js";

function publicUser(user) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    companyId: user.companyId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

function requestMeta(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  return {
    userAgent: req.headers["user-agent"] || null,
    ipAddress: Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0]?.trim() || req.ip || null,
  };
}

export const register = asyncHandler(async (req, res) => {
  // Verify email OTP before creating the account
  await verifyOtp({ target: req.validated.body.ownerEmail, code: req.validated.body.emailOtp });

  const result = await registerTenant(req.validated.body, requestMeta(req));

  // Fire-and-forget: send verification email
  sendEmailVerification(result.user.id, result.user.email).catch((err) =>
    console.error("[auth] Failed to send verification email:", err.message)
  );

  return created(
    res,
    {
      tenant: { id: result.tenant.id, name: result.tenant.name },
      company: { id: result.company.id, name: result.company.name },
      user: publicUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
    "Tenant registered successfully. Please verify your email.",
  );
});

export const requestOtp = asyncHandler(async (req, res) => {
  const result = await requestOtpCode(req.validated.body);

  const missing = checkConfig();
  const configured = missing.length === 0;

  const fromEmail = env.OTP_FROM_EMAIL || "onboarding@resend.dev";

  const message = configured
    ? `Verification code sent to your email (from: ${fromEmail}).`
    : `OTP generated (set RESEND_API_KEY to enable email delivery). Check the server console for the code in development.`;

  return ok(res, { ...result, delivered: configured, sender: fromEmail }, message);
});

export const login = asyncHandler(async (req, res) => {
  const { email, phone, password, otp } = req.validated.body;

  // Phone + OTP login
  if (phone && otp) {
    const { verifyOtp } = await import("./otp.service.js");
    await verifyOtp({ target: phone, code: otp });
    const result = await import("./auth.service.js").then((m) => m.loginWithPhone(phone, requestMeta(req)));
    await recordLoginAttempt(phone, true);
    return ok(res, {
      user: publicUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }, "Phone login successful");
  }

  // Phone + Password login
  if (phone && password) {
    await checkLoginRateLimit(phone);
    try {
      const result = await import("./auth.service.js").then((m) => m.loginWithPhone(phone, requestMeta(req), password));
      await recordLoginAttempt(phone, true);
      return ok(res, {
        user: publicUser(result.user),
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }, "Login successful");
    } catch (error) {
      await recordLoginAttempt(phone, false);
      throw error;
    }
  }

  // Email + Password login (existing)
  if (!email) {
    const err = new Error("Email or phone is required");
    err.statusCode = 422;
    throw err;
  }

  await checkLoginRateLimit(email);
  try {
    const result = await loginUser(email, password, requestMeta(req));
    await recordLoginAttempt(email, true);

    await writeAudit(req, {
      tableName: "users",
      recordId: result.user.id,
      action: "LOGIN_SUCCESS",
      newValue: { method: `${phone ? "phone" : "email"}:${otp ? "otp" : "password"}`, ip: requestMeta(req).ipAddress },
    }).catch((err) => console.error("[auth] Audit log error:", err.message));

    return ok(res, {
      user: publicUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }, "Login successful");
  } catch (error) {
    await recordLoginAttempt(email, false);
    throw error;
  }
});

export const refreshToken = asyncHandler(async (req, res) => {
  const result = await refreshAccessToken(req.validated.body.refreshToken, requestMeta(req));
  return ok(res, result, "Token refreshed");
});

export const logout = asyncHandler(async (req, res) => {
  await logoutUser(req.body?.refreshToken);
  return ok(res, {}, "Logged out successfully");
});

export const logoutAll = asyncHandler(async (req, res) => {
  await logoutAllDevices(req.user.sub);
  return ok(res, {}, "All sessions terminated");
});

export const sessions = asyncHandler(async (req, res) => {
  const result = await getActiveSessions(req.user.sub);
  return ok(res, result, "Active sessions loaded");
});

export const forgotPasswordHandler = asyncHandler(async (req, res) => {
  await forgotPassword(req.validated.body.email);
  return ok(res, {}, "If that email exists, a reset code has been sent");
});

export const resetPasswordHandler = asyncHandler(async (req, res) => {
  await resetPassword(req.validated.body.email, req.validated.body.otp, req.validated.body.password);
  return ok(res, {}, "Password reset successfully. Please login again.");
});

export const me = asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { id: req.user.sub, isDeleted: false },
    include: { userRoles: { include: { role: true } } },
  });
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  const { passwordHash: _, ...safeUser } = user;
  return ok(res, { user: safeUser }, "Authenticated user");
});

// ─── Email Verification Handlers ─────────────────────────────────

export const verifyEmailHandler = asyncHandler(async (req, res) => {
  await verifyEmail(req.validated.body.token);
  return ok(res, {}, "Email verified successfully");
});

export const resendVerificationHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.sub || req.validated.body.email;
  if (typeof userId === "string" && userId.includes("@")) {
    const prisma = getPrisma();
    const user = await prisma.user.findFirst({
      where: { email: userId.toLowerCase(), isDeleted: false },
    });
    if (!user) return ok(res, {}, "If that email exists, a verification has been sent");
    await resendVerification(user.id);
  } else {
    await resendVerification(userId);
  }
  return ok(res, {}, "Verification email sent");
});
