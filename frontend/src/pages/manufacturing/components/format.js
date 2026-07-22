/**
 * Formatting helpers for the Manufacturing module.
 * Note: For rupee formatting, use formatRupees / formatRupeesCompact from utils/money.js
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
