/**
 * Validates req.body / req.query / req.params against a Zod schema.
 * Attaches parsed values to req.validated.
 * Passes ZodError to error handler on failure (returns 422).
 *
 * FIX: Before schema parsing, sanitizes ALL params/query values that look
 * like UUIDs (keys ending in "Id", "id", or "uuid").  This prevents
 * sentinel values like "new", "create", "temp", "0", "" from ever
 * reaching Prisma's UUID column, which would throw a cryptic
 * "Invalid UUID" error.
 */
const _UUID_SENTINELS = new Set([
  "new", "create", "temp", "undefined", "null", "0",
  "NaN", "false", "true", "none", "empty",
]);

/**
 * Check whether a key name looks like it holds a UUID value.
 * Only matches keys ENDING with 'id', 'Id', or 'uuid' —
 * NOT keys that merely contain 'id' as a substring (e.g. 'page', 'valid', 'requested').
 * Matches: id, itemId, warehouseId, machineId, customerId, accountId, etc.
 */
const _UUID_KEY_RE = /(Id|id|uuid)$/;

function sanitizeUuidValue(value) {
  if (value == null) return value;
  const str = String(value).trim();
  if (_UUID_SENTINELS.has(str.toLowerCase())) return undefined;
  return value;
}

/**
 * Sanitize UUID-looking fields in an object.
 * Only touches params and query (never body — body is validated by Zod schemas).
 * Removes sentinel values entirely (sets to undefined) so Zod sees them as missing
 * and handles them with .optional() or .default() as appropriate.
 */
function sanitizeParams(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (_UUID_KEY_RE.test(key)) {
      const sanitized = sanitizeUuidValue(value);
      if (sanitized !== undefined) clean[key] = sanitized;
      // If sentinel detected, key is omitted → Zod sees undefined → falls to optional/default
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function validate(schema) {
  return (req, res, next) => {
    try {
      // Sanitize params and query BEFORE Zod parsing to prevent
      // sentinel values from reaching UUID validation / Prisma.
      const sanitizedParams = sanitizeParams(req.params);
      const sanitizedQuery = sanitizeParams(req.query);

      const parsed = schema.parse({
        body: req.body,
        query: sanitizedQuery,
        params: sanitizedParams,
      });
      req.validated = parsed;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// ─── UUID Preprocessor ─────────────────────────────────────────────────────
// Exported for use in individual Zod schemas when you want explicit
// sanitization on body fields (e.g. branchIds array).
const _SENTINELS = _UUID_SENTINELS;

export function sanitizeUuid(value) {
  if (value == null) return "";
  const str = String(value).trim();
  if (_SENTINELS.has(str.toLowerCase())) return "";
  return str;
}
