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

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, tenantId: user.tenantId, companyId: user.companyId, email: user.email },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN },
  );
}

async function storeRefreshToken(prisma, { userId, tenantId, token, deviceInfo, ipAddress }) {
  const payload = jwt.decode(token);
  const expiresAt = new Date(payload.exp * 1000);
  await prisma.refreshToken.create({
    data: {
      userId,
      tenantId,
      tokenHash: hashToken(token),
      deviceInfo: deviceInfo || null,
      ipAddress: ipAddress || null,
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
    const refreshToken = signRefreshToken(owner);

    await storeRefreshToken(tx, {
      userId: owner.id,
      tenantId: tenant.id,
      token: refreshToken,
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

export async function loginUser(email, password, meta = {}) {
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

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await storeRefreshToken(prisma, {
    userId: user.id,
    tenantId: user.tenantId,
    token: refreshToken,
    deviceInfo: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  return { user, accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken, meta = {}) {
  // Check Redis blacklist first
  const redis = getRedis();
  const isBlacklisted = await redis.get(`rt:blacklist:${hashToken(refreshToken)}`);
  if (isBlacklisted) {
    const error = new Error("Token has been revoked");
    error.statusCode = 401;
    throw error;
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

  // Rotate: revoke old token, issue new one
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revokedAt: new Date() },
  });

  const newRefreshToken = signRefreshToken(user);
  await storeRefreshToken(prisma, {
    userId: user.id,
    tenantId: user.tenantId,
    token: newRefreshToken,
    deviceInfo: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken: newRefreshToken,
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
  await requestOtp({ channel: "email", target: email });
}

export async function resetPassword(email, otp, newPassword) {
  const { verifyOtp } = await import("./otp.service.js");
  await verifyOtp({ channel: "email", target: email, code: otp });

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
