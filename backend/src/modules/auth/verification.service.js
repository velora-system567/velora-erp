/**
 * Email Verification Service
 *
 * Handles email verification via secure one-time tokens stored in the database.
 * Separate from OTP: uses DB-persisted tokens rather than Redis-based codes.
 */
import crypto from "crypto";
import { getPrisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { sendVerificationEmail, sendWelcomeEmail } from "../../utils/email.js";

const VERIFICATION_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function providerError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Creates a verification token and sends the verification email.
 * Called after user registration.
 */
export async function sendEmailVerification(userId, email) {
  const prisma = getPrisma();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL);

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  await sendVerificationEmail({
    to: email,
    code: token.slice(0, 6).toUpperCase(), // First 6 hex chars as user-friendly code
  });

  return { expiresInHours: 24 };
}

/**
 * Verifies an email using the token.
 * Token is one-time: deleted/hidden after use.
 */
export async function verifyEmail(token) {
  const prisma = getPrisma();
  const tokenHash = hashToken(token);

  const record = await prisma.emailVerificationToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
  });

  if (!record) {
    throw providerError("Verification link is invalid or has expired. Please request a new one.", 422);
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  // Send welcome email
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (user) {
    await sendWelcomeEmail({ to: user.email, name: user.name }).catch((err) => console.error("[auth] Welcome email error:", err.message));
  }

  return true;
}

/**
 * Resends verification email.
 * Revokes old tokens and creates a new one.
 */
export async function resendVerification(userId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw providerError("User not found", 404);
  if (user.emailVerifiedAt) throw providerError("Email is already verified", 422);

  // Revoke old tokens
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  return sendEmailVerification(userId, user.email);
}

/**
 * Checks if a user's email is verified.
 */
export async function isEmailVerified(userId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  return !!user?.emailVerifiedAt;
}
