/**
 * Returns the Indian financial year label for a date.
 * Indian financial year runs from April 1 to March 31.
 * @param {Date} date UTC date.
 * @returns {string} Label like 2026-27.
 */
export function getIndianFinancialYear(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}
