/**
 * UUID validation and guarding utilities.
 *
 * Prevents "Invalid UUID" errors by validating IDs before making API calls.
 * Used across every module (CRM, Inventory, Manufacturing, Finance, Sales,
 * Purchases, HR, KPIs, Dashboard, etc.) to ensure no API endpoint ever
 * receives an invalid UUID.
 *
 * Architecture improvement: Instead of duplicating validation logic in
 * every page, all UUID validation flows through this single utility.
 */

// RFC 4122 v4 UUID regex — matches the format Prisma generates.
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that a value is a well-formed UUID v4 string.
 *
 * @param {*} value - The value to validate.
 * @returns {boolean} true if the value is a valid UUID.
 *
 * @example
 *   isValidUuid("550e8400-e29b-41d4-a716-446655440000") // true
 *   isValidUuid("new")                                     // false
 *   isValidUuid("undefined")                                // false
 *   isValidUuid("")                                         // false
 *   isValidUuid(null)                                       // false
 *   isValidUuid(undefined)                                  // false
 */
export function isValidUuid(value) {
  if (typeof value !== "string") return false;
  return UUID_V4_RE.test(value);
}

/**
 * Values that should never be sent as a UUID to any API endpoint.
 * These are common sentinel values that UI code or routing may produce.
 */
const INVALID_UUID_SENTINELS = new Set([
  "new",
  "create",
  "temp",
  "undefined",
  "null",
  "0",
  "",
  "NaN",
  "false",
  "true",
  "none",
  "empty",
]);

/**
 * Validates that a value is a usable UUID for API calls.
 * Rejects both malformed UUIDs and common sentinel values.
 *
 * @param {*} value - The value to validate.
 * @returns {boolean} true if the value is a usable UUID.
 *
 * @example
 *   isUsableUuid("550e8400-e29b-41d4-a716-446655440000") // true
 *   isUsableUuid("new")                                     // false
 *   isUsableUuid("")                                         // false
 */
export function isUsableUuid(value) {
  if (value == null) return false;
  const str = String(value).trim();
  if (INVALID_UUID_SENTINELS.has(str.toLowerCase())) return false;
  return isValidUuid(str);
}

/**
 * Guard function: throws a descriptive error if the value is not a usable UUID.
 * Use this before every API call that requires a UUID parameter.
 *
 * @param {*} value - The value to guard.
 * @param {string} [context="id"] - Descriptive name for error messages (e.g. "customerId", "warehouseId").
 * @throws {Error} If the value is not a valid UUID.
 *
 * @example
 *   guardUuid(customerId, "customerId");
 *   await masterApi.get("customers", customerId);  // safe — will never hit "Invalid UUID"
 */
export function guardUuid(value, context = "id") {
  if (!isUsableUuid(value)) {
    throw new Error(
      `Cannot proceed: ${context} is missing or invalid. ` +
      `Got "${String(value)}". Please select a valid record first.`
    );
  }
}

/**
 * Returns the UUID if valid, or undefined if not.
 * Useful for optional UUID parameters where you want to skip the
 * API call entirely rather than error.
 *
 * @param {*} value - The value to sanitize.
 * @returns {string|undefined} The UUID string or undefined.
 *
 * @example
 *   const id = sanitizeUuid(selectedCustomerId);
 *   if (id) {
 *     await masterApi.get("customers", id);
 *   }
 */
export function sanitizeUuid(value) {
  return isUsableUuid(value) ? String(value).trim() : undefined;
}

/**
 * React Query `enabled` guard — returns true only when the UUID is valid.
 * Use this to prevent automatic queries from firing with invalid IDs.
 *
 * @param {*} value - The value to check.
 * @returns {boolean}
 *
 * @example
 *   const query = useQuery({
 *     queryKey: ["customer", id],
 *     queryFn: () => masterApi.get("customers", id),
 *     enabled: isValidQueryUuid(id),
 *   });
 */
export function isValidQueryUuid(value) {
  return isUsableUuid(value);
}

/**
 * Wrapper that catches UUID validation errors and returns a safe default.
 * Use inside TanStack Query queryFn or mutationFn callbacks.
 *
 * @param {Function} fn - The async function that may receive a UUID.
 * @param {*} fallback - Value to return if UUID is invalid.
 * @returns {Function} A safe wrapper function.
 *
 * @example
 *   const safeFn = safeUuidCall(
 *     (id) => masterApi.get("customers", id),
 *     { data: null }
 *   );
 *   // Will never throw "Invalid UUID" — returns fallback instead.
 */
export function safeUuidCall(fn, fallback = null) {
  return async (id, ...args) => {
    if (!isUsableUuid(id)) return fallback;
    return fn(id, ...args);
  };
}
