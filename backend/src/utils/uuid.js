/**
 * UUID validation and sanitization utilities for the backend.
 *
 * ROOT CAUSE: Express route params arrive as plain strings. A frontend
 * navigating to `/customers/new` or clicking "Create" before selecting a
 * record can send "new", "create", "temp", "0", "", undefined, or null
 * as a route param.  Zod's `z.string().uuid()` catches some of these but
 * NOT all — and the ones that slip through crash Prisma with cryptic
 * "Invalid UUID" errors that bubble up to the user.
 *
 * This module provides:
 *   1. `safeUuid` -- a Zod preprocessor that cleans common sentinels.
 *   2. `isValidUuid` -- a pure validation check.
 *   3. `SENTINELS` -- the set of known-bad string values.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Known sentinel values that should NEVER be used as UUIDs.
 */
export const SENTINELS = new Set([
  "new", "create", "temp", "undefined", "null", "0",
  "NaN", "false", "true", "none", "empty",
]);

/**
 * Check whether a string is a well-formed UUID v4.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isValidUuid(value) {
  if (typeof value !== "string") return false;
  return UUID_RE.test(value);
}

/**
 * Check whether a value is a usable UUID (valid format AND not a sentinel).
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isUsableUuid(value) {
  if (value == null) return false;
  const str = String(value).trim();
  if (SENTINELS.has(str.toLowerCase())) return false;
  return UUID_RE.test(str);
}
