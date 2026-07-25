/**
 * Shared Zod UUID helpers for all backend route files.
 *
 * Usage:
 *   import { uuid, optionalUuid } from "../../utils/zod-uuid.js";
 *   const schema = z.object({ id: uuid() });
 *   const schema = z.object({ customerId: optionalUuid() });
 *
 * These helpers sanitize sentinel values ("new", "create", "temp", "0", "")
 * BEFORE the .uuid() validation runs, so they never reach Prisma with
 * a bad UUID that causes a cryptic "Invalid UUID" error.
 */
import { z } from "zod";
import { sanitizeUuid } from "../middleware/validate.js";

export function uuid() {
  return z.preprocess(sanitizeUuid, z.string().uuid());
}

export function optionalUuid() {
  return z.preprocess(sanitizeUuid, z.string().uuid()).optional();
}
