/**
 * Security Audit Service — Records all security-relevant events.
 *
 * Events tracked:
 * - Login (success/failure) via email, phone, Google, QR
 * - Logout (single device, all devices)
 * - Password change/reset
 * - 2FA enable/disable/verify
 * - Role changes
 * - Permission changes
 * - Device added/removed/trusted
 * - Account locked/unlocked
 * - QR login scan/approve/reject
 * - OTP request/verify
 * - Google account linked/unlinked
 *
 * Each event includes: user, timestamp, IP, user agent, device info, status, details
 */
import { getPrisma } from "../../config/db.js";

// ─── Action Constants ───────────────────────────────────────────────

export const SECURITY_ACTIONS = {
  // Authentication
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGIN_LOCKED: "LOGIN_LOCKED",
  LOGOUT: "LOGOUT",
  LOGOUT_ALL: "LOGOUT_ALL",
  TOKEN_REFRESH: "TOKEN_REFRESH",

  // Password
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  PASSWORD_RESET: "PASSWORD_RESET",
  PASSWORD_RESET_REQUEST: "PASSWORD_RESET_REQUEST",

  // 2FA
  TWO_FACTOR_ENABLE: "TWO_FACTOR_ENABLE",
  TWO_FACTOR_DISABLE: "TWO_FACTOR_DISABLE",
  TWO_FACTOR_VERIFY: "TWO_FACTOR_VERIFY",
  TWO_FACTOR_FAILED: "TWO_FACTOR_FAILED",

  // Google
  GOOGLE_LOGIN: "GOOGLE_LOGIN",
  GOOGLE_ACCOUNT_LINKED: "GOOGLE_ACCOUNT_LINKED",
  GOOGLE_ACCOUNT_UNLINKED: "GOOGLE_ACCOUNT_UNLINKED",

  // QR Login
  QR_LOGIN_GENERATED: "QR_LOGIN_GENERATED",
  QR_LOGIN_SCANNED: "QR_LOGIN_SCANNED",
  QR_LOGIN_APPROVED: "QR_LOGIN_APPROVED",
  QR_LOGIN_REJECTED: "QR_LOGIN_REJECTED",

  // Phone/OTP
  OTP_REQUESTED: "OTP_REQUESTED",
  OTP_VERIFIED: "OTP_VERIFIED",
  OTP_FAILED: "OTP_FAILED",
  PHONE_VERIFIED: "PHONE_VERIFIED",

  // Devices
  DEVICE_ADDED: "DEVICE_ADDED",
  DEVICE_TRUSTED: "DEVICE_TRUSTED",
  DEVICE_REMOVED: "DEVICE_REMOVED",
  DEVICE_LOGGED_OUT: "DEVICE_LOGGED_OUT",

  // Roles/Permissions
  ROLE_CREATED: "ROLE_CREATED",
  ROLE_UPDATED: "ROLE_UPDATED",
  ROLE_DELETED: "ROLE_DELETED",
  ROLE_ASSIGNED: "ROLE_ASSIGNED",
  ROLE_REMOVED: "ROLE_REMOVED",
  PERMISSION_CHANGED: "PERMISSION_CHANGED",

  // Account
  ACCOUNT_CREATED: "ACCOUNT_CREATED",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_UNLOCKED: "ACCOUNT_UNLOCKED",
  ACCOUNT_DEACTIVATED: "ACCOUNT_DEACTIVATED",
};

// ─── Categories ─────────────────────────────────────────────────────

export const ACTION_CATEGORIES = {
  // Auth events
  LOGIN_SUCCESS: "auth", LOGIN_FAILED: "auth", LOGIN_LOCKED: "auth",
  LOGOUT: "auth", LOGOUT_ALL: "auth", TOKEN_REFRESH: "auth",

  // Password events
  PASSWORD_CHANGE: "security", PASSWORD_RESET: "security", PASSWORD_RESET_REQUEST: "security",

  // 2FA events
  TWO_FACTOR_ENABLE: "security", TWO_FACTOR_DISABLE: "security",
  TWO_FACTOR_VERIFY: "security", TWO_FACTOR_FAILED: "security",

  // OAuth events
  GOOGLE_LOGIN: "auth", GOOGLE_ACCOUNT_LINKED: "security", GOOGLE_ACCOUNT_UNLINKED: "security",

  // QR events
  QR_LOGIN_GENERATED: "auth", QR_LOGIN_SCANNED: "auth",
  QR_LOGIN_APPROVED: "auth", QR_LOGIN_REJECTED: "auth",

  // OTP events
  OTP_REQUESTED: "auth", OTP_VERIFIED: "auth", OTP_FAILED: "auth", PHONE_VERIFIED: "security",

  // Device events
  DEVICE_ADDED: "security", DEVICE_TRUSTED: "security",
  DEVICE_REMOVED: "security", DEVICE_LOGGED_OUT: "security",

  // Admin events
  ROLE_CREATED: "admin", ROLE_UPDATED: "admin", ROLE_DELETED: "admin",
  ROLE_ASSIGNED: "admin", ROLE_REMOVED: "admin", PERMISSION_CHANGED: "admin",

  // Account events
  ACCOUNT_CREATED: "auth", ACCOUNT_LOCKED: "security",
  ACCOUNT_UNLOCKED: "security", ACCOUNT_DEACTIVATED: "security",
};

// ─── Status Mapping ─────────────────────────────────────────────────

const FAILURE_ACTIONS = new Set([
  SECURITY_ACTIONS.LOGIN_FAILED,
  SECURITY_ACTIONS.LOGIN_LOCKED,
  SECURITY_ACTIONS.TWO_FACTOR_FAILED,
  SECURITY_ACTIONS.OTP_FAILED,
]);

const WARNING_ACTIONS = new Set([
  SECURITY_ACTIONS.ACCOUNT_LOCKED,
  SECURITY_ACTIONS.ACCOUNT_DEACTIVATED,
  SECURITY_ACTIONS.ROLE_DELETED,
]);

// ─── Core Logging Function ──────────────────────────────────────────

/**
 * Write a security audit event.
 *
 * @param {Object} params
 * @param {string} params.action - One of SECURITY_ACTIONS
 * @param {string} params.userId - User ID (optional for pre-auth events)
 * @param {string} params.tenantId - Tenant ID
 * @param {string} [params.companyId] - Company ID
 * @param {Object} [params.details] - Additional event details
 * @param {string} [params.ipAddress] - Client IP
 * @param {string} [params.userAgent] - Client user agent
 * @param {string} [params.deviceInfo] - Device fingerprint/name
 * @param {string} [params.location] - Geo location
 */
export async function logSecurityEvent({
  action, userId, tenantId, companyId, details, ipAddress, userAgent, deviceInfo, location,
}) {
  const prisma = getPrisma();
  const category = ACTION_CATEGORIES[action] || "system";
  const status = FAILURE_ACTIONS.has(action) ? "failure"
    : WARNING_ACTIONS.has(action) ? "warning"
    : "success";

  return prisma.securityAuditLog.create({
    data: {
      tenantId,
      companyId: companyId || null,
      userId: userId || null,
      action,
      category,
      details: details || {},
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      deviceInfo: deviceInfo || null,
      location: location || null,
      status,
    },
  }).catch((err) => {
    console.error(`[security-audit] Failed to log ${action}:`, err.message);
  });
}

// ─── Convenience Wrappers ───────────────────────────────────────────

export function logLoginSuccess(req, { userId, tenantId, companyId, method }) {
  return logSecurityEvent({
    action: SECURITY_ACTIONS.LOGIN_SUCCESS,
    userId, tenantId, companyId,
    details: { method },
    ipAddress: req?.headers?.["x-forwarded-for"] || req?.ip,
    userAgent: req?.headers?.["user-agent"],
  });
}

export function logLoginFailed(req, { target, tenantId, reason }) {
  return logSecurityEvent({
    action: SECURITY_ACTIONS.LOGIN_FAILED,
    tenantId,
    details: { target, reason },
    ipAddress: req?.headers?.["x-forwarded-for"] || req?.ip,
    userAgent: req?.headers?.["user-agent"],
    status: "failure",
  });
}

export function logLogout(req, { userId, tenantId, companyId, deviceId }) {
  return logSecurityEvent({
    action: SECURITY_ACTIONS.LOGOUT,
    userId, tenantId, companyId,
    details: { deviceId },
    ipAddress: req?.headers?.["x-forwarded-for"] || req?.ip,
    userAgent: req?.headers?.["user-agent"],
  });
}

export function logPasswordChange(req, { userId, tenantId, companyId }) {
  return logSecurityEvent({
    action: SECURITY_ACTIONS.PASSWORD_CHANGE,
    userId, tenantId, companyId,
    ipAddress: req?.headers?.["x-forwarded-for"] || req?.ip,
    userAgent: req?.headers?.["user-agent"],
  });
}

// ─── Query Functions ────────────────────────────────────────────────

/**
 * Get security events for a tenant (admin dashboard).
 */
export async function getSecurityEvents(req, { limit = 50, offset = 0, action, category, userId, status }) {
  const prisma = getPrisma();
  const where = { tenantId: req.tenantId };
  if (action) where.action = action;
  if (category) where.category = category;
  if (userId) where.userId = userId;
  if (status) where.status = status;

  const [events, total] = await Promise.all([
    prisma.securityAuditLog.findMany({
      where,
      include: { /* user: { select: { name: true, email: true } } */ },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.securityAuditLog.count({ where }),
  ]);

  return { events, total, limit, offset };
}

/**
 * Get security summary for admin dashboard.
 */
export async function getSecuritySummary(req) {
  const prisma = getPrisma();
  const { tenantId } = req;
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalLogins24h,
    failedLogins24h,
    totalLogins7d,
    failedLogins7d,
    lockedAccounts,
    activeDevices,
    recentEvents,
    loginsByMethod,
  ] = await Promise.all([
    prisma.securityAuditLog.count({ where: { tenantId, action: "LOGIN_SUCCESS", createdAt: { gte: last24h } } }),
    prisma.securityAuditLog.count({ where: { tenantId, action: "LOGIN_FAILED", createdAt: { gte: last24h } } }),
    prisma.securityAuditLog.count({ where: { tenantId, action: "LOGIN_SUCCESS", createdAt: { gte: last7d } } }),
    prisma.securityAuditLog.count({ where: { tenantId, action: "LOGIN_FAILED", createdAt: { gte: last7d } } }),
    prisma.user.count({ where: { tenantId, lockedUntil: { gt: now }, isDeleted: false } }),
    prisma.trustedDevice.count({ where: { tenantId, isRevoked: false } }),
    prisma.securityAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.securityAuditLog.groupBy({
      by: ["action"],
      where: { tenantId, action: { in: ["LOGIN_SUCCESS", "LOGIN_FAILED", "GOOGLE_LOGIN", "QR_LOGIN_APPROVED"] }, createdAt: { gte: last7d } },
      _count: true,
    }),
  ]);

  return {
    logins24h: totalLogins24h,
    failedLogins24h,
    logins7d: totalLogins7d,
    failedLogins7d,
    lockedAccounts,
    activeDevices,
    recentEvents,
    loginsByMethod: loginsByMethod.map((l) => ({ action: l.action, count: l._count })),
    securityScore: calculateSecurityScore(failedLogins24h, lockedAccounts, totalLogins24h),
  };
}

function calculateSecurityScore(failed24h, locked, total24h) {
  let score = 100;
  if (failed24h > 10) score -= 20;
  else if (failed24h > 5) score -= 10;
  if (locked > 0) score -= 15;
  if (total24h === 0) score -= 5;
  return Math.max(0, Math.min(100, score));
}
