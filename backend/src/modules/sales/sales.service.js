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

export async function listSalesDocs(req, docType, {
  page = 1, limit = 20, status, q,
  dateFrom, dateTo, customerId, amountMin, amountMax,
  branchId, createdBy,
  sortBy = "createdAt", sortOrder = "desc",
} = {}) {
  const prisma = getPrisma();

  // Build dynamic where clause
  const where = {
    tenantId: req.tenantId,
    companyId: req.companyId,
    documentType: docType,
    isDeleted: false,
    ...(status ? { status } : {}),
    ...(branchId ? { branchId } : {}),
    ...(createdBy ? { createdBy } : {}),
    ...(dateFrom || dateTo ? {
      documentDate: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
      },
    } : {}),
    ...(amountMin || amountMax ? {
      totalAmount: {
        ...(amountMin ? { gte: Number(amountMin) } : {}),
        ...(amountMax ? { lte: Number(amountMax) } : {}),
      },
    } : {}),
  };

  // Text search: search by documentNo OR by customer name (via partyId lookup)
  if (q) {
    const searchTerm = q.trim();
    const searchConditions = [
      { documentNo: { contains: searchTerm, mode: "insensitive" } },
    ];

    // Also search customers by name/phone/gstin/email for partyId matching
    const matchingCustomers = await prisma.customer.findMany({
      where: {
        tenantId: req.tenantId,
        companyId: req.companyId,
        isDeleted: false,
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { phone: { contains: searchTerm, mode: "insensitive" } },
          { gstin: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (matchingCustomers.length > 0) {
      searchConditions.push({ partyId: { in: matchingCustomers.map((c) => c.id) } });
    }

    // Search users (sales persons)
    const matchingUsers = await prisma.user.findMany({
      where: {
        tenantId: req.tenantId,
        isDeleted: false,
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { email: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (matchingUsers.length > 0) {
      searchConditions.push({ createdBy: { in: matchingUsers.map((u) => u.id) } });
    }

    where.OR = searchConditions;
  }

  // Filter by specific customer
  if (customerId) {
    where.partyId = customerId;
  }

  // Sorting: whitelist allowed sort fields to prevent injection
  const sortFieldMap = {
    documentDate: "documentDate",
    totalAmount: "totalAmount",
    documentNo: "documentNo",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  };
  const field = sortFieldMap[sortBy] || "createdAt";
  const order = sortOrder === "asc" ? "asc" : "desc";

  const [total, rows] = await Promise.all([
    prisma.businessDocument.count({ where }),
    prisma.businessDocument.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [field]: order },
      include: { lines: { where: { isDeleted: false } } },
    }),
  ]);
  return { rows, meta: { page, limit, total } };
}

export async function listPaymentReceipts(req, {
  page = "1", limit = "20", q,
  dateFrom, dateTo, customerId, branchId,
  mode, sortBy = "paymentDate", sortOrder = "desc",
} = {}) {
  const prisma = getPrisma();
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(500, Math.max(1, Number(limit) || 20));
    tenantId: req.tenantId,
    companyId: req.companyId,
    paymentType: "RECEIPT",
    isDeleted: false,
    ...(branchId ? { branchId } : {}),
    ...(mode ? { mode } : {}),
    ...(dateFrom || dateTo ? {
      paymentDate: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
      },
    } : {}),
  };

  if (q) {
    const searchTerm = q.trim();
    const searchConditions = [
      { paymentNumber: { contains: searchTerm, mode: "insensitive" } },
      { referenceNo: { contains: searchTerm, mode: "insensitive" } },
      { narration: { contains: searchTerm, mode: "insensitive" } },
    ];
    const matchingCustomers = await prisma.customer.findMany({
      where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false, name: { contains: searchTerm, mode: "insensitive" } },
      select: { id: true },
    });
    if (matchingCustomers.length > 0) {
      searchConditions.push({ partyId: { in: matchingCustomers.map((c) => c.id) } });
    }
    where.OR = searchConditions;
  }

  if (customerId) {
    where.partyId = customerId;
  }

  const sortFieldMap = {
    paymentDate: "paymentDate",
    amount: "amount",
    paymentNumber: "paymentNumber",
    createdAt: "createdAt",
  };
  const field = sortFieldMap[sortBy] || "paymentDate";
  const order = sortOrder === "asc" ? "asc" : "desc";

  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { [field]: order },
    }),
  ]);
  return { rows, meta: { page: pageNum, limit: limitNum, total } };
}
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

/**
 * Owner's Morning Dashboard — The first thing an owner sees every day.
 *
 * Answers: What should I focus on today? Who should I call?
 *          Which deals are stuck? How much money came in?
 */
export async function getOwnerDashboard(req) {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const invWhere = { tenantId, companyId, documentType: "INVOICE", isDeleted: false };
  const soWhere = { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false };

  // Run all queries in parallel
  const [
    todayRevenue,
    monthlyRevenue,
    totalOutstanding,
    pendingSOs,
    draftQuotes,
    overdueInvoices,
    topProducts,
    topSalesPeople,
    recentWins,
    todayFollowUps,
    inactiveCustomers,
    lowStockItems,
    alerts,
  ] = await Promise.all([
    // Today's revenue
    prisma.businessDocument.aggregate({ where: { ...invWhere, documentDate: { gte: todayStart, lt: todayEnd } }, _sum: { totalAmount: true }, _count: true }),
    // Monthly revenue
    prisma.businessDocument.aggregate({ where: { ...invWhere, documentDate: { gte: monthStart } }, _sum: { totalAmount: true } }),
    // Total outstanding
    prisma.businessDocument.aggregate({ where: { ...invWhere, status: { notIn: ["CANCELLED"] } }, _sum: { totalAmount: true } }),
    // Pending sales orders
    prisma.businessDocument.count({ where: { ...soWhere, status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } } }),
    // Draft quotations needing attention
    prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "QUOTATION", status: "DRAFT", isDeleted: false } }),
    // Overdue invoices (30+ days)
    prisma.businessDocument.findMany({ where: { ...invWhere, status: { notIn: ["CANCELLED"] }, documentDate: { lt: thirtyDaysAgo } }, take: 5, select: { id: true, documentNo: true, totalAmount: true, documentDate: true, partyId: true } }),
    // Top 5 selling products this month
    prisma.businessDocumentLine.groupBy({
      by: ["itemId"],
      where: { tenantId, companyId, document: { ...invWhere, documentDate: { gte: monthStart } }, isDeleted: false, itemId: { not: null } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    // Top sales people (by user who created invoices)
    prisma.businessDocument.groupBy({
      by: ["createdBy"],
      where: { ...invWhere, documentDate: { gte: monthStart } },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
    // Recently created invoices (wins)
    prisma.businessDocument.findMany({ where: { ...invWhere, createdAt: { gte: thirtyDaysAgo } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, documentNo: true, totalAmount: true, documentDate: true, partyId: true, createdBy: true } }),
    // Today's follow-ups from leads
    prisma.lead.findMany({ where: { tenantId, companyId, isDeleted: false, nextFollowUp: { gte: todayStart, lt: todayEnd } }, take: 10, orderBy: { nextFollowUp: "asc" } }),
    // Customers inactive for 60+ days
    prisma.customer.findMany({
      where: { tenantId, companyId, isDeleted: false, id: { notIn: (await prisma.businessDocument.findMany({ where: { ...invWhere, documentDate: { gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }, isDeleted: false }, select: { partyId: true }, distinct: ["partyId"] })).map((d) => d.partyId).filter(Boolean) } },
      take: 5, select: { id: true, name: true },
    }),
    // Low stock items
    prisma.$queryRaw`SELECT i.id, i.name, i.item_code, COALESCE(SUM(sb.qty_remaining), 0) as on_hand, i.reorder_level
      FROM items i LEFT JOIN stock_batches sb ON sb.item_id = i.id AND sb.is_deleted = false
      WHERE i.tenant_id = ${tenantId}::uuid AND i.company_id = ${companyId}::uuid AND i.is_deleted = false AND i.is_active = true
      GROUP BY i.id HAVING COALESCE(SUM(sb.qty_remaining), 0) <= i.reorder_level AND i.reorder_level IS NOT NULL
      ORDER BY on_hand ASC LIMIT 5`,
    // Generate business insights
    Promise.resolve(generateInsights(prisma, { tenantId, companyId, invWhere })),
  ]);

  // Enrich IDs with names
  const customerIds = [...new Set([...overdueInvoices.map((i) => i.partyId), ...recentWins.map((w) => w.partyId), ...inactiveCustomers.map((c) => c.id)].filter(Boolean))];
  const customers = customerIds.length ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, phone: true } }) : [];
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const itemIds = topProducts.map((p) => p.itemId).filter(Boolean);
  const items = itemIds.length ? await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true, itemCode: true } }) : [];
  const itemMap = new Map(items.map((i) => [i.id, i]));

  return {
    today: {
      revenue: todayRevenue._sum.totalAmount || 0,
      invoiceCount: todayRevenue._count || 0,
      followUps: todayFollowUps.map((l) => ({ id: l.id, name: l.name, contactPerson: l.contactPerson, phone: l.phone, value: l.value, time: l.nextFollowUp })),
      topOpportunities: todayFollowUps.filter((l) => l.value > 0).sort((a, b) => b.value - a.value).slice(0, 3),
    },
    kpis: {
      monthlyRevenue: monthlyRevenue._sum.totalAmount || 0,
      outstandingPaise: totalOutstanding._sum.totalAmount || 0,
      pendingOrders: pendingSOs,
      draftQuotes,
    },
    focus: {
      overdueInvoices: overdueInvoices.map((i) => ({ id: i.id, documentNo: i.documentNo, amount: i.totalAmount, daysOverdue: Math.floor((now - new Date(i.documentDate)) / 86400000), customer: customerMap.get(i.partyId)?.name || "Unknown" })),
      inactiveCustomers: inactiveCustomers.map((c) => ({ id: c.id, name: c.name })),
      lowStockItems: (lowStockItems || []).map((i) => ({ id: i.id, name: i.name, itemCode: i.item_code, onHand: Number(i.on_hand), reorderLevel: Number(i.reorder_level) })),
    },
    performance: {
      topProducts: topProducts.map((p) => ({ itemId: p.itemId, name: itemMap.get(p.itemId)?.name || "Unknown", quantity: p._sum.quantity || 0, revenue: p._sum.lineTotal || 0 })),
      recentWins: recentWins.map((w) => ({ id: w.id, documentNo: w.documentNo, amount: w.totalAmount, date: w.documentDate, customer: customerMap.get(w.partyId)?.name || "Unknown" })),
    },
    insights: await alerts,
  };
}

async function generateInsights(prisma, { tenantId, companyId, invWhere }) {
  const insights = [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  try {
    // Revenue comparison
    const [thisMonth, lastMonth] = await Promise.all([
      prisma.businessDocument.aggregate({ where: { ...invWhere, documentDate: { gte: monthStart } }, _sum: { totalAmount: true } }),
      prisma.businessDocument.aggregate({ where: { ...invWhere, documentDate: { gte: lastMonthStart, lt: monthStart } }, _sum: { totalAmount: true } }),
    ]);
    const thisVal = thisMonth._sum.totalAmount || 0;
    const lastVal = lastMonth._sum.totalAmount || 0;
    if (lastVal > 0) {
      const pct = Math.round(((thisVal - lastVal) / lastVal) * 100);
      if (pct > 0) insights.push({ type: "positive", icon: "trendingUp", message: `Revenue increased ${pct}% compared to last month.`, value: `${pct}%` });
      else if (pct < 0) insights.push({ type: "warning", icon: "trendingDown", message: `Revenue dropped ${Math.abs(pct)}% from last month. Focus on closing pending deals.`, value: `${pct}%` });
    }
  } catch { /* skip insight */ }

  return insights;
}

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
