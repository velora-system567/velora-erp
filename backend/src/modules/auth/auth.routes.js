import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { checkConfig } from "../../utils/email.js";
import { env } from "../../config/env.js";
import { getPrisma } from "../../config/db.js";
import {
  forgotPasswordHandler,
  login,
  logout,
  logoutAll,
  me,
  refreshToken,
  register,
  requestOtp,
  resetPasswordHandler,
  sessions,
  verifyEmailHandler,
  resendVerificationHandler,
} from "./auth.controller.js";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  requestOtpSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "./auth.schemas.js";
import { handleGoogleAuth, getGoogleLoginUrl, isGoogleConfigured } from "./google.service.js";
import {
  getUserDevices, trustDevice, removeDevice, logoutDevice,
  logoutAllDevices as logoutAllDeviceDevices,
} from "./device.service.js";
import {
  generateQrSession, pollQrStatus, scanQr, approveQr, rejectQr,
} from "./qr.service.js";
import { logSecurityEvent, SECURITY_ACTIONS, getSecurityEvents, getSecuritySummary } from "./security-audit.service.js";
import { recordDevice } from "./device.service.js";

const router = Router();

// ─── Core Auth ─────────────────────────────────────────────────────
router.post("/register", validate(registerSchema), register);
router.post("/request-otp", validate(requestOtpSchema), requestOtp);
router.post("/login", validate(loginSchema), login);
router.post("/refresh-token", validate(refreshTokenSchema), refreshToken);
router.post("/logout", requireAuth, logout);
router.post("/logout-all", requireAuth, logoutAll);
router.get("/sessions", requireAuth, sessions);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPasswordHandler);
router.post("/reset-password", validate(resetPasswordSchema), resetPasswordHandler);
router.get("/me", requireAuth, me);

// Email verification
router.post("/verify-email", validate(verifyEmailSchema), verifyEmailHandler);
router.post("/resend-verification", validate(resendVerificationSchema), resendVerificationHandler);

// ─── Google OAuth ──────────────────────────────────────────────────
router.get("/google/url", (req, res) => {
  if (!isGoogleConfigured()) {
    return ok(res, { configured: false }, "Google OAuth not configured");
  }
  return ok(res, { configured: true, url: getGoogleLoginUrl() }, "Google auth URL");
});

router.post("/google", asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) {
    const err = new Error("Authorization code is required");
    err.statusCode = 400;
    throw err;
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  const result = await handleGoogleAuth(code, {
    userAgent: req.headers["user-agent"],
    ipAddress: Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]?.trim() || req.ip,
  });

  await logSecurityEvent({
    action: SECURITY_ACTIONS.GOOGLE_LOGIN,
    userId: result.user.id,
    tenantId: result.user.tenantId,
    companyId: result.user.companyId,
    ipAddress: req.headers["x-forwarded-for"] || req.ip,
    userAgent: req.headers["user-agent"],
  });

  return ok(res, result, "Google login successful");
}));

// ─── Device Management ─────────────────────────────────────────────
router.get("/devices", requireAuth, asyncHandler(async (req, res) => {
  const devices = await getUserDevices(req.user.sub);
  return ok(res, devices, "Devices loaded");
}));

router.post("/devices/:deviceId/trust", requireAuth, asyncHandler(async (req, res) => {
  const device = await trustDevice(req.user.sub, req.params.deviceId);
  await logSecurityEvent({
    action: SECURITY_ACTIONS.DEVICE_TRUSTED,
    userId: req.user.sub, tenantId: req.tenantId, companyId: req.companyId,
    details: { deviceId: req.params.deviceId },
    ipAddress: req.headers["x-forwarded-for"] || req.ip,
    userAgent: req.headers["user-agent"],
  });
  return ok(res, device, "Device trusted");
}));

router.delete("/devices/:deviceId", requireAuth, asyncHandler(async (req, res) => {
  await removeDevice(req.user.sub, req.params.deviceId, req);
  return ok(res, {}, "Device removed");
}));

router.post("/devices/:deviceId/logout", requireAuth, asyncHandler(async (req, res) => {
  await logoutDevice(req.user.sub, req.params.deviceId, req);
  return ok(res, {}, "Device logged out");
}));

router.post("/devices/logout-all", requireAuth, asyncHandler(async (req, res) => {
  await logoutAllDeviceDevices(req.user.sub, req);
  return ok(res, {}, "All devices logged out");
}));

// ─── QR Login ──────────────────────────────────────────────────────
router.post("/qr/generate", asyncHandler(async (req, res) => {
  const session = await generateQrSession({
    browser: req.headers["user-agent"],
    ipAddress: req.headers["x-forwarded-for"] || req.ip,
  });
  return ok(res, session, "QR session created");
}));

router.get("/qr/status/:sessionCode", asyncHandler(async (req, res) => {
  const result = await pollQrStatus(req.params.sessionCode);
  return ok(res, result, "QR status");
}));

router.post("/qr/scan", requireAuth, asyncHandler(async (req, res) => {
  const { qrToken } = req.body;
  if (!qrToken) {
    const err = new Error("QR token is required");
    err.statusCode = 400;
    throw err;
  }
  const result = await scanQr(qrToken, req.user.sub, {
    name: req.user.name, email: req.user.email,
  });
  return ok(res, result, "QR scanned");
}));

router.post("/qr/approve", requireAuth, asyncHandler(async (req, res) => {
  const { qrToken } = req.body;
  if (!qrToken) {
    const err = new Error("QR token is required");
    err.statusCode = 400;
    throw err;
  }
  const result = await approveQr(qrToken, req.user.sub);
  await logSecurityEvent({
    action: SECURITY_ACTIONS.QR_LOGIN_APPROVED,
    userId: req.user.sub, tenantId: req.tenantId, companyId: req.companyId,
    details: { qrToken: qrToken.slice(0, 8) + "..." },
    ipAddress: req.headers["x-forwarded-for"] || req.ip,
  });
  return ok(res, result, "QR approved");
}));

router.post("/qr/reject", requireAuth, asyncHandler(async (req, res) => {
  const { qrToken } = req.body;
  if (!qrToken) {
    const err = new Error("QR token is required");
    err.statusCode = 400;
    throw err;
  }
  const result = await rejectQr(qrToken);
  await logSecurityEvent({
    action: SECURITY_ACTIONS.QR_LOGIN_REJECTED,
    userId: req.user.sub, tenantId: req.tenantId,
    details: { qrToken: qrToken.slice(0, 8) + "..." },
    ipAddress: req.headers["x-forwarded-for"] || req.ip,
  });
  return ok(res, result, "QR rejected");
}));

// ─── Security Dashboard ────────────────────────────────────────────
router.get("/security/summary", requireAuth, asyncHandler(async (req, res) => {
  const summary = await getSecuritySummary(req);
  return ok(res, summary, "Security summary");
}));

router.get("/security/events", requireAuth, asyncHandler(async (req, res) => {
  const { limit, offset, action, category, userId, status } = req.query;
  const result = await getSecurityEvents(req, {
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    action, category, userId, status,
  });
  return ok(res, result, "Security events");
}));

// ─── Diagnostic endpoint ──────────────────────────────────────────
router.get("/diagnose", (req, res) => {
  const missingVars = checkConfig();
  const fromEmail = env.OTP_FROM_EMAIL || "onboarding@resend.dev";

  ok(res, {
    nodeEnv: env.NODE_ENV,
    frontendUrl: env.FRONTEND_URL,
    emailConfigured: missingVars.length === 0,
    googleConfigured: isGoogleConfigured(),
    senderEmail: fromEmail,
    missingEnvVars: missingVars,
    instructions: missingVars.length > 0
      ? `Set RESEND_API_KEY in your Vercel environment variables to enable email delivery. In development, OTP codes are logged to the server console.`
      : `Email delivery is fully configured via Resend (from: ${fromEmail}).`,
  }, "Auth system diagnostics");
});

export default router;
