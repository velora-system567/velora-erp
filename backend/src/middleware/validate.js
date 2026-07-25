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
 * Matches: id, itemId, warehouseId, machineId, customerId, etc.
 */
const _UUID_KEY_RE = /\b(id|uuid)\b/i;

function sanitizeUuidValue(value) {
  if (value == null) return value;
  const str = String(value).trim();
  if (_UUID_SENTINELS.has(str.toLowerCase())) return undefined;
  return value;
}

/**
 * Recursively sanitize UUID-looking fields in an object.
 * Only touches params and query (never body — body is validated by Zod schemas).
 */
function sanitizeParams(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const clean = { ...obj };
  for (const [key, value] of Object.entries(clean)) {
    if (_UUID_KEY_RE.test(key)) {
      clean[key] = sanitizeUuidValue(value);
    } else if (Array.isArray(value)) {
      clean[key] = value.map((v) =>
        _UUID_KEY_RE.test(key) ? sanitizeUuidValue(v) : v
      );
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
