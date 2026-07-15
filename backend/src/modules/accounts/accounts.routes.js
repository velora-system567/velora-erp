import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPrisma } from "../../config/db.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import {
  postJournalEntry,
  getTrialBalance,
  getProfitLoss,
  getBalanceSheet,
} from "./accounting.service.js";

const router = Router();
router.use(requireAuth, requireTenant);

// ─── Chart of Accounts ────────────────────────────────────────────────────────
router.get("/accounts/chart-of-accounts", requirePermission(PERMISSIONS.ACCOUNTS_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const rows = await prisma.chartOfAccount.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    orderBy: { code: "asc" },
  });
  return ok(res, rows, "Chart of accounts loaded");
}));

router.post("/accounts/chart-of-accounts", requirePermission(PERMISSIONS.ACCOUNTS_CREATE),
  validate(z.object({
    body: z.object({
      code: z.string().min(1).max(20),
      name: z.string().min(2),
      type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const account = await prisma.chartOfAccount.create({
      data: {
        tenantId: req.tenantId, companyId: req.companyId,
        code: req.validated.body.code,
        name: req.validated.body.name,
        type: req.validated.body.type,
        createdBy: req.user.sub, updatedBy: req.user.sub,
      },
    });
    return created(res, account, "Account created");
  }));

// ─── Journal Entries ──────────────────────────────────────────────────────────
const listQuery = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
});

router.get("/accounts/journal-entries", requirePermission(PERMISSIONS.ACCOUNTS_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { page, limit } = req.validated.query;
  const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false };
  const [total, rows] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { entryDate: "desc" },
      include: { lines: true },
    }),
  ]);
  return ok(res, rows, "Journal entries loaded", { page, limit, total });
}));

router.post("/accounts/journal-entries", requirePermission(PERMISSIONS.ACCOUNTS_JOURNAL),
  validate(z.object({
    body: z.object({
      narration: z.string().min(3),
      entryDate: z.string().optional(),
      lines: z.array(z.object({
        accountId: z.string().uuid(),
        debit: z.coerce.number().min(0).default(0),
        credit: z.coerce.number().min(0).default(0),
      })).min(2),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const entry = await prisma.$transaction(async (tx) => {
      return postJournalEntry(tx, req, {
        narration: req.validated.body.narration,
        entryDate: req.validated.body.entryDate ? new Date(req.validated.body.entryDate) : new Date(),
        lines: req.validated.body.lines,
      });
    });
    return created(res, entry, "Journal entry posted");
  }));

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get("/accounts/trial-balance", requirePermission(PERMISSIONS.ACCOUNTS_REPORT), asyncHandler(async (req, res) => {
  const tb = await getTrialBalance(req);
  const totalDebit = tb.reduce((s, a) => s + a.totalDebit, 0);
  const totalCredit = tb.reduce((s, a) => s + a.totalCredit, 0);
  return ok(res, { rows: tb, totalDebit, totalCredit }, "Trial balance loaded");
}));

router.get("/accounts/profit-loss", requirePermission(PERMISSIONS.ACCOUNTS_REPORT),
  validate(z.object({ query: z.object({ fromDate: z.string().optional(), toDate: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const pl = await getProfitLoss(req, req.validated.query);
    return ok(res, pl, "Profit & Loss loaded");
  }));

router.get("/accounts/balance-sheet", requirePermission(PERMISSIONS.ACCOUNTS_REPORT), asyncHandler(async (req, res) => {
  const bs = await getBalanceSheet(req);
  return ok(res, bs, "Balance sheet loaded");
}));

router.get("/accounts/general-ledger/:accountId", requirePermission(PERMISSIONS.ACCOUNTS_READ),
  validate(z.object({ params: z.object({ accountId: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const lines = await prisma.journalEntryLine.findMany({
      where: { tenantId: req.tenantId, companyId: req.companyId, accountId: req.params.accountId, isDeleted: false },
      include: { journalEntry: true },
      orderBy: { createdAt: "asc" },
    });
    let runningBalance = 0;
    const rows = lines.map((l) => {
      runningBalance += l.debit - l.credit;
      return { ...l, runningBalance };
    });
    return ok(res, rows, "General ledger loaded");
  }));

// ─── GST Reports ─────────────────────────────────────────────────────────────
router.get("/accounts/gstr1-report", requirePermission(PERMISSIONS.ACCOUNTS_REPORT), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const invoices = await prisma.businessDocument.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "INVOICE", status: { not: "CANCELLED" }, isDeleted: false },
    orderBy: { documentDate: "asc" },
  });
  const rows = invoices.map((inv) => ({
    documentNo: inv.documentNo,
    documentDate: inv.documentDate,
    partyId: inv.partyId,
    taxableAmount: inv.taxableAmount,
    cgst: inv.cgstAmount,
    sgst: inv.sgstAmount,
    igst: inv.igstAmount,
    totalTax: inv.cgstAmount + inv.sgstAmount + inv.igstAmount,
    totalAmount: inv.totalAmount,
  }));
  const totalTaxable = rows.reduce((s, r) => s + r.taxableAmount, 0);
  const totalTax = rows.reduce((s, r) => s + r.totalTax, 0);
  return ok(res, { rows, totalTaxable, totalTax }, "GSTR-1 report");
}));

router.get("/accounts/gstr3b-summary", requirePermission(PERMISSIONS.ACCOUNTS_REPORT), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const [salesInvoices, purchaseInvoices] = await Promise.all([
    prisma.businessDocument.aggregate({
      where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "INVOICE", status: { not: "CANCELLED" }, isDeleted: false },
      _sum: { taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true },
    }),
    prisma.businessDocument.aggregate({
      where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "PURCHASE_INVOICE", status: { not: "CANCELLED" }, isDeleted: false },
      _sum: { taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true },
    }),
  ]);
  const outputTax = (salesInvoices._sum.cgstAmount || 0) + (salesInvoices._sum.sgstAmount || 0) + (salesInvoices._sum.igstAmount || 0);
  const inputTax = (purchaseInvoices._sum.cgstAmount || 0) + (purchaseInvoices._sum.sgstAmount || 0) + (purchaseInvoices._sum.igstAmount || 0);
  return ok(res, {
    outwardSupplies: { taxableValue: salesInvoices._sum.taxableAmount || 0, cgst: salesInvoices._sum.cgstAmount || 0, sgst: salesInvoices._sum.sgstAmount || 0, igst: salesInvoices._sum.igstAmount || 0 },
    inputTaxCredit: { cgst: purchaseInvoices._sum.cgstAmount || 0, sgst: purchaseInvoices._sum.sgstAmount || 0, igst: purchaseInvoices._sum.igstAmount || 0 },
    netPayable: outputTax - inputTax,
    outputTax,
    inputTax,
  }, "GSTR-3B summary");
}));

router.get("/accounts/debtor-aging", requirePermission(PERMISSIONS.ACCOUNTS_REPORT), asyncHandler(async (req, res) => {
  const { getOutstandingReport } = await import("../sales/sales.service.js");
  const rows = await getOutstandingReport(req);
  const buckets = { current: 0, "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const r of rows) {
    if (r.outstandingAmount <= 0) continue;
    const d = r.agingDays;
    if (d <= 0) buckets.current += r.outstandingAmount;
    else if (d <= 30) buckets["0-30"] += r.outstandingAmount;
    else if (d <= 60) buckets["31-60"] += r.outstandingAmount;
    else if (d <= 90) buckets["61-90"] += r.outstandingAmount;
    else buckets["90+"] += r.outstandingAmount;
  }
  return ok(res, { rows, buckets }, "Debtor aging report");
}));

router.get("/accounts/creditor-aging", requirePermission(PERMISSIONS.ACCOUNTS_REPORT), asyncHandler(async (req, res) => {
  const { getPurchaseOutstanding } = await import("../purchase/purchase.service.js");
  const rows = await getPurchaseOutstanding(req);
  const buckets = { current: 0, "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const r of rows) {
    if (r.outstandingAmount <= 0) continue;
    const d = r.agingDays;
    if (d <= 0) buckets.current += r.outstandingAmount;
    else if (d <= 30) buckets["0-30"] += r.outstandingAmount;
    else if (d <= 60) buckets["31-60"] += r.outstandingAmount;
    else if (d <= 90) buckets["61-90"] += r.outstandingAmount;
    else buckets["90+"] += r.outstandingAmount;
  }
  return ok(res, { rows, buckets }, "Creditor aging report");
}));

router.get("/accounts/cash-book", requirePermission(PERMISSIONS.ACCOUNTS_REPORT), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const payments = await prisma.payment.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, mode: { in: ["CASH"] }, isDeleted: false },
    orderBy: { paymentDate: "asc" },
  });
  let balance = 0;
  const rows = payments.map((p) => {
    if (p.paymentType === "RECEIPT") balance += p.amount;
    else balance -= p.amount;
    return { ...p, runningBalance: balance };
  });
  return ok(res, { rows, closingBalance: balance }, "Cash book loaded");
}));

export default router;
