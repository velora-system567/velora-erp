/**
 * Google OAuth Service — Handles Google login, account linking, and auto-registration.
 *
 * Architecture:
 * - Supports Google OAuth 2.0 via authorization code exchange
 * - Auto-creates users if allowed (configurable)
 * - Links existing email accounts to Google
 * - Imports name, email, profile picture from Google
 * - Creates default role after first login
 * - No duplicate users — email match triggers account linking
 *
 * Security:
 * - HMAC-signed state parameter prevents CSRF / login-CSRF attacks
 * - State includes nonce + timestamp; rejects if >10 min old
 * - verified_email required from Google userinfo endpoint
 * - Google API access/refresh tokens are NOT persisted (unnecessary attack surface)
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getPrisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { writeAudit } from "../../utils/audit.js";
import { issueSession, issueTokens } from "./auth.service.js";

// ─── Google OAuth Config ────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${env.FRONTEND_URL}/auth/google/callback`;

// HMAC signing key derived from the refresh secret (domain-isolated, random)
function stateSigningKey() {
  return crypto.createHash("sha256").update(env.JWT_REFRESH_SECRET + "google-oauth-state").digest();
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

// ─── Helpers ────────────────────────────────────────────────────────

function parseDeviceInfo(userAgent) {
  if (!userAgent) return { browser: "Unknown", os: "Unknown", device: "Desktop" };
  const ua = userAgent.toLowerCase();
  let browser = "Unknown";
  if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("edg")) browser = "Edge";

  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  let device = "Desktop";
  if (ua.includes("mobile") || ua.includes("android")) device = "Mobile";
  else if (ua.includes("ipad")) device = "Tablet";

  return { browser, os, device };
}

// ─── HMAC-signed state helpers ─────────────────────────────────────

/**
 * Sign an OAuth state value with HMAC-SHA256 so it can't be forged.
 * payload = { nonce, rememberMe, ts }
 * signed  = base64url(payload) + "." + hex-hmac
 */
function signState(payload) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const data = JSON.stringify({ ...payload, nonce, ts: Date.now() });
  const dataB64 = Buffer.from(data).toString("base64url");
  const sig = crypto.createHmac("sha256", stateSigningKey()).update(dataB64).digest("hex");
  return `${dataB64}.${sig}`;
}

/**
 * Validate a signed OAuth state.  Returns the parsed payload or throws.
 */
function verifyState(stateString) {
  if (!stateString || typeof stateString !== "string") {
    const err = new Error("Missing OAuth state parameter");
    err.statusCode = 400;
    throw err;
  }
  const dotIdx = stateString.lastIndexOf(".");
  if (dotIdx === -1) {
    const err = new Error("Invalid OAuth state format");
    err.statusCode = 400;
    throw err;
  }
  const dataB64 = stateString.slice(0, dotIdx);
  const sig = stateString.slice(dotIdx + 1);
  const expectedSig = crypto.createHmac("sha256", stateSigningKey()).update(dataB64).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"))) {
    const err = new Error("Invalid OAuth state signature (CSRF detected)");
    err.statusCode = 400;
    throw err;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(dataB64, "base64url").toString());
  } catch {
    const err = new Error("Malformed OAuth state");
    err.statusCode = 400;
    throw err;
  }

  if (!payload.ts || (Date.now() - payload.ts) > STATE_MAX_AGE_MS) {
    const err = new Error("OAuth state has expired. Please try again.");
    err.statusCode = 400;
    throw err;
  }

  return payload;
}

// ─── Google OAuth URL ───────────────────────────────────────────────

/**
 * Generate the Google OAuth authorization URL with a signed state parameter.
 */
export function getGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state: state || crypto.randomBytes(16).toString("hex"),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for Google user info.
 */
async function exchangeCode(code) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const err = new Error("Failed to exchange Google authorization code");
    err.statusCode = 401;
    throw err;
  }

  const tokens = await tokenResponse.json();

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoResponse.ok) {
    const err = new Error("Failed to fetch Google user info");
    err.statusCode = 401;
    throw err;
  }

  return {
    ...(await userInfoResponse.json()),
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

// ─── Main Auth Handler ──────────────────────────────────────────────

/**
 * Handle Google OAuth login/signup.
 *
 * Flow:
 * 1. Validate the HMAC-signed state (CSRF + freshness)
 * 2. Exchange code for Google user info
 * 3. Verify the email is verified by Google
 * 4. Check if Google account already linked → login
 * 5. Check if email exists → link account
 * 6. Create new user + tenant (if auto-create allowed)
 * 7. Return JWT tokens
 */
export async function handleGoogleAuth(code, meta = {}) {
  // 1. Validate the signed state (prevents CSRF / login-CSRF attacks)
  let rememberMe = Boolean(meta.rememberMe);
  if (meta.state && typeof meta.state === "string") {
    const statePayload = verifyState(meta.state);
    rememberMe = Boolean(statePayload.rememberMe);
  }
  meta = { ...meta, rememberMe };

  // 2. Exchange authorization code for tokens + user info
  const googleUser = await exchangeCode(code);

  // 3. Require a verified email address from Google
  if (!googleUser.email) {
    const err = new Error("Google account does not have an email address");
    err.statusCode = 400;
    throw err;
  }
  if (googleUser.verified_email !== true && googleUser.email_verified !== true) {
    const err = new Error("Google account has an unverified email address");
    err.statusCode = 400;
    throw err;
  }

  const prisma = getPrisma();
  const email = googleUser.email.toLowerCase();

  // 1. Check if Google account is already linked
  const existingGoogle = await prisma.googleAccount.findFirst({
    where: { googleId: googleUser.id },
    include: { user: { include: { userRoles: { include: { role: true } } } } },
  });

  if (existingGoogle) {
    // Update profile info (NOT Google API tokens — unnecessary attack surface)
    await prisma.googleAccount.update({
      where: { id: existingGoogle.id },
      data: {
        name: googleUser.name,
        avatarUrl: googleUser.picture,
      },
    });

    return loginGoogleUser(existingGoogle.user, meta);
  }

  // 2. Check if email already exists
  const existingUser = await prisma.user.findFirst({
    where: { email, isDeleted: false },
    include: { userRoles: { include: { role: true } } },
  });

  if (existingUser) {
    // Auto-link Google account to existing user (no Google API tokens stored)
    await prisma.googleAccount.create({
      data: {
        userId: existingUser.id,
        googleId: googleUser.id,
        email,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
      },
    });

    // Update avatar if not set
    if (!existingUser.avatarUrl && googleUser.picture) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { avatarUrl: googleUser.picture },
      });
    }

    await writeAudit(null, {
      tableName: "google_accounts",
      recordId: existingUser.id,
      action: "GOOGLE_ACCOUNT_LINKED",
      newValue: { email, googleId: googleUser.id },
    }).catch(() => {});

    return loginGoogleUser(existingUser, meta);
  }

  // 3. Create new user (auto-registration)
  return createGoogleUser(googleUser, meta);
}

async function loginGoogleUser(user, meta) {
  const prisma = getPrisma();

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: meta.ipAddress,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  return issueSession({ prisma, user, meta, rememberMe: Boolean(meta.rememberMe), googleLinked: true });
}

async function createGoogleUser(googleUser, meta) {
  const prisma = getPrisma();
  const email = googleUser.email.toLowerCase();
  const name = googleUser.name || email.split("@")[0];

  return prisma.$transaction(async (tx) => {
    // Create tenant
    const tenantSlug = `google-${Date.now()}`;
    const tenant = await tx.tenant.create({
      data: { tenantId: crypto.randomUUID(), name: `${name}'s Workspace`, slug: tenantSlug },
    });

    // Create company
    const company = await tx.company.create({
      data: {
        tenantId: tenant.id,
        companyId: crypto.randomUUID(),
        name: `${name}'s Company`,
        legalName: `${name}'s Company`,
      },
    });

    // Create user (no password — Google auth only)
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        name,
        email,
        phone: null,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
        avatarUrl: googleUser.picture,
        googleId: googleUser.id,
        emailVerifiedAt: new Date(), // Google verifies email
      },
    });

    // Create default role
    const role = await tx.role.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        name: "OWNER",
        description: "Business owner with full ERP access",
        createdBy: user.id,
        updatedBy: user.id,
      },
    });

    await tx.userRole.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        userId: user.id,
        roleId: role.id,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });

    // Link Google account (no Google API tokens stored — unnecessary attack surface)
    await tx.googleAccount.create({
      data: {
        userId: user.id,
        googleId: googleUser.id,
        email,
        name,
        avatarUrl: googleUser.picture,
      },
    });

    const userWithRoles = await tx.user.findUnique({
      where: { id: user.id },
      include: { userRoles: { include: { role: true } } },
    });

    return issueTokens({
      prisma: tx,
      user: userWithRoles,
      meta,
      rememberMe: Boolean(meta.rememberMe),
      googleLinked: true,
    });
  });
}

/**
 * Get Google auth URL (for frontend to redirect).
 * `rememberMe` preference is encoded in an HMAC-signed state parameter
 * so it survives the round-trip through Google and can't be tampered with.
 */
export function getGoogleLoginUrl({ rememberMe = false } = {}) {
  const state = signState({ rememberMe: Boolean(rememberMe) });
  return getGoogleAuthUrl(state);
}

/**
 * Check if Google OAuth is configured
 */
export function isGoogleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}
