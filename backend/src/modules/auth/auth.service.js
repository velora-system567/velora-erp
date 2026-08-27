import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getPrisma } from "../../config/db.js";
import { getRedis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { ROLE_PERMISSIONS } from "../../utils/permissions.js";
import { seedChartOfAccounts } from "../accounts/accounting.service.js";

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function permissionsFor(user) {
  const names = user.userRoles?.map((ur) => ur.role?.name).filter(Boolean) || ["OWNER"];
  return [...new Set(names.flatMap((name) => ROLE_PERMISSIONS[name] || []))];
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      tenantId: user.tenantId,
      companyId: user.companyId,
      email: user.email,
      permissions: permissionsFor(user),
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN },
  );
}

/**
 * Resolve the refresh token lifetime + session type for a login.
 * - rememberMe=true  → "persistent" session, PERSISTENT_REFRESH_TOKEN_EXPIRES_IN (15d)
 * - rememberMe=false → "session" session, REFRESH_TOKEN_EXPIRES_IN (7d)
 */
function refreshLifetime(options = {}) {
  const persistent = Boolean(options.rememberMe) || options.sessionType === "persistent";
  if (persistent) return { sessionType: "persistent", expiresIn: env.PERSISTENT_REFRESH_TOKEN_EXPIRES_IN };
  return { sessionType: "session", expiresIn: env.REFRESH_TOKEN_EXPIRES_IN };
}

function signRefreshToken(user, options = {}) {
  const { sessionType, expiresIn } = refreshLifetime(options);
  const payload = {
    sub: user.id,
    tenantId: user.tenantId,
    companyId: user.companyId,
    email: user.email,
    sessionType,
  };
  let signOpts = { expiresIn };
  // Cap at an absolute expiry (prevents silent indefinite extension on rotation).
  if (options.expiresAt) {
    signOpts = { expiresIn: Math.max(0, Math.floor((options.expiresAt.getTime() - Date.now()) / 1000)) };
    if (signOpts.expiresIn <= 0) {
      const err = new Error("Session expired");
      err.statusCode = 401;
      throw err;
    }
  }
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, signOpts);
  const decoded = jwt.decode(token);
  return {
    token,
    sessionType,
    expiresAt: decoded?.exp ? new Date(decoded.exp * 1000) : null,
  };
}

async function storeRefreshToken(prisma, { userId, tenantId, token, sessionType, deviceInfo, ipAddress }) {
  const payload = jwt.decode(token);
  const expiresAt = new Date(payload.exp * 1000);
  await prisma.refreshToken.create({
    data: {
      userId,
      tenantId,
      tokenHash: hashToken(token),
      deviceInfo: deviceInfo || null,
      ipAddress: ipAddress || null,
      sessionType: sessionType || "session",
      expiresAt,
    },
  });
}

export async function registerTenant(input, meta = {}) {
  const prisma = getPrisma();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const companyName = input.companyName.trim();
  const tenantSlug = `${slugify(companyName)}-${Date.now()}`;

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { tenantId: crypto.randomUUID(), name: companyName, slug: tenantSlug },
    });

    const company = await tx.company.create({
      data: {
        tenantId: tenant.id,
        companyId: crypto.randomUUID(),
        name: companyName,
        legalName: companyName,
        gstin: input.gstin || null,
      },
    });

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        name: input.ownerName,
        email: input.ownerEmail.toLowerCase(),
        phone: input.ownerPhone || null,
        passwordHash,
      },
    });

    const role = await tx.role.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        name: "OWNER",
        description: "Business owner with full ERP access",
        createdBy: owner.id,
        updatedBy: owner.id,
      },
    });

    await tx.userRole.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        userId: owner.id,
        roleId: role.id,
        createdBy: owner.id,
        updatedBy: owner.id,
      },
    });

    // Seed default chart of accounts for new tenant
    await seedChartOfAccounts(tx, { tenantId: tenant.id, companyId: company.id, userId: owner.id });

    const userWithRoles = await tx.user.findUnique({
      where: { id: owner.id },
      include: { userRoles: { include: { role: true } } },
    });

    const accessToken = signAccessToken(userWithRoles);
    const { token: refreshToken, sessionType } = signRefreshToken(owner, { rememberMe: Boolean(meta.rememberMe) });

    await storeRefreshToken(tx, {
      userId: owner.id,
      tenantId: tenant.id,
      token: refreshToken,
      sessionType,
      deviceInfo: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    return {
      tenant,
      company,
      user: userWithRoles,
      accessToken,
      refreshToken,
    };
  });
}

export async function loginWithPhone(phone, meta = {}, password = null) {
  const prisma = getPrisma();
  const normalizedPhone = phone.replace(/[^\d+]/g, "");

  const where = { phone: { contains: normalizedPhone.slice(-10) }, isDeleted: false, isActive: true };

  // If password is provided, verify it
  if (password) {
    const user = await prisma.user.findFirst({
      where: { ...where, tenantId: meta.tenantId || undefined },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      const error = new Error("Invalid phone number or password");
      error.statusCode = 401;
      throw error;
    }
    return issueSession({ prisma, user, meta, rememberMe: meta.rememberMe });
  }

  // OTP login (no password) — find user by phone
  const user = await prisma.user.findFirst({
    where,
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) {
    const error = new Error("No account found with this phone number");
    error.statusCode = 404;
    throw error;
  }

  return issueSession({ prisma, user, meta, rememberMe: meta.rememberMe });
}

/**
 * Build and persist a new authenticated session (access + refresh tokens).
 * Used by password/phone/Google/2FA-complete login paths.
 * Returns "requiresTwoFactor" when the user has 2FA enabled (no tokens issued).
 */
async function issueSession({ prisma, user, meta = {}, rememberMe = false, googleLinked = false }) {
  if (user.twoFactorEnabled) {
    const { signTwoFactorChallenge } = await import("./two-factor.service.js");
    return {
      requiresTwoFactor: true,
      challengeToken: signTwoFactorChallenge(user),
      user: publicUserShape(user),
    };
  }
  return issueTokens({ prisma, user, meta, rememberMe, googleLinked });
}

async function issueTokens({ prisma, user, meta = {}, rememberMe = false, googleLinked = false }) {
  const accessToken = signAccessToken(user);
  const { token: refreshToken, sessionType, expiresAt } = signRefreshToken(user, { rememberMe });

  await storeRefreshToken(prisma, {
    userId: user.id,
    tenantId: user.tenantId,
    token: refreshToken,
    sessionType,
    deviceInfo: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  return {
    accessToken,
    refreshToken,
    sessionType,
    sessionExpiresAt: expiresAt ? expiresAt.toISOString() : null,
    user: publicUserShape(user),
  };
}

function publicUserShape(user) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    companyId: user.companyId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

export function userIsTwoFactorEnabled(user) {
  return Boolean(user && user.twoFactorEnabled);
}

export async function loginUser(email, password, meta = {}, rememberMe = false) {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), isDeleted: false, isActive: true },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  return issueSession({ prisma, user, meta, rememberMe });
}

export async function refreshAccessToken(refreshToken, meta = {}) {
  // Check Redis blacklist first — skip if Redis is unavailable
  try {
    const redis = getRedis();
    const isBlacklisted = await redis.get(`rt:blacklist:${hashToken(refreshToken)}`);
    if (isBlacklisted) {
      const error = new Error("Token has been revoked");
      error.statusCode = 401;
      throw error;
    }
  } catch (err) {
    if (err.statusCode === 401) throw err;
    // Redis unavailable — allow refresh (no blacklist check)
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    const error = new Error("Invalid or expired refresh token");
    error.statusCode = 401;
    throw error;
  }

  const prisma = getPrisma();
  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      tokenHash: hashToken(refreshToken),
      userId: payload.sub,
      revokedAt: null,
    },
  });

  if (!tokenRecord) {
    const error = new Error("Refresh token not found or already revoked");
    error.statusCode = 401;
    throw error;
  }

  if (tokenRecord.expiresAt < new Date()) {
    const error = new Error("Refresh token expired");
    error.statusCode = 401;
    throw error;
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, tenantId: payload.tenantId, isDeleted: false, isActive: true },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) {
    const error = new Error("User not found or inactive");
    error.statusCode = 401;
    throw error;
  }

  // Rotate: revoke old token, issue new one. Preserve the session type and cap
  // the new token at the ORIGINAL session expiry so the 15-day trusted window is
  // never silently extended by repeated refreshes.
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revokedAt: new Date() },
  });
  const preservingSessionType = tokenRecord.sessionType === "persistent" ? { rememberMe: true } : {};
  const { token: newRefreshToken, sessionType: newSessionType, expiresAt: newExpiresAt } = signRefreshToken(user, {
    ...preservingSessionType,
    expiresAt: tokenRecord.expiresAt,
  });
  await storeRefreshToken(prisma, {
    userId: user.id,
    tenantId: user.tenantId,
    token: newRefreshToken,
    sessionType: newSessionType,
    deviceInfo: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken: newRefreshToken,
    sessionType: newSessionType,
    sessionExpiresAt: newExpiresAt ? newExpiresAt.toISOString() : null,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
  };
}

export async function logoutUser(refreshToken) {
  if (!refreshToken) return;
  const prisma = getPrisma();
  const redis = getRedis();
  const hash = hashToken(refreshToken);

  // Revoke in DB
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // Add to Redis blacklist for remaining JWT lifetime
  try {
    const payload = jwt.decode(refreshToken);
    if (payload?.exp) {
      const ttl = payload.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await redis.set(`rt:blacklist:${hash}`, "1", "EX", ttl);
    }
  } catch {
    // non-critical
  }
}

export async function logoutAllDevices(userId) {
  const prisma = getPrisma();
  const redis = getRedis();

  const tokens = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null },
  });

  for (const t of tokens) {
    await redis.set(`rt:blacklist:${t.tokenHash}`, "1", "EX", 7 * 24 * 3600);
  }

  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getActiveSessions(userId) {
  const prisma = getPrisma();
  return prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      deviceInfo: true,
      ipAddress: true,
      sessionType: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function forgotPassword(email) {
  const prisma = getPrisma();
  const { requestOtp } = await import("./otp.service.js");
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), isDeleted: false, isActive: true },
  });
  if (!user) return; // Silent — don't expose if email exists
  await requestOtp({ target: email, purpose: "password-reset" });
}

export async function resetPassword(email, otp, newPassword) {
  const { verifyOtp } = await import("./otp.service.js");
  await verifyOtp({ target: email, code: otp });

  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), isDeleted: false, isActive: true },
  });
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, updatedBy: user.id },
  });

  // Revoke all sessions on password reset
  await logoutAllDevices(user.id);
}

/**
 * Complete the second-factor (TOTP or recovery code) verification and issue the
 * real authenticated session. The challenge token ties this to the login that
 * already passed the first factor.
 */
export async function completeTwoFactor({ challengeToken, code, meta = {}, rememberMe = false }) {
  const { verifyTwoFactorChallenge, verifyTotp, consumeRecoveryCode } = await import("./two-factor.service.js");
  const payload = verifyTwoFactorChallenge(challengeToken);

  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { id: payload.sub, tenantId: payload.tenantId, isDeleted: false, isActive: true },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user || !user.twoFactorEnabled) {
    const err = new Error("User not found or 2FA is not enabled");
    err.statusCode = 401;
    throw err;
  }

  const totpOk = verifyTotp(code, user.totpSecret);

  if (!totpOk) {
    const rec = consumeRecoveryCode(user.recoveryCodesHash, code);
    if (rec.ok) {
      await prisma.user.update({
        where: { id: user.id },
        data: { recoveryCodesHash: rec.remainingHashes ? JSON.stringify(rec.remainingHashes) : null },
      });
    } else {
      const err = new Error("Incorrect verification code. Please try again.");
      err.statusCode = 401;
      throw err;
    }
  }

  return issueTokens({ prisma, user, meta, rememberMe });
}

/**
 * Get the authenticated user's security profile (2FA status, recovery codes
 * remaining, google connection, session info). Used by the Security settings page.
 */
export async function getSecurityProfile(userId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      twoFactorEnabled: true,
      twoFactorMethod: true,
      recoveryCodesHash: true,
      googleId: true,
    },
  });
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }
  let recoveryCodesRemaining = 0;
  if (user.recoveryCodesHash) {
    try { recoveryCodesRemaining = JSON.parse(user.recoveryCodesHash).length; } catch {}
  }
  return {
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorMethod: user.twoFactorMethod,
    recoveryCodesRemaining,
    googleConnected: Boolean(user.googleId),
    hasPassword: true,
    email: user.email,
    name: user.name,
  };
}

