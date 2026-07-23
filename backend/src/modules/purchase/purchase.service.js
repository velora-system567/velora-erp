/**
 * Velora ERP — Purchase Service
 * Purchase Request → RFQ → Purchase Order → GRN → Vendor Bill → Payment
 */
import { getPrisma } from "../../config/db.js";
import { computeDocumentTotals, rupeesToPaise } from "../../utils/money.js";
import { nextDocNumber } from "../../utils/doc-number.js";
import { writeAudit } from "../../utils/audit.js";
import { postPurchaseInvoiceJournal, postPaymentJournal } from "../accounts/accounting.service.js";
import { creditStockFromGrn } from "../inventory/inventory.service.js";

// ─── Purchase Request ─────────────────────────────────────────────────────────

export async function createPurchaseRequest(req, input) {
  const prisma = getPrisma();
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;

  return prisma.$transaction(async (tx) => {
    const prNumber = await nextDocNumber({ tx, tenantId, companyId, docType: "PR" });
    const pr = await tx.purchaseRequest.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        prNumber,
        requiredBy: input.requiredBy ? new Date(input.requiredBy) : null,
        notes: input.notes || null,
        createdBy: userId, updatedBy: userId,
      },
    });
    await tx.purchaseRequestLine.createMany({
      data: input.lines.map((l) => ({
        tenantId, companyId,
        purchaseRequestId: pr.id,
        itemId: l.itemId,
        description: l.description || null,
        quantity: l.quantity,
        estimatedRate: rupeesToPaise(l.estimatedRate || 0),
      })),
    });
    await writeAudit(req, { tx, tableName: "purchase_requests", recordId: pr.id, action: "PR_CREATED", newValue: pr });
    return tx.purchaseRequest.findUnique({ where: { id: pr.id }, include: { lines: true } });
  });
}

export async function approvePurchaseRequest(req, prId) {
  const prisma = getPrisma();
  const pr = await prisma.purchaseRequest.update({
    where: { id: prId },
    data: { status: "APPROVED", updatedBy: req.user.sub },
  });
  await writeAudit(req, { tableName: "purchase_requests", recordId: pr.id, action: "PR_APPROVED", newValue: pr });
  return pr;
}

export async function listPurchaseRequests(req, { page = 1, limit = 20, status } = {}) {
  const prisma = getPrisma();
  const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false, ...(status ? { status } : {}) };
  const [total, rows] = await Promise.all([
    prisma.purchaseRequest.count({ where }),
    prisma.purchaseRequest.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" }, include: { lines: true } }),
  ]);
  return { rows, meta: { page, limit, total } };
}

// ─── RFQ ─────────────────────────────────────────────────────────────────────

export async function createRfq(req, input) {
  const prisma = getPrisma();
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;

  return prisma.$transaction(async (tx) => {
    const rfqNumber = await nextDocNumber({ tx, tenantId, companyId, docType: "RFQ" });
    const rfq = await tx.rfq.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        rfqNumber,
        vendorId: input.vendorId,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        notes: input.notes || null,
        status: "DRAFT",
        createdBy: userId, updatedBy: userId,
      },
    });
    await tx.rfqLine.createMany({
      data: input.lines.map((l) => ({
        tenantId, companyId,
        rfqId: rfq.id,
        itemId: l.itemId,
        description: l.description || null,
        quantity: l.quantity,
        quotedRate: rupeesToPaise(l.quotedRate || 0),
        gstRate: l.gstRate || 18,
      })),
    });
    await writeAudit(req, { tx, tableName: "rfqs", recordId: rfq.id, action: "RFQ_CREATED", newValue: rfq });
    return tx.rfq.findUnique({ where: { id: rfq.id }, include: { lines: true } });
  });
}

export async function listRfqs(req, { page = 1, limit = 20, status } = {}) {
  const prisma = getPrisma();
  const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false, ...(status ? { status } : {}) };
  const [total, rows] = await Promise.all([
    prisma.rfq.count({ where }),
    prisma.rfq.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" }, include: { lines: true } }),
  ]);
  return { rows, meta: { page, limit, total } };
}

// ─── Purchase Order ───────────────────────────────────────────────────────────

export async function createPurchaseOrder(req, input) {
  const prisma = getPrisma();
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;
  const gstTreatment = input.gstTreatment || "INTRA_STATE";

  const lines = input.lines.map((l) => ({ ...l, ratePaise: rupeesToPaise(l.rate), discountPaise: rupeesToPaise(l.discount || 0) }));
  const totals = computeDocumentTotals(lines, gstTreatment);

  return prisma.$transaction(async (tx) => {
    const documentNo = await nextDocNumber({ tx, tenantId, companyId, docType: "PO" });
    const po = await tx.businessDocument.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        documentType: "PURCHASE_ORDER",
        documentNo,
        partyId: input.vendorId || null,
        status: "DRAFT",
        documentDate: input.documentDate ? new Date(input.documentDate) : new Date(),
        ...totals,
        terms: input.terms || null,
        createdBy: userId, updatedBy: userId,
      },
    });
    await tx.businessDocumentLine.createMany({
      data: lines.map((l) => ({
        tenantId, companyId, branchId: branchId || null,
        documentId: po.id,
        itemId: l.itemId || null,
        description: l.description || null,
        quantity: l.quantity,
        rate: l.ratePaise,
        discount: l.discountPaise || 0,
        gstRate: l.gstRate,
        lineTotal: Math.round(l.quantity * l.ratePaise - (l.discountPaise || 0)),
        createdBy: userId, updatedBy: userId,
      })),
    });
    await writeAudit(req, { tx, tableName: "business_documents", recordId: po.id, action: "PURCHASE_ORDER_CREATED", newValue: po });
    return tx.businessDocument.findUnique({ where: { id: po.id }, include: { lines: true } });
  });
}

export async function listPurchaseDocs(req, docType, { page = 1, limit = 20, status } = {}) {
  const prisma = getPrisma();
  const where = { tenantId: req.tenantId, companyId: req.companyId, documentType: docType, isDeleted: false, ...(status ? { status } : {}) };
  const [total, rows] = await Promise.all([
    prisma.businessDocument.count({ where }),
    prisma.businessDocument.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" }, include: { lines: { where: { isDeleted: false } } } }),
  ]);
  return { rows, meta: { page, limit, total } };
}

// ─── Goods Receipt Note ───────────────────────────────────────────────────────

export async function createGrn(req, input) {
  const prisma = getPrisma();
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;

  return prisma.$transaction(async (tx) => {
    const grnNumber = await nextDocNumber({ tx, tenantId, companyId, docType: "GRN" });
    const grn = await tx.goodsReceiptNote.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        grnNumber,
        vendorId: input.vendorId,
        warehouseId: input.warehouseId,
        poId: input.poId || null,
        receiptDate: input.receiptDate ? new Date(input.receiptDate) : new Date(),
        status: "DRAFT",
        notes: input.notes || null,
        createdBy: userId, updatedBy: userId,
      },
    });
    await tx.goodsReceiptLine.createMany({
      data: input.lines.map((l) => ({
        tenantId, companyId,
        grnId: grn.id,
        itemId: l.itemId,
        orderedQty: l.orderedQty,
        receivedQty: l.receivedQty,
        acceptedQty: l.acceptedQty,
        rejectedQty: Number(l.receivedQty) - Number(l.acceptedQty),
        rate: rupeesToPaise(l.rate),
        gstRate: l.gstRate || 18,
        lineTotal: Math.round(Number(l.acceptedQty) * rupeesToPaise(l.rate)),
        batchNumber: l.batchNumber || null,
        expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
      })),
    });
    await writeAudit(req, { tx, tableName: "goods_receipt_notes", recordId: grn.id, action: "GRN_CREATED", newValue: grn });
    return tx.goodsReceiptNote.findUnique({ where: { id: grn.id }, include: { lines: true } });
  });
}

export async function approveGrn(req, grnId) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const grn = await tx.goodsReceiptNote.findFirst({
      where: { id: grnId, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
      include: { lines: { where: { isDeleted: false } } },
    });
    if (!grn) { const e = new Error("GRN not found"); e.statusCode = 404; throw e; }
    if (grn.status === "APPROVED") { const e = new Error("GRN already approved"); e.statusCode = 409; throw e; }

    // Credit stock for accepted quantities
    await creditStockFromGrn(tx, req, grn, grn.lines);

    const updated = await tx.goodsReceiptNote.update({
      where: { id: grnId },
      data: { status: "APPROVED", updatedBy: req.user.sub },
    });
    await writeAudit(req, { tx, tableName: "goods_receipt_notes", recordId: grnId, action: "GRN_APPROVED", newValue: updated });
    return updated;
  });
}

export async function listGrns(req, { page = 1, limit = 20, status } = {}) {
  const prisma = getPrisma();
  const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false, ...(status ? { status } : {}) };
  const [total, rows] = await Promise.all([
    prisma.goodsReceiptNote.count({ where }),
    prisma.goodsReceiptNote.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" }, include: { lines: true } }),
  ]);
  return { rows, meta: { page, limit, total } };
}

// ─── Purchase Invoice (Vendor Bill) ──────────────────────────────────────────

export async function createPurchaseInvoice(req, input) {
  const prisma = getPrisma();
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;
  const gstTreatment = input.gstTreatment || "INTRA_STATE";

  const lines = input.lines.map((l) => ({ ...l, ratePaise: rupeesToPaise(l.rate), discountPaise: rupeesToPaise(l.discount || 0) }));
  const totals = computeDocumentTotals(lines, gstTreatment);

  return prisma.$transaction(async (tx) => {
    const documentNo = await nextDocNumber({ tx, tenantId, companyId, docType: "PINV" });
    const invoice = await tx.businessDocument.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        documentType: "PURCHASE_INVOICE",
        documentNo,
        partyId: input.vendorId || null,
        status: "APPROVED",
        documentDate: input.documentDate ? new Date(input.documentDate) : new Date(),
        ...totals,
        terms: input.terms || null,
        createdBy: userId, updatedBy: userId,
      },
    });
    await tx.businessDocumentLine.createMany({
      data: lines.map((l) => ({
        tenantId, companyId, branchId: branchId || null,
        documentId: invoice.id,
        itemId: l.itemId || null,
        description: l.description || null,
        quantity: l.quantity,
        rate: l.ratePaise,
        discount: l.discountPaise || 0,
        gstRate: l.gstRate,
        lineTotal: Math.round(l.quantity * l.ratePaise - (l.discountPaise || 0)),
        createdBy: userId, updatedBy: userId,
      })),
    });
    await postPurchaseInvoiceJournal(tx, req, invoice, input.vendorId);
    await writeAudit(req, { tx, tableName: "business_documents", recordId: invoice.id, action: "PURCHASE_INVOICE_CREATED", newValue: invoice });
    return tx.businessDocument.findUnique({ where: { id: invoice.id }, include: { lines: true } });
  });
}

// ─── Vendor Payment ───────────────────────────────────────────────────────────

export async function recordVendorPayment(req, input) {
  const prisma = getPrisma();
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;
  const amountPaise = rupeesToPaise(input.amount);

  return prisma.$transaction(async (tx) => {
    const paymentNo = await nextDocNumber({ tx, tenantId, companyId, docType: "PYMT" });
    const payment = await tx.payment.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        paymentNumber: paymentNo,
        paymentType: "PAYMENT",
        partyId: input.vendorId || null,
        partyType: "VENDOR",
        amount: amountPaise,
        mode: input.mode,
        referenceNo: input.referenceNo || null,
        bankName: input.bankName || null,
        narration: input.narration || null,
        paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
        createdBy: userId, updatedBy: userId,
      },
    });
    if (input.allocations?.length) {
      await tx.paymentAllocation.createMany({
        data: input.allocations.map((a) => ({
          tenantId, companyId, branchId: branchId || null,
          paymentId: payment.id,
          documentId: a.invoiceId,
          amount: rupeesToPaise(a.amount),
          createdBy: userId, updatedBy: userId,
        })),
      });
    }
    await postPaymentJournal(tx, req, payment, "PAYMENT");
    await writeAudit(req, { tx, tableName: "payments", recordId: payment.id, action: "VENDOR_PAYMENT_CREATED", newValue: payment });
    return payment;
  });
}

export async function getPurchaseOutstanding(req) {
  const prisma = getPrisma();
  const invoices = await prisma.businessDocument.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "PURCHASE_INVOICE", status: { not: "CANCELLED" }, isDeleted: false },
    orderBy: { documentDate: "asc" },
  });
  const allocations = await prisma.paymentAllocation.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
  });
  const paidMap = new Map();
  for (const a of allocations) paidMap.set(a.documentId, (paidMap.get(a.documentId) || 0) + a.amount);
  return invoices.map((inv) => ({
    id: inv.id, documentNo: inv.documentNo, documentDate: inv.documentDate, partyId: inv.partyId,
    totalAmount: inv.totalAmount, paidAmount: paidMap.get(inv.id) || 0,
    outstandingAmount: inv.totalAmount - (paidMap.get(inv.id) || 0),
    agingDays: Math.floor((Date.now() - new Date(inv.documentDate).getTime()) / 86400000),
  }));
}


// ─── Purchase Dashboard ─────────────────────────────────────────────────────

export async function getPurchaseDashboard(req) {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const poWhere = { tenantId, companyId, documentType: "PURCHASE_ORDER", isDeleted: false };
  const payWhere = { tenantId, companyId, paymentType: "PAYMENT", isDeleted: false };

  const [totalPOs, pendingPOs, draftPOs, approvedPOs, monthlyPOs, totalGrns, monthlyPayments, vendorCount, topVendors, recentActivity] = await Promise.all([
    prisma.businessDocument.count({ where: poWhere }),
    prisma.businessDocument.count({ where: { ...poWhere, status: { in: ["DRAFT", "SUBMITTED"] } } }),
    prisma.businessDocument.count({ where: { ...poWhere, status: "DRAFT" } }),
    prisma.businessDocument.count({ where: { ...poWhere, status: "APPROVED" } }),
    prisma.businessDocument.aggregate({ where: { ...poWhere, documentDate: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true }),
    prisma.goodsReceiptNote.count({ where: { tenantId, companyId, isDeleted: false } }),
    prisma.payment.aggregate({ where: { ...payWhere, paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.vendor.count({ where: { tenantId, companyId, isDeleted: false } }),
    prisma.businessDocument.groupBy({ by: ["partyId"], where: { ...poWhere, status: { notIn: ["CANCELLED"] } }, _sum: { totalAmount: true }, _count: { id: true }, orderBy: { _sum: { totalAmount: "desc" } }, take: 5 }),
    prisma.businessDocument.findMany({ where: { ...poWhere }, orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, documentNo: true, status: true, totalAmount: true, updatedAt: true, partyId: true } }),
  ]);

  const vendorIds = topVendors.map((v) => v.partyId).filter(Boolean);
  const vendors = vendorIds.length ? await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } }) : [];
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  return {
    kpis: { totalPOs, pendingPOs, draftPOs, approvedPOs, totalGrns, vendorCount, monthlyPurchaseValue: monthlyPOs._sum.totalAmount || 0, monthlyPOCount: monthlyPOs._count || 0, monthlyPaymentValue: monthlyPayments._sum.amount || 0 },
    topVendors: topVendors.map((v) => ({ id: v.partyId, name: vendorMap.get(v.partyId)?.name || "Unknown", totalAmount: v._sum.totalAmount || 0, orderCount: v._count.id || 0 })),
    recentActivity: recentActivity.map((a) => ({ ...a, partyName: vendorMap.get(a.partyId)?.name || "Unknown" })),
  };
}

export async function getPurchaseAnalytics(req) {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const months = 12;
  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date();
    start.setMonth(start.getMonth() - i);
    start.setDate(1); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setMonth(end.getMonth() + 1);
    const [po, grn, pay] = await Promise.all([
      prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "PURCHASE_ORDER", isDeleted: false, documentDate: { gte: start, lt: end } }, _sum: { totalAmount: true }, _count: true }),
      prisma.goodsReceiptNote.count({ where: { tenantId, companyId, isDeleted: false, createdAt: { gte: start, lt: end } } }),
      prisma.payment.aggregate({ where: { tenantId, companyId, paymentType: "PAYMENT", isDeleted: false, paymentDate: { gte: start, lt: end } }, _sum: { amount: true } }),
    ]);
    result.push({ month: start.toLocaleString("en-US", { month: "short", year: "2-digit" }), orders: po._count || 0, value: po._sum.totalAmount || 0, grns: grn, payments: pay._sum.amount || 0 });
  }
  return result;
}

export async function getPurchaseReport(req, { fromDate, toDate }) {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const where = { tenantId, companyId, documentType: "PURCHASE_ORDER", isDeleted: false };
  if (fromDate) where.documentDate = { ...where.documentDate, gte: new Date(fromDate) };
  if (toDate) where.documentDate = { ...where.documentDate, lte: new Date(toDate + "T23:59:59.999Z") };
  const orders = await prisma.businessDocument.findMany({ where, include: { lines: { where: { isDeleted: false } } }, orderBy: { documentDate: "desc" }, take: 500 });
  const vendorIds = [...new Set(orders.map((o) => o.partyId).filter(Boolean))];
  const vendors = vendorIds.length ? await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true, gstin: true } }) : [];
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));
  const rows = orders.map((o) => ({ id: o.id, documentNo: o.documentNo, documentDate: o.documentDate, vendor: vendorMap.get(o.partyId) || { name: "Unknown" }, status: o.status, subtotal: o.subtotal, discount: o.discount, taxableAmount: o.taxableAmount, cgstAmount: o.cgstAmount, sgstAmount: o.sgstAmount, igstAmount: o.igstAmount, totalAmount: o.totalAmount, lineCount: o.lines.length }));
  const totalValue = rows.reduce((s, r) => s + r.totalAmount, 0);
  const totalTax = rows.reduce((s, r) => s + r.cgstAmount + r.sgstAmount + r.igstAmount, 0);
  return { rows, summary: { totalOrders: rows.length, totalValue, totalTax } };
}
