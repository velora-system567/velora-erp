/**
 * Velora ERP — Centralized Money Utility
 *
 * All monetary values are stored in PAISE (smallest INR unit, integer).
 * Display always uses paiseToRupees() or formatRupees().
 * Input from UI always uses rupeesToPaise() before persisting.
 */

/**
 * Converts rupees (float) to paise (integer) for storage.
 * @param {number|string} rupees
 * @returns {number} Integer paise
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
 * Formats paise as a human-readable Indian Rupee string.
 * e.g. 1250050 → "₹12,500.50"
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
 * Adds two paise amounts safely.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function addPaise(a, b) {
  return Math.round(Number(a) + Number(b));
}

/**
 * Subtracts paise amounts safely.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function subtractPaise(a, b) {
  return Math.round(Number(a) - Number(b));
}

/**
 * Multiplies paise by a scalar (e.g. quantity × rate).
 * @param {number} paise
 * @param {number} scalar
 * @returns {number} Integer paise
 */
export function multiplyPaise(paise, scalar) {
  return Math.round(Number(paise) * Number(scalar));
}

/**
 * Calculates line total in paise: quantity × rate − discount.
 * @param {number} quantity
 * @param {number} ratePaise
 * @param {number} discountPaise
 * @returns {number}
 */
export function lineTotal(quantity, ratePaise, discountPaise = 0) {
  return Math.round(Number(quantity) * Number(ratePaise) - Number(discountPaise));
}

/**
 * Round-off paise to nearest rupee (standard Indian invoice practice).
 * Returns { rounded, roundOff } where roundOff is the paise adjustment.
 * @param {number} totalPaise
 * @returns {{ rounded: number, roundOff: number }}
 */
export function applyRoundOff(totalPaise) {
  const rounded = Math.round(totalPaise / 100) * 100;
  return { rounded, roundOff: rounded - totalPaise };
}

/**
 * Computes full document totals from line items.
 * Each line must have: { quantity, ratePaise, discountPaise?, gstRate }
 * Returns all amounts in paise.
 * @param {Array<{quantity: number, ratePaise: number, discountPaise?: number, gstRate: number}>} lines
 * @param {"INTRA_STATE"|"INTER_STATE"} gstTreatment
 * @returns {{
 *   subtotal: number, discount: number, taxableAmount: number,
 *   cgstAmount: number, sgstAmount: number, igstAmount: number,
 *   roundOff: number, totalAmount: number
 * }}
 */
export function computeDocumentTotals(lines, gstTreatment = "INTRA_STATE") {
  let subtotal = 0;
  let totalDiscount = 0;

  for (const line of lines) {
    const gross = Math.round(Number(line.quantity) * Number(line.ratePaise));
    const disc = Number(line.discountPaise || 0);
    subtotal += gross;
    totalDiscount += disc;
  }

  const taxableAmount = subtotal - totalDiscount;

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  for (const line of lines) {
    const gross = Math.round(Number(line.quantity) * Number(line.ratePaise));
    const disc = Number(line.discountPaise || 0);
    const taxable = gross - disc;
    const gst = Math.round((taxable * Number(line.gstRate)) / 100);
    if (gstTreatment === "INTER_STATE") {
      igstAmount += gst;
    } else {
      const half = Math.round(gst / 2);
      cgstAmount += half;
      sgstAmount += gst - half;
    }
  }

  const preTax = taxableAmount + cgstAmount + sgstAmount + igstAmount;
  const { rounded: totalAmount, roundOff } = applyRoundOff(preTax);

  return {
    subtotal,
    discount: totalDiscount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    roundOff,
    totalAmount,
  };
}
