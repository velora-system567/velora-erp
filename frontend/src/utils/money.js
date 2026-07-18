/**
 * Velora ERP — Frontend Money Utility
 *
 * All monetary values are stored as PAISE (integer) in the DB.
 * Always use these helpers for display and conversion in the UI.
 */

/**
 * Converts rupees (float) to paise (integer) for API submission.
 * @param {number|string} rupees
 * @returns {number}
 */
export function rupeesToPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

/**
 * Converts paise (integer) to rupees (float, 2 decimals).
 * @param {number} paise
 * @returns {number}
 */
export function paiseToRupees(paise) {
  return Number((Number(paise) / 100).toFixed(2));
}

/**
 * Formats paise as ₹ string with Indian locale.
 * e.g. formatRupees(1250050) → "₹12,500.50"
 * @param {number} paise
 * @returns {string}
 */
export function formatRupees(paise) {
  return `₹${paiseToRupees(paise).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats paise as compact string for KPI cards.
 * e.g. 150000000 → "₹15.00 L"  (≥1 lakh)
 * e.g. 10000000000 → "₹100.00 Cr" (≥1 crore)
 * @param {number} paise
 * @returns {string}
 */
export function formatRupeesCompact(paise) {
  const rupees = paiseToRupees(paise);
  if (rupees >= 1e7) return `₹${(rupees / 1e7).toFixed(2)} Cr`;
  if (rupees >= 1e5) return `₹${(rupees / 1e5).toFixed(2)} L`;
  if (rupees >= 1e3) return `₹${(rupees / 1e3).toFixed(2)} K`;
  return `₹${rupees.toFixed(2)}`;
}

/**
 * Parses a rupee input string/number to paise.
 * Accepts "1,250.50", "1250.50", 1250.50
 * @param {string|number} input
 * @returns {number}
 */
export function parseRupeesToPaise(input) {
  const cleaned = String(input).replace(/[₹,\s]/g, "");
  return rupeesToPaise(parseFloat(cleaned) || 0);
}
