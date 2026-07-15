import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
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
} from "./auth.controller.js";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  requestOtpSchema,
  resetPasswordSchema,
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

export default router;
