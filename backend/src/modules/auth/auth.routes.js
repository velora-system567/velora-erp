import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/api-response.js";
import { checkConfig } from "../../utils/email.js";
import { env } from "../../config/env.js";
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

const router = Router();

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

// ─── Diagnostic endpoint ──────────────────────────────────────────
router.get("/diagnose", (req, res) => {
  const missingVars = checkConfig();

  ok(res, {
    nodeEnv: env.NODE_ENV,
    frontendUrl: env.FRONTEND_URL,
    emailConfigured: missingVars.length === 0,
    missingEnvVars: missingVars,
    instructions: missingVars.length > 0
      ? `Set ${missingVars.join(" and ")} in your Vercel environment variables or .env file to enable email delivery. In development, OTP codes are logged to the server console.`
      : "Email delivery is fully configured with Resend.",
  }, "Auth system diagnostics");
});

export default router;
