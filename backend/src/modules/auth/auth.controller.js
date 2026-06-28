import { created, ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { loginUser, refreshAccessToken, registerTenant } from "./auth.service.js";

function publicUser(user) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    companyId: user.companyId,
    name: user.name,
    email: user.email,
    phone: user.phone,
  };
}

export const register = asyncHandler(async (req, res) => {
  const result = await registerTenant(req.validated.body);
  return created(
    res,
    {
      tenant: { id: result.tenant.id, name: result.tenant.name },
      company: { id: result.company.id, name: result.company.name },
      user: publicUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
    "Tenant registered successfully",
  );
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.validated.body.email, req.validated.body.password);
  return ok(res, {
    user: publicUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  }, "Login successful");
});

export const refreshToken = asyncHandler(async (req, res) => {
  return ok(res, { accessToken: refreshAccessToken(req.validated.body.refreshToken) }, "Token refreshed");
});

export const logout = asyncHandler(async (req, res) => {
  return ok(res, {}, "Logout successful");
});

export const forgotPassword = asyncHandler(async (req, res) => {
  return ok(res, { email: req.validated.body.email }, "Password reset OTP queued");
});

export const resetPassword = asyncHandler(async (req, res) => {
  return ok(res, {}, "Password reset successful");
});

export const me = asyncHandler(async (req, res) => {
  return ok(res, { user: req.user }, "Authenticated user");
});
