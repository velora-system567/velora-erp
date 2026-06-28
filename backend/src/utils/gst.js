/**
 * Calculates GST in paise using an Indian GST slab percentage.
 * @param {number} amountPaise Taxable amount in paise.
 * @param {number} gstRate GST rate percentage.
 * @returns {number} GST amount in paise.
 */
export function calculateGstPaise(amountPaise, gstRate) {
  return Math.round((Number(amountPaise) * Number(gstRate)) / 100);
}

/**
 * Splits GST into CGST/SGST for intra-state or IGST for inter-state invoices.
 * @param {number} gstAmountPaise Total GST amount in paise.
 * @param {"INTRA_STATE"|"INTER_STATE"} treatment GST treatment.
 * @returns {{cgst: number, sgst: number, igst: number}}
 */
export function splitGst(gstAmountPaise, treatment) {
  if (treatment === "INTER_STATE") return { cgst: 0, sgst: 0, igst: gstAmountPaise };
  const half = Math.round(gstAmountPaise / 2);
  return { cgst: half, sgst: gstAmountPaise - half, igst: 0 };
}
