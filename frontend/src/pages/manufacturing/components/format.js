/**
 * Formatting helpers for the Manufacturing module.
 */

/**
 * Formats a number with thousands separators.
 * e.g. formatNumber(11240) → "11,240"
 */
export function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

/**
 * Formats a percent value with optional decimal places.
 * e.g. formatPercent(78.4, 1) → "78.4%"
 */
export function formatPercent(value, decimals = 1) {
  return `${Number(value || 0).toFixed(decimals)}%`;
}

/**
 * Formats a cost in paise as a compact rupee string.
 * e.g. formatCostPaise(4500000) → "₹45,000"
 */
export function formatCostPaise(paise) {
  const rupees = paise / 100;
  if (rupees >= 1e7) return `₹${(rupees / 1e7).toFixed(2)} Cr`;
  if (rupees >= 1e5) return `₹${(rupees / 1e5).toFixed(2)} L`;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
