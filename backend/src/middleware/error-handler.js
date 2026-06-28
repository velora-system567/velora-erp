import { ZodError } from "zod";
import { fail } from "../utils/api-response.js";

export function notFound(req, res) {
  return fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof ZodError) {
    return fail(res, 422, "Validation failed", { issues: error.issues });
  }

  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Internal server error" : error.message;
  if (statusCode >= 500) console.error(error);
  return fail(res, statusCode, message);
}
