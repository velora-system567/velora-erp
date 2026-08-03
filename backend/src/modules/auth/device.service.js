/**
 * Device Management Service — Trusted devices, device tracking, device actions.
 *
 * Every login creates a device record. Users can:
 * - View all trusted devices
 * - Trust/untrust a device
 * - Remove a device
 * - Logout a specific device
 * - Logout all devices
 */
import { getPrisma } from "../../config/db.js";
import { writeAudit } from "../../utils/audit.js";

// ─── Device Info Parsing ────────────────────────────────────────────

export function parseDeviceInfo(userAgent) {
  if (!userAgent) return { browser: "Unknown", os: "Unknown", deviceType: "Desktop" };
  const ua = userAgent.toLowerCase();

  let browser = "Unknown";
  if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("opera") || ua.includes("opr")) browser = "Opera";

  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  let deviceType = "Desktop";
  if (ua.includes("mobile") || ua.includes("android")) deviceType = "Mobile";
  else if (ua.includes("ipad")) deviceType = "Tablet";

  const browserVersion = userAgent.match(/(?:Chrome|Firefox|Safari|Edge|Opera)\/([\d.]+)/)?.[1] || "";

  return {
    browser: `${browser}${browserVersion ? ` ${browserVersion}` : ""}`,
    os,
    deviceType,
  };
}

export function generateDeviceFingerprint(ip, userAgent, tenantId) {
  const crypto = require("crypto");
  return crypto.createHash("sha256")
    .update(`${ip}:${userAgent}:${tenantId}`)
    .digest("hex")
    .slice(0, 32);
}

// ─── Device CRUD ────────────────────────────────────────────────────

/**
 * Record a device on login. Creates or updates the device record.
 */
export async function recordDevice({ userId, tenantId, userAgent, ipAddress, location }) {
  const prisma = getPrisma();
  const info = parseDeviceInfo(userAgent);
  const fingerprint = generateDeviceFingerprint(ipAddress, userAgent, tenantId);

  // Check if device already exists
  const existing = await prisma.trustedDevice.findFirst({
    where: { userId, fingerprint, isRevoked: false },
  });

  if (existing) {
    await prisma.trustedDevice.update({
      where: { id: existing.id },
      data: { lastActiveAt: new Date(), ipAddress },
    });
    return existing;
  }

  const deviceName = generateDeviceName(info);
  return prisma.trustedDevice.create({
    data: {
      userId,
      tenantId,
      deviceName,
      browser: info.browser,
      operatingSystem: info.os,
      deviceType: info.deviceType,
      ipAddress,
      location: location || null,
      fingerprint,
      lastActiveAt: new Date(),
    },
  });
}

function generateDeviceName(info) {
  const parts = [];
  if (info.os !== "Unknown") parts.push(info.os);
  if (info.deviceType !== "Desktop") parts.push(info.deviceType);
  if (info.browser !== "Unknown") parts.push(info.browser.split(" ")[0]);
  return parts.join(" ") || "Unknown Device";
}

/**
 * Get all devices for a user.
 */
export async function getUserDevices(userId) {
  const prisma = getPrisma();
  return prisma.trustedDevice.findMany({
    where: { userId, isRevoked: false },
    orderBy: { lastActiveAt: "desc" },
  });
}

/**
 * Trust a device.
 */
export async function trustDevice(userId, deviceId) {
  const prisma = getPrisma();
  const device = await prisma.trustedDevice.findFirst({
    where: { id: deviceId, userId, isRevoked: false },
  });
  if (!device) {
    const err = new Error("Device not found");
    err.statusCode = 404;
    throw err;
  }

  return prisma.trustedDevice.update({
    where: { id: deviceId },
    data: { isTrusted: true },
  });
}

/**
 * Remove (revoke) a device.
 */
export async function removeDevice(userId, deviceId, req) {
  const prisma = getPrisma();
  const device = await prisma.trustedDevice.findFirst({
    where: { id: deviceId, userId, isRevoked: false },
  });
  if (!device) {
    const err = new Error("Device not found");
    err.statusCode = 404;
    throw err;
  }

  await prisma.trustedDevice.update({
    where: { id: deviceId },
    data: { isRevoked: true },
  });

  // Also revoke all refresh tokens for this device fingerprint
  await prisma.refreshToken.updateMany({
    where: { userId, deviceInfo: { contains: device.browser } },
    data: { revokedAt: new Date() },
  });

  if (req) {
    await writeAudit(req, {
      tableName: "trusted_devices",
      recordId: deviceId,
      action: "DEVICE_REMOVED",
      newValue: { deviceName: device.deviceName, browser: device.browser },
    }).catch(() => {});
  }

  return { success: true };
}

/**
 * Logout a specific device (revoke its refresh tokens).
 */
export async function logoutDevice(userId, deviceId, req) {
  const prisma = getPrisma();
  const device = await prisma.trustedDevice.findFirst({
    where: { id: deviceId, userId, isRevoked: false },
  });
  if (!device) {
    const err = new Error("Device not found");
    err.statusCode = 404;
    throw err;
  }

  // Revoke refresh tokens matching this device's IP or browser
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      OR: [
        { ipAddress: device.ipAddress },
        { deviceInfo: { contains: device.browser } },
      ],
    },
    data: { revokedAt: new Date() },
  });

  if (req) {
    await writeAudit(req, {
      tableName: "trusted_devices",
      recordId: deviceId,
      action: "DEVICE_LOGGED_OUT",
      newValue: { deviceName: device.deviceName },
    }).catch(() => {});
  }

  return { success: true };
}

/**
 * Logout all devices for a user.
 */
export async function logoutAllDevices(userId, req) {
  const prisma = getPrisma();

  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (req) {
    await writeAudit(req, {
      tableName: "trusted_devices",
      recordId: userId,
      action: "ALL_DEVICES_LOGGED_OUT",
    }).catch(() => {});
  }

  return { success: true };
}
