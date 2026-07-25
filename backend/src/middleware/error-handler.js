import { ZodError } from "zod";
import { fail } from "../utils/api-response.js";

export function notFound(req, res) {
  return fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

/**
 * Safely convert a ZodError into a user-friendly API response.
 *
 * ROOT CAUSE FIX: Previously this handler passed the raw ZodError issues
 * array in `data.issues`, and the frontend's errorFromPayload() re-formatted
 * them — producing messages like "id: Invalid UUID" instead of the friendly
 * "Invalid reference" message.  Now we only return the friendly message
 * string and never leak the raw Zod issue objects to the client.
 */
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof ZodError) {
    const friendlyMessages = error.issues.map((issue) => {
      const field = issue.path.filter((p) => typeof p === "string").join(".");
      if (issue.message === "Required") return `"${field}" is required`;
      if (issue.message.toLowerCase().includes("uuid")) return `"${field || "Field"}: invalid value — expected a valid reference`;
      if (issue.message.toLowerCase().includes("too big")) return `"${field}": value too large`;
      if (issue.message.toLowerCase().includes("too small")) return `"${field}": value too small`;
      if (issue.message === "Invalid input") return `"${field}": invalid value`;
      if (issue.code === "invalid_type") return `"${field}": expected ${issue.expected}, received ${issue.received}`;
      return issue.message;
    });
    const uniqueMsgs = [...new Set(friendlyMessages)];
    const message = uniqueMsgs.join(". ") || "Invalid input";
    // FIX: Do NOT pass raw Zod issues to the client. Only return the friendly message.
    return fail(res, 422, message);
  }

  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Something went wrong" : error.message;
  if (statusCode >= 500) console.error(error);
  return fail(res, statusCode, message);
}