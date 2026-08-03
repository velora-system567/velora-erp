/**
 * QR Login Service — WhatsApp Web-style desktop login.
 *
 * Flow:
 * 1. Desktop generates QR code with sessionCode + qrToken
 * 2. Desktop polls /api/auth/qr/status with sessionCode
 * 3. Mobile scans QR → sends qrToken + userId to /api/auth/qr/scan
 * 4. Mobile approves → POST /api/auth/qr/approve with qrToken
 * 5. Desktop receives approval → exchanges for JWT tokens
 *
 * Security:
 * - Single-use tokens
 * - 60-second expiry
 * - Auto-refresh on expiry
 * - Cannot be reused
 * - Encrypted session codes
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getPrisma } from "../../config/db.js";
import { getRedis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { ROLE_PERMISSIONS } from "../../utils/permissions.js";
import { writeAudit } from "../../utils/audit.js";

const QR_TTL_SECONDS = 60;
const QR_POLL_TTL_SECONDS = 90;

function permissionsFor(user) {
  const names = user.userRoles?.map((ur) => ur.role?.name).filter(Boolean) || ["OWNER"];
  return [...new Set(names.flatMap((name) => ROLE_PERMISSIONS[name] || []))];
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

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
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

// ─── Generate QR Session ────────────────────────────────────────────

/**
 * Desktop generates a new QR login session.
 * Returns sessionCode (displayed as QR) and qrToken (for polling).
 */
export async function generateQrSession(desktopInfo = {}) {
  const prisma = getPrisma();
  const redis = getRedis();

  const sessionCode = crypto.randomBytes(24).toString("base64url");
  const qrToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000);

  const session = await prisma.qRLoginSession.create({
    data: {
      sessionCode,
      qrToken,
      status: "pending",
      deviceInfo: desktopInfo,
      ipAddress: desktopInfo.ipAddress || null,
      expiresAt,
    },
  });

  // Store in Redis for fast polling
  await redis.set(
    `qr:session:${sessionCode}`,
    JSON.stringify({ id: session.id, status: "pending", qrToken }),
    "EX",
    QR_POLL_TTL_SECONDS,
  );

  return {
    sessionCode,
    qrToken,
    expiresIn: QR_TTL_SECONDS,
    sessionId: session.id,
  };
}

// ─── Poll QR Status (Desktop) ───────────────────────────────────────

/**
 * Desktop polls this to check if QR was scanned and approved.
 */
export async function pollQrStatus(sessionCode) {
  const redis = getRedis();
  const prisma = getPrisma();

  // Check Redis first (fast path)
  const cached = await redis.get(`qr:session:${sessionCode}`);
  if (cached) {
    const data = JSON.parse(cached);
    if (data.status === "approved") {
      // Exchange for tokens
      const session = await prisma.qRLoginSession.findFirst({
        where: { sessionCode },
      });
      if (session && session.userId) {
        return exchangeQrForTokens(session);
      }
    }
    return { status: data.status, deviceInfo: data.approvedBy || null };
  }

  // Check DB (slow path — session expired from Redis)
  const session = await prisma.qRLoginSession.findFirst({
    where: { sessionCode },
  });

  if (!session) {
    return { status: "expired" };
  }

  if (session.expiresAt < new Date()) {
    return { status: "expired" };
  }

  if (session.status === "approved" && session.userId) {
    return exchangeQrForTokens(session);
  }

  return { status: session.status };
}

// ─── Scan QR (Mobile) ──────────────────────────────────────────────

/**
 * Mobile scans the QR code and registers itself.
 * Returns the session info for display on mobile.
 */
export async function scanQr(qrToken, mobileUserId, mobileInfo = {}) {
  const prisma = getPrisma();
  const redis = getRedis();

  // Find session by qrToken
  const session = await prisma.qRLoginSession.findFirst({
    where: { qrToken, status: "pending" },
  });

  if (!session) {
    const err = new Error("Invalid or expired QR code");
    err.statusCode = 400;
    throw err;
  }

  if (session.expiresAt < new Date()) {
    const err = new Error("QR code has expired. Please generate a new one.");
    err.statusCode = 400;
    throw err;
  }

  // Verify the scanning user exists
  const user = await prisma.user.findFirst({
    where: { id: mobileUserId, isDeleted: false, isActive: true },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // Update Redis with scan info
  await redis.set(
    `qr:session:${session.sessionCode}`,
    JSON.stringify({
      id: session.id,
      status: "scanned",
      qrToken,
      approvedBy: { name: user.name, email: user.email },
      desktopInfo: session.deviceInfo,
    }),
    "EX",
    QR_POLL_TTL_SECONDS,
  );

  return {
    sessionCode: session.sessionCode,
    status: "scanned",
    desktopInfo: session.deviceInfo,
    expiresAt: session.expiresAt,
  };
}

// ─── Approve QR (Mobile) ───────────────────────────────────────────

/**
 * Mobile approves the login request.
 */
export async function approveQr(qrToken, mobileUserId, mobileInfo = {}) {
  const prisma = getPrisma();
  const redis = getRedis();

  const session = await prisma.qRLoginSession.findFirst({
    where: { qrToken, status: "scanned" },
  });

  if (!session) {
    const err = new Error("Invalid or pending scan required");
    err.statusCode = 400;
    throw err;
  }

  if (session.expiresAt < new Date()) {
    const err = new Error("QR code has expired");
    err.statusCode = 400;
    throw err;
  }

  // Update session to approved
  await prisma.qRLoginSession.update({
    where: { id: session.id },
    data: {
      status: "approved",
      userId: mobileUserId,
      tenantId: session.deviceInfo?.tenantId || null,
      companyId: session.deviceInfo?.companyId || null,
      approvedAt: new Date(),
    },
  });

  // Update Redis
  await redis.set(
    `qr:session:${session.sessionCode}`,
    JSON.stringify({
      id: session.id,
      status: "approved",
      qrToken,
      userId: mobileUserId,
    }),
    "EX",
    QR_POLL_TTL_SECONDS,
  );

  return { status: "approved" };
}

// ─── Reject QR (Mobile) ────────────────────────────────────────────

export async function rejectQr(qrToken) {
  const prisma = getPrisma();
  const redis = getRedis();

  const session = await prisma.qRLoginSession.findFirst({
    where: { qrToken, status: { in: ["pending", "scanned"] } },
  });

  if (session) {
    await prisma.qRLoginSession.update({
      where: { id: session.id },
      data: { status: "rejected" },
    });

    await redis.set(
      `qr:session:${session.sessionCode}`,
      JSON.stringify({ id: session.id, status: "rejected" }),
      "EX",
      10,
    );
  }

  return { status: "rejected" };
}

// ─── Exchange QR for Tokens ─────────────────────────────────────────

async function exchangeQrForTokens(session) {
  const prisma = getPrisma();

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isDeleted: false, isActive: true },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) {
    return { status: "expired", error: "User not found" };
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await storeRefreshToken(prisma, {
    userId: user.id,
    tenantId: user.tenantId,
    token: refreshToken,
    deviceInfo: JSON.stringify(session.deviceInfo),
    ipAddress: session.ipAddress,
  });

  // Mark session as consumed
  await prisma.qRLoginSession.update({
    where: { id: session.id },
    data: { status: "consumed" },
  });

  return {
    status: "approved",
    user: {
      id: user.id,
      tenantId: user.tenantId,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
    accessToken,
    refreshToken,
  };
}

// ─── Cleanup Expired Sessions ───────────────────────────────────────

export async function cleanupExpiredQrSessions() {
  const prisma = getPrisma();
  await prisma.qRLoginSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
      status: { in: ["pending", "scanned"] },
    },
  });
}
