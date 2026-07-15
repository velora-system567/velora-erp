import { getPrisma } from "../config/db.js";
import { getIndianFinancialYear } from "./financial-year.js";

/**
 * Atomically generates the next document number for a given type.
 * Format: PREFIX/FY/NNNNN  e.g. QT/2026-27/00001
 *
 * @param {Object} params
 * @param {import('@prisma/client').PrismaClient} [params.tx] - Optional transaction client
 * @param {string} params.tenantId
 * @param {string} params.companyId
 * @param {string} params.docType - e.g. "QT", "SO", "DN", "INV", "PO", "GRN", "JE", "RCPT", "PYMT"
 * @param {Date} [params.date]
 * @returns {Promise<string>}
 */
export async function nextDocNumber({ tx, tenantId, companyId, docType, date = new Date() }) {
  const client = tx || getPrisma();
  const fyYear = getIndianFinancialYear(date);

  const counter = await client.docNumberCounter.upsert({
    where: {
      tenantId_companyId_docType_fyYear: { tenantId, companyId, docType, fyYear },
    },
    update: { lastSeq: { increment: 1 } },
    create: { tenantId, companyId, docType, fyYear, lastSeq: 1 },
  });

  const seq = String(counter.lastSeq).padStart(5, "0");
  return `${docType}/${fyYear}/${seq}`;
}
