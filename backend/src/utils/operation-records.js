import { z } from "zod";
import { getPrisma } from "../config/db.js";
import { created, ok } from "./api-response.js";
import { asyncHandler } from "./async-handler.js";
import { writeAudit } from "./audit.js";

export const operationSchema = z.object({
  body: z.object({
    documentNo: z.string().optional().or(z.literal("")),
    partyName: z.string().min(2),
    amount: z.coerce.number().min(0),
    status: z.enum(["DRAFT", "APPROVED", "CANCELLED", "CLOSED"]).default("DRAFT"),
    documentDate: z.string().optional(),
    notes: z.string().optional().or(z.literal("")),
  }),
});

export function listOperationRecords(documentType) {
  return asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const rows = await prisma.businessDocument.findMany({
      where: { tenantId: req.tenantId, companyId: req.companyId, documentType, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok(res, rows, "Records loaded");
  });
}

export function createOperationRecord(documentType) {
  return asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const amount = Math.round(Number(req.validated.body.amount) * 100);
    const row = await prisma.businessDocument.create({
      data: {
        tenantId: req.tenantId,
        companyId: req.companyId,
        branchId: req.branchId,
        documentType,
        documentNo: req.validated.body.documentNo || null,
        partyId: null,
        status: req.validated.body.status,
        documentDate: req.validated.body.documentDate ? new Date(req.validated.body.documentDate) : new Date(),
        subtotal: amount,
        taxableAmount: amount,
        totalAmount: amount,
        terms: JSON.stringify({ partyName: req.validated.body.partyName, notes: req.validated.body.notes || "" }),
        createdBy: req.user.sub,
        updatedBy: req.user.sub,
      },
    });
    await writeAudit(req, { tableName: "business_documents", recordId: row.id, action: `${documentType}_CREATED`, newValue: row });
    return created(res, row, "Record created");
  });
}

export function deleteOperationRecord(documentType) {
  return asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const row = await prisma.businessDocument.update({
      where: { id: req.params.id },
      data: { isDeleted: true, updatedBy: req.user.sub },
    });
    await writeAudit(req, { tableName: "business_documents", recordId: row.id, action: `${documentType}_DELETED`, newValue: row });
    return ok(res, row, "Record deleted");
  });
}
