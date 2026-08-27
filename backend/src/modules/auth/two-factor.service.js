/**
 * Two-Factor Authentication (TOTP) Service
 *
 * Production-grade TOTP-based 2FA built on otplib 13.
 * - Generates a base32 TOTP secret + otpauth:// provisioning URI (QR).
 * - Verifies TOTP codes (with a window to tolerate clock drift).
 * - Generates single-use recovery codes, stored hashed (sha256 — safe because
 *   recovery codes are high-entropy random tokens).
 * - Manages the 2FA enable/disable lifecycle and the short-lived 2FA challenge.
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { generateSecret, generateURI, verifySync } from "otplib";
import { env } from "../../config/env.js";

const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_LENGTH = 10; // characters

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Generate a fresh TOTP secret + provisioning URI for QR scanning.
 * @param {object} user - must include email (account label)
 */
export function createTotpSetup(user) {
  const secret = generateSecret();
  const account = user.email || user.id;
  const otpauth = generateURI({
    issuer: "Velora ERP",
    label: account,
    secret,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return { secret, otpauth };
}

/**
 * Verify a TOTP code against a secret. Tolerates ±1 step clock drift.
 */
export function verifyTotp(code, secret) {
  if (!secret || !code) return false;
  const trimmed = String(code).replace(/\s/g, "");
  if (!/^\d{6}$/.test(trimmed)) return false;
  try {
    const result = verifySync({
      secret,
      token: trimmed,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      epochTolerance: 1,
    });
    return Boolean(result && result.valid);
  } catch {
    return false;
  }
}

/**
 * Generate a set of recovery codes for the user.
 * Returns the plaintext codes (shown once) and stores their hashes.
 */
export function generateRecoveryCodes() {
  const codes = [];
  const hashes = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = crypto.randomBytes(RECOVERY_CODE_LENGTH)
      .toString("base64")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, RECOVERY_CODE_LENGTH)
      .toUpperCase();
    codes.push(code);
    hashes.push(sha256(code));
  }
  return { codes, hashes };
}

/**
 * Validate a recovery code against the stored (JSON array of hashed) codes.
 * Consumes the code if valid (single-use).
 */
export function consumeRecoveryCode(recoveryCodesHash, code) {
  if (!recoveryCodesHash) return { ok: false, remainingHashes: null };
  let hashes = [];
  try {
    hashes = JSON.parse(recoveryCodesHash);
  } catch {
    return { ok: false, remainingHashes: null };
  }
  const inputHash = sha256(String(code).trim().toUpperCase());
  const idx = hashes.findIndex((h) => h === inputHash);
  if (idx === -1) return { ok: false, remainingHashes: hashes };
  const remaining = hashes.filter((_, i) => i !== idx);
  return { ok: true, remainingHashes: remaining };
}

/**
 * Sign a short-lived 2FA challenge token. Issued after a user with 2FA enabled
 * passes the first factor (password or Google). NOT a full session token.
 */
export function signTwoFactorChallenge(user) {
  return jwt.sign(
    {
      sub: user.id,
      tenantId: user.tenantId,
      companyId: user.companyId,
      email: user.email,
      purpose: "2fa-challenge",
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.TWO_FACTOR_CHALLENGE_EXPIRES_IN },
  );
}

/**
 * Verify a 2FA challenge token. Returns the decoded payload or throws.
 */
export function verifyTwoFactorChallenge(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error("2FA verification session expired. Please login again.");
    err.statusCode = 401;
    throw err;
  }
  if (payload.purpose !== "2fa-challenge") {
    const err = new Error("Invalid 2FA verification session");
    err.statusCode = 401;
    throw err;
  }
  return payload;
}
