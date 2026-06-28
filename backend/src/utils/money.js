/**
 * Converts rupees to paise for integer-safe money storage.
 * @param {number} rupees Amount in INR rupees.
 * @returns {number} Amount in paise.
 */
export function rupeesToPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

/**
 * Converts paise to rupees for display.
 * @param {number} paise Amount in paise.
 * @returns {number} Amount in rupees.
 */
export function paiseToRupees(paise) {
  return Number((Number(paise) / 100).toFixed(2));
}
