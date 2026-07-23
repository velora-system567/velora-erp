/**
 * Velora ERP — Sales Service
 * Handles the complete sales lifecycle:
 * Quotation → Sales Order → Delivery Note → Tax Invoice → Payment Receipt
 */
import { getPrisma } from "../../config/db.js";
import { computeDocumentTotals, rupeesToPaise } from "../../utils/money.js";
import { nextDocNumber } from "../../utils/doc-number.js";
import { writeAudit } from "../../utils/audit.js";
import { postSalesInvoiceJournal, postPaymentJournal } from "../accounts/accounting.service.js";
import { debitStockForSale } from "../inventory/inventory.service.js";

const DOC_TYPES = {
  quotation: "QT",
  sales_order: "SO",
  delivery_note: "DN",
  invoice: "INV",
};

/**
 * Build Prisma line data from validated line input.
 * Expects ratePaise already converted.
 */
function buildLines(lines, { tenantId, companyId, branchId, userId }) {
  return lines.map((l) => ({
    tenantId,
    companyId,
    branchId: branchId || null,
    itemId: l.itemId || null,
    description: l.description || null,
    quantity: l.quantity,
    rate: l.ratePaise,
    discount: l.discountPaise || 0,
    gstRate: l.gstRate,
    lineTotal: Math.round(l.quantity * l.ratePaise - (l.discountPaise || 0)),
    createdBy: userId,
    updatedBy: userId,
  }));
}

// ─── QUOTATION ───────────────────────────────────────────────────────────────

export async function createQuotation(req, input) {
  const prisma = getPrisma();
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;
  const gstTreatment = input.gstTreatment || "INTRA_STATE";

  const lines = input.lines.map((l) => ({ ...l, ratePaise: rupeesToPaise(l.rate), discountPaise: rupeesToPaise(l.discount || 0) }));
  const totals = computeDocumentTotals(lines, gstTreatment);

  return prisma.$transaction(async (tx) => {
    const documentNo = await nextDocNumber({ tx, tenantId, companyId, docType: DOC_TYPES.quotation });
    const doc = await tx.businessDocument.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        documentType: "QUOTATION",
        documentNo,
        partyId: input.customerId || null,
        status: "DRAFT",
        documentDate: input.documentDate ? new Date(input.documentDate) : new Date(),
        ...totals,
        terms: input.terms || null,
        createdBy: userId, updatedBy: userId,
      },
    });
    await tx.businessDocumentLine.createMany({
      data: buildLines(lines, { tenantId, companyId, branchId, userId }).map((l) => ({ ...l, documentId: doc.id })),
    });
    await writeAudit(req, { tx, tableName: "business_documents", recordId: doc.id, action: "QUOTATION_CREATED", newValue: doc });
    return tx.businessDocument.findUnique({ where: { id: doc.id }, include: { lines: true } });
  });
}

export async function convertQuotationToOrder(req, quotationId) {
  const prisma = getPrisma();
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;

  return prisma.$transaction(async (tx) => {
    const quotation = await tx.businessDocument.findFirst({
      where: { id: quotationId, tenantId, companyId, documentType: "QUOTATION", isDeleted: false },
      include: { lines: { where: { isDeleted: false } } },
    });
    if (!quotation) { const e = new Error("Quotation not found"); e.statusCode = 404; throw e; }
    if (quotation.status === "CLOSED") { const e = new Error("Quotation already converted"); e.statusCode = 409; throw e; }

    const documentNo = await nextDocNumber({ tx, tenantId, companyId, docType: DOC_TYPES.sales_order });
    const so = await tx.businessDocument.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        documentType: "SALES_ORDER",
        documentNo,
        partyId: quotation.partyId,
        status: "APPROVED",
        documentDate: new Date(),
        subtotal: quotation.subtotal,
        discount: quotation.discount,
        taxableAmount: quotation.taxableAmount,
        cgstAmount: quotation.cgstAmount,
        sgstAmount: quotation.sgstAmount,
        igstAmount: quotation.igstAmount,
        roundOff: quotation.roundOff,
        totalAmount: quotation.totalAmount,
        terms: quotation.terms,
        createdBy: userId, updatedBy: userId,
      },
    });
    await tx.businessDocumentLine.createMany({
      data: quotation.lines.map((l) => ({
        tenantId, companyId, branchId: branchId || null,
        documentId: so.id,
        itemId: l.itemId,
        description: l.description,
        quantity: l.quantity,
        rate: l.rate,
        discount: l.discount,
        gstRate: l.gstRate,
        lineTotal: l.lineTotal,
        createdBy: userId, updatedBy: userId,
      })),
    });
    await tx.businessDocument.update({ where: { id: quotationId }, data: { status: "CLOSED", updatedBy: userId } });
    await writeAudit(req, { tx, tableName: "business_documents", recordId: so.id, action: "SALES_ORDER_CREATED", newValue: so });
    return tx.businessDocument.findUnique({ where: { id: so.id }, include: { lines: true } });
  });
}

// ─── DELIVERY NOTE ──────────────────────────────────────────────────────────

export async function createDeliveryNote(req, input) {
  const prisma = getPrisma();
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;

  return prisma.$transaction(async (tx) => {
    // Optionally link to Sales Order
    let soDoc = null;
    if (input.salesOrderId) {
      soDoc = await tx.businessDocument.findFirst({
        where: { id: input.salesOrderId, tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false },
        include: { lines: { where: { isDeleted: false } } },
      });
      if (!soDoc) { const e = new Error("Sales Order not found"); e.statusCode = 404; throw e; }
    }

    const lines = input.lines.map((l) => ({ ...l, ratePaise: rupeesToPaise(l.rate || 0), discountPaise: 0 }));
    const totals = computeDocumentTotals(lines, "INTRA_STATE");
    const documentNo = await nextDocNumber({ tx, tenantId, companyId, docType: DOC_TYPES.delivery_note });

    const dn = await tx.businessDocument.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        documentType: "DELIVERY_NOTE",
        documentNo,
        partyId: input.customerId || soDoc?.partyId || null,
        status: "APPROVED",
        documentDate: input.documentDate ? new Date(input.documentDate) : new Date(),
        ...totals,
        terms: input.salesOrderId ? `REF:${input.salesOrderId}` : null,
        createdBy: userId, updatedBy: userId,
      },
    });
    await tx.businessDocumentLine.createMany({
      data: buildLines(lines, { tenantId, companyId, branchId, userId }).map((l) => ({ ...l, documentId: dn.id })),
    });

    // Debit stock for each line with a warehouse
    if (input.warehouseId) {
      for (const line of input.lines) {
        if (line.itemId && line.quantity > 0) {
          await debitStockForSale(tx, {
            tenantId, companyId, branchId,
            itemId: line.itemId,
            warehouseId: input.warehouseId,
            quantity: line.quantity,
            referenceId: dn.id,
            referenceType: "DELIVERY_NOTE",
            userId,
          });
        }
      }
    }

    await writeAudit(req, { tx, tableName: "business_documents", recordId: dn.id, action: "DELIVERY_NOTE_CREATED", newValue: dn });
    return tx.businessDocument.findUnique({ where: { id: dn.id }, include: { lines: true } });
  });
}

// ─── INVOICE ─────────────────────────────────────────────────────────────────

export async function createInvoice(req, input) {
  const prisma = getPrisma();
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;
  const gstTreatment = input.gstTreatment || "INTRA_STATE";

  const lines = input.lines.map((l) => ({ ...l, ratePaise: rupeesToPaise(l.rate), discountPaise: rupeesToPaise(l.discount || 0) }));
  const totals = computeDocumentTotals(lines, gstTreatment);

  return prisma.$transaction(async (tx) => {
    const documentNo = await nextDocNumber({ tx, tenantId, companyId, docType: DOC_TYPES.invoice });
    const invoice = await tx.businessDocument.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        documentType: "INVOICE",
        documentNo,
        partyId: input.customerId || null,
        status: "APPROVED",
        documentDate: input.documentDate ? new Date(input.documentDate) : new Date(),
        ...totals,
        terms: input.terms || null,
        createdBy: userId, updatedBy: userId,
      },
    });
    await tx.businessDocumentLine.createMany({
      data: buildLines(lines, { tenantId, companyId, branchId, userId }).map((l) => ({ ...l, documentId: invoice.id })),
    });

    // Auto-post journal entry for invoice
    await postSalesInvoiceJournal(tx, req, invoice, input.customerId);
    await writeAudit(req, { tx, tableName: "business_documents", recordId: invoice.id, action: "INVOICE_CREATED", newValue: invoice });
    return tx.businessDocument.findUnique({ where: { id: invoice.id }, include: { lines: true } });
  });
}

// ─── PAYMENT RECEIPT ─────────────────────────────────────────────────────────

export async function recordPaymentReceipt(req, input) {
  const prisma = getPrisma();
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;
  const amountPaise = rupeesToPaise(input.amount);

  return prisma.$transaction(async (tx) => {
    const paymentNo = await nextDocNumber({ tx, tenantId, companyId, docType: "RCPT" });
    const payment = await tx.payment.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        paymentNumber: paymentNo,
        paymentType: "RECEIPT",
        partyId: input.customerId || null,
        partyType: "CUSTOMER",
        amount: amountPaise,
        mode: input.mode,
        referenceNo: input.referenceNo || null,
        bankName: input.bankName || null,
        narration: input.narration || null,
        paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
        createdBy: userId, updatedBy: userId,
      },
    });

    // Allocate to invoices
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

    // Auto-post journal entry for receipt
    await postPaymentJournal(tx, req, payment, "RECEIPT");
    await writeAudit(req, { tx, tableName: "payments", recordId: payment.id, action: "RECEIPT_CREATED", newValue: payment });
    return payment;
  });
}

// ─── LIST / GET ───────────────────────────────────────────────────────────────

export async function listSalesDocs(req, docType, { page = 1, limit = 20, status, q } = {}) {
  const prisma = getPrisma();
  const where = {
    tenantId: req.tenantId,
    companyId: req.companyId,
    documentType: docType,
    isDeleted: false,
    ...(status ? { status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.businessDocument.count({ where }),
    prisma.businessDocument.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { lines: { where: { isDeleted: false } } },
    }),
  ]);
  return { rows, meta: { page, limit, total } };
}

export async function getSalesDoc(req, docId) {
  const prisma = getPrisma();
  const doc = await prisma.businessDocument.findFirst({
    where: { id: docId, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    include: { lines: { where: { isDeleted: false } } },
  });
  if (!doc) { const e = new Error("Document not found"); e.statusCode = 404; throw e; }
  return doc;
}

export async function updateDocStatus(req, docId, status) {
  const prisma = getPrisma();
  const doc = await prisma.businessDocument.update({
    where: { id: docId },
    data: { status, updatedBy: req.user.sub },
  });
  await writeAudit(req, { tableName: "business_documents", recordId: doc.id, action: `DOC_STATUS_CHANGED_${status}`, newValue: doc });
  return doc;
}

// ─── Sales Dashboard ──────────────────────────────────────────────────────────

export async function getSalesDashboard(req) {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const invWhere = { tenantId, companyId, documentType: "INVOICE", isDeleted: false };
  const soWhere = { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false };
  const dnWhere = { tenantId, companyId, documentType: "DELIVERY_NOTE", isDeleted: false };
  const payWhere = { tenantId, companyId, paymentType: "RECEIPT", isDeleted: false };

  const [totalInvoices, monthlyInvoices, totalSOs, pendingSOs, totalDNs, monthlyReceipts, topCustomers, recentActivity] = await Promise.all([
    prisma.businessDocument.aggregate({ where: invWhere, _sum: { totalAmount: true }, _count: true }),
    prisma.businessDocument.aggregate({ where: { ...invWhere, documentDate: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true }),
    prisma.businessDocument.count({ where: soWhere }),
    prisma.businessDocument.count({ where: { ...soWhere, status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } } }),
    prisma.businessDocument.count({ where: dnWhere }),
    prisma.payment.aggregate({ where: { ...payWhere, paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.businessDocument.groupBy({ by: ["partyId"], where: { ...invWhere, status: { notIn: ["CANCELLED"] } }, _sum: { totalAmount: true }, _count: { id: true }, orderBy: { _sum: { totalAmount: "desc" } }, take: 5 }),
    prisma.businessDocument.findMany({ where: { ...soWhere }, orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, documentNo: true, status: true, totalAmount: true, updatedAt: true, partyId: true } }),
  ]);

  const customerIds = [...new Set([...topCustomers.map((c) => c.partyId), ...recentActivity.map((a) => a.partyId)].filter(Boolean))];
  const customers = customerIds.length ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } }) : [];
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  return {
    kpis: {
      totalRevenue: totalInvoices._sum.totalAmount || 0,
      totalInvoices: totalInvoices._count || 0,
      monthlyRevenue: monthlyInvoices._sum.totalAmount || 0,
      monthlyInvoices: monthlyInvoices._count || 0,
      pendingSOs,
      totalSOs,
      totalDNs,
      monthlyCollections: monthlyReceipts._sum.amount || 0,
    },
    topCustomers: topCustomers.map((c) => ({ id: c.partyId, name: customerMap.get(c.partyId)?.name || "Unknown", totalAmount: c._sum.totalAmount || 0, orderCount: c._count.id || 0 })),
    recentActivity: recentActivity.map((a) => ({ ...a, customerName: customerMap.get(a.partyId)?.name || "Unknown" })),
  };
}

export async function getSalesAnalytics(req) {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const months = 12;
  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(); start.setMonth(start.getMonth() - i); start.setDate(1); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setMonth(end.getMonth() + 1);
    const [inv, so, pay] = await Promise.all([
      prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: start, lt: end } }, _sum: { totalAmount: true }, _count: true }),
      prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false, createdAt: { gte: start, lt: end } } }),
      prisma.payment.aggregate({ where: { tenantId, companyId, paymentType: "RECEIPT", isDeleted: false, paymentDate: { gte: start, lt: end } }, _sum: { amount: true } }),
    ]);
    result.push({ month: start.toLocaleString("en-US", { month: "short", year: "2-digit" }), revenue: inv._sum.totalAmount || 0, invoices: inv._count || 0, orders: so, collections: pay._sum.amount || 0 });
  }
  return result;
}

export async function getOutstandingReport(req) {
  const prisma = getPrisma();
  const invoices = await prisma.businessDocument.findMany({
    where: {
      tenantId: req.tenantId,
      companyId: req.companyId,
      documentType: "INVOICE",
      status: { not: "CANCELLED" },
      isDeleted: false,
    },
    orderBy: { documentDate: "asc" },
  });

  const allocations = await prisma.paymentAllocation.findMany({
    where: {
      tenantId: req.tenantId,
      companyId: req.companyId,
      isDeleted: false,
    },
  });

  const paidMap = new Map();
  for (const a of allocations) {
    paidMap.set(a.documentId, (paidMap.get(a.documentId) || 0) + a.amount);
  }

  return invoices.map((inv) => ({
    id: inv.id,
    documentNo: inv.documentNo,
    documentDate: inv.documentDate,
    partyId: inv.partyId,
    totalAmount: inv.totalAmount,
    paidAmount: paidMap.get(inv.id) || 0,
    outstandingAmount: inv.totalAmount - (paidMap.get(inv.id) || 0),
    agingDays: Math.floor((Date.now() - new Date(inv.documentDate).getTime()) / 86400000),
  }));
}
