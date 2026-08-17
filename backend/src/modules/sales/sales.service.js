/**
 * Velora ERP — Sales Service
 *
 * Handles the full sales lifecycle:
 *   Quotation → Sales Order → Delivery Note → Tax Invoice → Payment Receipt
 *
 * All amounts are stored in PAISE (integer). Inputs in rupees are converted at the edge.
 * Uses shared BusinessDocument + BusinessDocumentLine models.
 * Stock deduction happens via inventory.service.debitStockForSale on delivery notes.
 * Accounting journals posted via accounting.service.postSalesInvoiceJournal / postPaymentJournal.
 */
import { getPrisma } from "../../config/db.js";
import { rupeesToPaise, computeDocumentTotals } from "../../utils/money.js";
import { nextDocNumber } from "../../utils/doc-number.js";
import { writeAudit } from "../../utils/audit.js";
import { cachedCompute } from "../../utils/single-flight-cache.js";

const ACTIVE = { isDeleted: false };

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "object" && "toNumber" in value) return value.toNumber();
  return Number(value);
}

function notFound(message) {
  const e = new Error(message);
  e.statusCode = 404;
  return e;
}

function unprocessable(message) {
  const e = new Error(message);
  e.statusCode = 422;
  return e;
}

const DOC_PREFIX = { QUOTATION: "QT", SALES_ORDER: "SO", DELIVERY_NOTE: "DN", INVOICE: "INV" };

// ─── Lead Management ───────────────────────────────────────────────────────────

export async function listLeads(prisma, { tenantId, companyId, page = 1, limit = 20, status, priority, source, q }) {
  const where = { tenantId, companyId, isDeleted: false };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (source) where.source = source;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { contactPerson: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { requirement: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    }),
  ]);

  return { rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function createLead(tx, req, data) {
  const prisma = tx || getPrisma();
  const { tenantId, companyId } = req;
  const userId = req.user?.sub;
  const lead = await prisma.lead.create({
    data: {
      tenantId, companyId,
      branchId: req.branchId || null,
      name: data.name,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      city: data.city || null,
      source: data.source || null,
      priority: data.priority || "MEDIUM",
      status: data.status || "NEW",
      value: rupeesToPaise(data.value || 0),
      notes: data.notes || null,
      requirement: data.requirement || null,
      nextFollowUp: data.nextFollowUp || null,
      createdBy: userId, updatedBy: userId,
    },
  });
  await writeAudit(req, { tx: prisma, tableName: "leads", recordId: lead.id, action: "LEAD_CREATED", newValue: lead });
  return lead;
}

export async function updateLead(tx, req, id, data) {
  const prisma = tx || getPrisma();
  const { tenantId, companyId } = req;
  const userId = req.user?.sub;
  const existing = await prisma.lead.findFirst({ where: { id, tenantId, companyId, isDeleted: false } });
  if (!existing) throw notFound("Lead not found");
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      contactPerson: data.contactPerson ?? existing.contactPerson,
      phone: data.phone ?? existing.phone,
      email: data.email ?? existing.email,
      city: data.city ?? existing.city,
      source: data.source ?? existing.source,
      priority: data.priority ?? existing.priority,
      status: data.status ?? existing.status,
      value: data.value !== undefined ? rupeesToPaise(data.value) : existing.value,
      notes: data.notes ?? existing.notes,
      requirement: data.requirement ?? existing.requirement,
      nextFollowUp: data.nextFollowUp ?? existing.nextFollowUp,
      updatedBy: userId,
    },
  });
  await writeAudit(req, { tx: prisma, tableName: "leads", recordId: lead.id, action: "LEAD_UPDATED", oldValue: existing, newValue: lead });
  return lead;
}

export async function deleteLead(tx, req, id) {
  const prisma = tx || getPrisma();
  const { tenantId, companyId } = req;
  const userId = req.user?.sub;
  const existing = await prisma.lead.findFirst({ where: { id, tenantId, companyId, isDeleted: false } });
  if (!existing) throw notFound("Lead not found");
  await prisma.lead.update({ where: { id }, data: { isDeleted: true, updatedBy: userId } });
  await writeAudit(req, { tx: prisma, tableName: "leads", recordId: id, action: "LEAD_DELETED", oldValue: existing });
  return { success: true };
}

// ─── Document Creation (Quotation / Sales Order / Delivery Note / Invoice) ──────

function buildLines(data) {
  const lines = [];
  for (const l of data.lines) {
    const ratePaise = rupeesToPaise(l.rate || 0);
    const discountPaise = rupeesToPaise(l.discount || 0);
    const lineTotalPaise = Math.round(Number(l.quantity) * ratePaise - discountPaise);
    lines.push({
      itemId: l.itemId || null,
      description: l.description || null,
      quantity: Number(l.quantity),
      rate: ratePaise,
      discount: discountPaise,
      gstRate: l.gstRate ?? 18,
      lineTotal: lineTotalPaise,
    });
  }
  return lines;
}

export async function createDocument(tx, req, docType, data) {
  const prisma = tx || getPrisma();
  const { tenantId, companyId } = req;
  const userId = req.user?.sub;

  const linesInput = buildLines(data);
  const totals = computeDocumentTotals(
    linesInput.map((l) => ({ quantity: l.quantity, ratePaise: l.rate, discountPaise: l.discount, gstRate: l.gstRate })),
    data.gstTreatment || "INTRA_STATE"
  );

  const docNo = await nextDocNumber({ tx: prisma, tenantId, companyId, docType: DOC_PREFIX[docType], date: data.documentDate || new Date() });

  const doc = await prisma.businessDocument.create({
    data: {
      tenantId, companyId,
      branchId: req.branchId || null,
      documentType: docType,
      documentNo: docNo,
      partyId: data.customerId || null,
      status: "DRAFT",
      documentDate: data.documentDate || new Date(),
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxableAmount: totals.taxableAmount,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      igstAmount: totals.igstAmount,
      roundOff: totals.roundOff,
      totalAmount: totals.totalAmount,
      terms: data.terms || null,
      createdBy: userId, updatedBy: userId,
      lines: {
        create: linesInput.map((l) => ({
          tenantId, companyId,
          branchId: req.branchId || null,
          itemId: l.itemId,
          description: l.description,
          quantity: l.quantity,
          rate: l.rate,
          discount: l.discount,
          gstRate: l.gstRate,
          lineTotal: l.lineTotal,
          createdBy: userId, updatedBy: userId,
        })),
      },
    },
    include: { lines: true },
  });

  await writeAudit(req, { tx: prisma, tableName: "business_documents", recordId: doc.id, action: `${docType}_CREATED`, newValue: doc });
  return doc;
}

export async function getDocument(tx, req, id) {
  const prisma = tx || getPrisma();
  const { tenantId, companyId } = req;
  const doc = await prisma.businessDocument.findFirst({
    where: { id, tenantId, companyId, isDeleted: false },
    include: { lines: true },
  });
  if (!doc) throw notFound("Document not found");
  return doc;
}

export async function listDocuments(prisma, { tenantId, companyId, documentType, page = 1, limit = 20, status, q, customerId, dateFrom, dateTo, amountMin, amountMax, sortBy, sortOrder }) {
  const where = { tenantId, companyId, documentType, isDeleted: false };
  if (status) where.status = status;
  if (customerId) where.partyId = customerId;
  if (q) where.OR = [{ documentNo: { contains: q, mode: "insensitive" } }, { party: { name: { contains: q, mode: "insensitive" } } }];
  if (dateFrom || dateTo) {
    where.documentDate = {};
    if (dateFrom) where.documentDate.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) where.documentDate.lte = new Date(`${dateTo}T23:59:59.999Z`);
  }
  if (amountMin !== undefined || amountMax !== undefined) {
    where.totalAmount = {};
    if (amountMin !== undefined) where.totalAmount.gte = rupeesToPaise(amountMin);
    if (amountMax !== undefined) where.totalAmount.lte = rupeesToPaise(amountMax);
  }

  const orderBy = {};
  if (sortBy) orderBy[sortBy] = sortOrder === "desc" ? "desc" : "asc";
  else orderBy.documentDate = "desc";

  const [total, rows] = await Promise.all([
    prisma.businessDocument.count({ where }),
    prisma.businessDocument.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      include: { party: { select: { id: true, name: true } } },
    }),
  ]);

  return { rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function updateDocStatus(tx, req, id, status) {
  const prisma = tx || getPrisma();
  const { tenantId, companyId } = req;
  const userId = req.user?.sub;
  const existing = await prisma.businessDocument.findFirst({ where: { id, tenantId, companyId, isDeleted: false } });
  if (!existing) throw notFound("Document not found");
  const doc = await prisma.businessDocument.update({ where: { id }, data: { status, updatedBy: userId } });
  await writeAudit(req, { tx: prisma, tableName: "business_documents", recordId: id, action: "DOC_STATUS_UPDATED", oldValue: { status: existing.status }, newValue: { status } });
  return doc;
}

export async function convertQuotationToOrder(tx, req, quotationId) {
  const prisma = tx || getPrisma();
  const { tenantId, companyId } = req;
  const userId = req.user?.sub;

  const quotation = await prisma.businessDocument.findFirst({
    where: { id: quotationId, tenantId, companyId, documentType: "QUOTATION", isDeleted: false },
    include: { lines: true },
  });
  if (!quotation) throw notFound("Quotation not found");
  if (quotation.status === "CLOSED" || quotation.status === "CANCELLED") {
    throw unprocessable("Quotation is already closed/cancelled and cannot be converted");
  }

  const orderNo = await nextDocNumber({ tx: prisma, tenantId, companyId, docType: "SO", date: new Date() });
  const order = await prisma.businessDocument.create({
    data: {
      tenantId, companyId,
      branchId: req.branchId || null,
      documentType: "SALES_ORDER",
      documentNo: orderNo,
      partyId: quotation.partyId,
      status: "DRAFT",
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
      lines: {
        create: quotation.lines.map((l) => ({
          tenantId, companyId,
          branchId: req.branchId || null,
          itemId: l.itemId,
          description: l.description,
          quantity: l.quantity,
          rate: l.rate,
          discount: l.discount,
          gstRate: l.gstRate,
          lineTotal: l.lineTotal,
          createdBy: userId, updatedBy: userId,
        })),
      },
    },
    include: { lines: true },
  });

  // Mark quotation as converted (CLOSED)
  await prisma.businessDocument.update({ where: { id: quotationId }, data: { status: "CLOSED", updatedBy: userId } });
  await writeAudit(req, { tx: prisma, tableName: "business_documents", recordId: order.id, action: "QUOTATION_CONVERTED_TO_ORDER", newValue: order });
  return order;
}

// ─── Delivery Note (stock debit) ───────────────────────────────────────────────

export async function createDeliveryNote(tx, req, data) {
  const prisma = tx || getPrisma();
  const { tenantId, companyId } = req;
  const userId = req.user?.sub;

  const linesInput = buildLines(data);
  const totals = computeDocumentTotals(
    linesInput.map((l) => ({ quantity: l.quantity, ratePaise: l.rate, discountPaise: l.discount, gstRate: l.gstRate })),
    data.gstTreatment || "INTRA_STATE"
  );

  const dnNo = await nextDocNumber({ tx: prisma, tenantId, companyId, docType: "DN", date: data.documentDate || new Date() });

  const dn = await prisma.businessDocument.create({
    data: {
      tenantId, companyId,
      branchId: req.branchId || null,
      documentType: "DELIVERY_NOTE",
      documentNo: dnNo,
      partyId: data.customerId || null,
      status: "DRAFT",
      documentDate: data.documentDate || new Date(),
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxableAmount: totals.taxableAmount,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      igstAmount: totals.igstAmount,
      roundOff: totals.roundOff,
      totalAmount: totals.totalAmount,
      terms: data.terms || null,
      createdBy: userId, updatedBy: userId,
      lines: {
        create: linesInput.map((l) => ({
          tenantId, companyId,
          branchId: req.branchId || null,
          itemId: l.itemId,
          description: l.description,
          quantity: l.quantity,
          rate: l.rate,
          discount: l.discount,
          gstRate: l.gstRate,
          lineTotal: l.lineTotal,
          createdBy: userId, updatedBy: userId,
        })),
      },
    },
    include: { lines: true },
  });

  // Debit stock if warehouse is specified (per spec: only when warehouseId provided)
  if (data.warehouseId) {
    const { debitStockForSale } = await import("../inventory/inventory.service.js");
    for (const line of dn.lines) {
      if (!line.itemId) continue;
      await debitStockForSale(prisma, {
        tenantId, companyId,
        branchId: req.branchId || null,
        itemId: line.itemId,
        warehouseId: data.warehouseId,
        quantity: Number(line.quantity),
        referenceId: dn.id,
        referenceType: "DELIVERY_NOTE",
        userId,
      });
    }
  }

  await writeAudit(req, { tx: prisma, tableName: "business_documents", recordId: dn.id, action: "DELIVERY_NOTE_CREATED", newValue: dn });
  return dn;
}

// ─── Invoice (accounting journal) ──────────────────────────────────────────────

export async function createInvoice(tx, req, data) {
  const prisma = tx || getPrisma();
  const { tenantId, companyId } = req;
  const userId = req.user?.sub;

  const doc = await createDocument(prisma, req, "INVOICE", data);

  // Post accounting journal
  const { postSalesInvoiceJournal } = await import("../accounts/accounting.service.js");
  await postSalesInvoiceJournal(prisma, req, doc, data.customerId);

  await writeAudit(req, { tx: prisma, tableName: "business_documents", recordId: doc.id, action: "INVOICE_JOURNAL_POSTED", newValue: doc });
  return doc;
}

// ─── Payment Receipt ───────────────────────────────────────────────────────────

export async function recordPaymentReceipt(tx, req, data) {
  const prisma = tx || getPrisma();
  const { tenantId, companyId } = req;
  const userId = req.user?.sub;

  const paymentNo = await nextDocNumber({ tx: prisma, tenantId, companyId, docType: "RCPT", date: data.paymentDate || new Date() });
  const amountPaise = rupeesToPaise(data.amount);

  const payment = await prisma.payment.create({
    data: {
      tenantId, companyId,
      branchId: req.branchId || null,
      paymentNumber: paymentNo,
      paymentType: "RECEIPT",
      partyId: data.customerId || null,
      partyType: "CUSTOMER",
      amount: amountPaise,
      mode: data.mode,
      referenceNo: data.referenceNo || null,
      bankName: data.bankName || null,
      narration: data.narration || null,
      paymentDate: data.paymentDate || new Date(),
      createdBy: userId, updatedBy: userId,
      allocations: data.allocations?.length
        ? {
            create: data.allocations.map((a) => ({
              tenantId, companyId,
              branchId: req.branchId || null,
              documentId: a.invoiceId,
              amount: rupeesToPaise(a.amount),
              createdBy: userId, updatedBy: userId,
            })),
          }
        : undefined,
    },
    include: { allocations: true },
  });

  // Post accounting journal
  const { postPaymentJournal } = await import("../accounts/accounting.service.js");
  await postPaymentJournal(prisma, req, payment, "RECEIPT");

  await writeAudit(req, { tx: prisma, tableName: "payments", recordId: payment.id, action: "PAYMENT_RECEIPT_RECORDED", newValue: payment });
  return payment;
}

// ─── Dashboards & Analytics ────────────────────────────────────────────────────

export async function getSalesDashboard(req) {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalInvoicedAgg, monthlyInvoicesAgg, totalOrders, pendingOrders,
    totalDeliveryNotes, monthlyReceiptsAgg, topCustomers, recentOrders,
  ] = await Promise.all([
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false }, _sum: { totalAmount: true }, _count: true }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true }),
    prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false } }),
    prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false, status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } } }),
    prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "DELIVERY_NOTE", isDeleted: false } }),
    prisma.payment.aggregate({ where: { tenantId, companyId, paymentType: "RECEIPT", isDeleted: false, paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.businessDocument.groupBy({
      by: ["partyId"],
      where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, status: { not: "CANCELLED" }, partyId: { not: null } },
      _sum: { totalAmount: true }, _count: { id: true }, orderBy: { _sum: { totalAmount: "desc" } }, take: 5,
    }),
    prisma.businessDocument.findMany({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false }, orderBy: { updatedAt: "desc" }, take: 10 }),
  ]);

  const customerIds = topCustomers.map((c) => c.partyId).filter(Boolean);
  const customers = customerIds.length
    ? await prisma.customer.findMany({ where: { id: { in: customerIds }, tenantId, companyId, isDeleted: false }, select: { id: true, name: true } })
    : [];
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  return {
    kpis: {
      totalInvoiced: totalInvoicedAgg._sum.totalAmount || 0,
      monthlyInvoices: monthlyInvoicesAgg._sum.totalAmount || 0,
      monthlyInvoiceCount: monthlyInvoicesAgg._count || 0,
      totalSalesOrders: totalOrders,
      pendingSalesOrders: pendingOrders,
      totalDeliveryNotes,
      monthlyReceipts: monthlyReceiptsAgg._sum.amount || 0,
    },
    topCustomers: topCustomers.map((c) => ({
      customerId: c.partyId,
      name: customerMap.get(c.partyId) || "Unknown",
      totalAmount: c._sum.totalAmount || 0,
      invoiceCount: c._count.id || 0,
    })),
    recentOrders: recentOrders.map((o) => ({
      id: o.id, documentNo: o.documentNo, status: o.status,
      totalAmount: o.totalAmount, documentDate: o.documentDate,
    })),
  };
}

export async function getOwnerDashboard(req) {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [
    todaysRevenueAgg, monthlyRevenueAgg, totalOutstandingAgg, pendingOrders,
    draftQuotes, overdueInvoices, topProducts, topSalesPeople, recentWins,
    todaysFollowUps, inactiveCustomers, leads,
  ] = await Promise.all([
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: todayStart, lt: todayEnd } }, _sum: { totalAmount: true }, _count: true }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart } }, _sum: { totalAmount: true } }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, status: { not: "CANCELLED" } }, _sum: { totalAmount: true } }),
    prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false, status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } } }),
    prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "QUOTATION", isDeleted: false, status: "DRAFT" } }),
    prisma.businessDocument.findMany({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, status: { not: "CANCELLED" }, documentDate: { lt: thirtyDaysAgo } }, orderBy: { documentDate: "asc" }, take: 5 }),
    prisma.$queryRaw`SELECT "itemId", SUM(CAST("quantity" AS DOUBLE PRECISION)) as "sumQuantity", SUM("lineTotal") as "sumLineTotal" FROM "business_document_lines" WHERE "tenantId" = ${tenantId} AND "companyId" = ${companyId} AND "isDeleted" = false AND "itemId" IS NOT NULL AND "documentId" IN (SELECT id FROM "business_documents" WHERE "tenantId" = ${tenantId} AND "companyId" = ${companyId} AND "documentType" = 'INVOICE' AND "isDeleted" = false AND "documentDate" >= ${monthStart}) GROUP BY "itemId" ORDER BY "sumQuantity" DESC LIMIT 5`,
    prisma.businessDocument.groupBy({ by: ["createdBy"], where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart }, createdBy: { not: null } }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: "desc" } }, take: 5 }),
    prisma.businessDocument.findMany({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.lead.findMany({ where: { tenantId, companyId, isDeleted: false, nextFollowUp: { gte: todayStart, lt: todayEnd } }, orderBy: { nextFollowUp: "asc" }, take: 10 }),
    prisma.customer.findMany({ where: { tenantId, companyId, isDeleted: false, id: { notIn: prisma.businessDocument.findMany({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: sixtyDaysAgo } }, select: { partyId: true } }).then((docs) => docs.map((d) => d.partyId).filter(Boolean)) } }, take: 10 }),
    prisma.lead.findMany({ where: { tenantId, companyId, isDeleted: false, status: { not: "LOST" } }, orderBy: { value: "desc" }, take: 3 }),
  ]);

  // Resolve names for top products / sales people
  const productIds = topProducts.map((p) => p.itemId).filter(Boolean);
  const products = productIds.length ? await prisma.item.findMany({ where: { id: { in: productIds }, tenantId, companyId, isDeleted: false }, select: { id: true, name: true, itemCode: true } }) : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  return {
    kpis: {
      todaysRevenue: todaysRevenueAgg._sum.totalAmount || 0,
      todaysRevenueCount: todaysRevenueAgg._count || 0,
      monthlyRevenue: monthlyRevenueAgg._sum.totalAmount || 0,
      totalOutstanding: totalOutstandingAgg._sum.totalAmount || 0,
      pendingOrders,
      draftQuotes,
    },
    overdueInvoices: overdueInvoices.map((i) => ({ id: i.id, documentNo: i.documentNo, totalAmount: i.totalAmount, documentDate: i.documentDate })),
    topProducts: topProducts.map((p) => ({
      itemId: p.itemId,
      name: productMap.get(p.itemId)?.name || "Unknown",
      itemCode: productMap.get(p.itemId)?.itemCode || "",
      quantity: Number(p._sum.quantity) || 0,
      lineTotal: p._sum.lineTotal || 0,
    })),
    topSalesPeople: topSalesPeople.map((s) => ({ createdBy: s.createdBy, totalAmount: s._sum.totalAmount || 0 })),
    recentWins: recentWins.map((w) => ({ id: w.id, documentNo: w.documentNo, totalAmount: w.totalAmount, documentDate: w.documentDate })),
    todaysFollowUps: todaysFollowUps.map((l) => ({ id: l.id, name: l.name, time: l.nextFollowUp, value: l.value, status: l.status })),
    inactiveCustomers,
    topOpportunities: leads.map((l) => ({ id: l.id, name: l.name, value: l.value, status: l.status })),
  };
}

export async function getSalesAnalytics(req) {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d);
  }

  const results = [];
  for (const m of months) {
    const start = new Date(m.getFullYear(), m.getMonth(), 1);
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    const [revenue, invoices, orders, collections] = await Promise.all([
      prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: start, lt: end } }, _sum: { totalAmount: true } }),
      prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: start, lt: end } } }),
      prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false, documentDate: { gte: start, lt: end } } }),
      prisma.payment.aggregate({ where: { tenantId, companyId, paymentType: "RECEIPT", isDeleted: false, paymentDate: { gte: start, lt: end } }, _sum: { amount: true } }),
    ]);
    results.push({
      month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
      revenue: revenue._sum.totalAmount || 0,
      invoices: invoices || 0,
      orders: orders || 0,
      collections: collections._sum.amount || 0,
    });
  }
  return results;
}

const salesService = {
  listLeads,
  createLead,
  updateLead,
  deleteLead,
  createDocument,
  getDocument,
  listDocuments,
  updateDocStatus,
  convertQuotationToOrder,
  createDeliveryNote,
  createInvoice,
  recordPaymentReceipt,
  getSalesDashboard,
  getOwnerDashboard,
  getSalesAnalytics,
};

export default salesService;
