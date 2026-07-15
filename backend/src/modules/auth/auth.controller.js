import { created, ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
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
import { requestOtp as requestOtpCode, verifyOtp } from "./otp.service.js";

function publicUser(user) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    companyId: user.companyId,
    name: user.name,
    email: user.email,
    phone: user.phone,
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
  await verifyOtp({ channel: "email", target: req.validated.body.ownerEmail, code: req.validated.body.emailOtp });
  if (req.validated.body.ownerPhone) {
    await verifyOtp({ channel: "phone", target: req.validated.body.ownerPhone, code: req.validated.body.phoneOtp });
  }
  const result = await registerTenant(req.validated.body, requestMeta(req));
  return created(
    res,
    {
      tenant: { id: result.tenant.id, name: result.tenant.name },
      company: { id: result.company.id, name: result.company.name },
      user: publicUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
    "Tenant registered successfully",
  );
});

export const requestOtp = asyncHandler(async (req, res) => {
  await requestOtpCode(req.validated.body);
  return ok(res, {}, "Verification code sent");
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.validated.body.email, req.validated.body.password, requestMeta(req));
  return ok(res, {
    user: publicUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  }, "Login successful");
});

export const refreshToken = asyncHandler(async (req, res) => {
  const result = await refreshAccessToken(req.validated.body.refreshToken, requestMeta(req));
  return ok(res, result, "Token refreshed");
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.body?.refreshToken;
  await logoutUser(token);
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
  await resetPassword(
    req.validated.body.email,
    req.validated.body.otp,
    req.validated.body.password,
  );
  return ok(res, {}, "Password reset successfully. Please login again.");
});

export const me = asyncHandler(async (req, res) => {
  const { getPrisma } = await import("../../config/db.js");
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
