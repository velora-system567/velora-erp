/**
 * Velora ERP — Double-Entry Accounting Engine
 *
 * Every financial transaction posts balanced journal entries.
 * Debit = Credit always.
 *
 * Standard account codes (seeded per tenant):
 *   1000 Cash | 1010 Bank | 1100 Debtors | 2000 Creditors
 *   1200 Input CGST | 1210 Input SGST | 1220 Input IGST
 *   2100 Output CGST | 2110 Output SGST | 2120 Output IGST
 *   4000 Sales | 5000 Purchases
 */
import { getPrisma } from "../../config/db.js";
import { nextDocNumber } from "../../utils/doc-number.js";
import { writeAudit } from "../../utils/audit.js";

// ─── Finance Dashboard ─────────────────────────────────────────────────────────

export async function getFinanceDashboard(req) {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [trialBalance, receivables, payables, gstPayable, invoicing, purchasing] = await Promise.all([
    getTrialBalance(req),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", status: { notIn: ["CANCELLED"] }, isDeleted: false }, _sum: { totalAmount: true }, _count: true }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "PURCHASE_INVOICE", status: { notIn: ["CANCELLED"] }, isDeleted: false }, _sum: { totalAmount: true }, _count: true }),
    prisma.journalEntryLine.aggregate({ where: { tenantId, companyId, account: { code: { in: ["2100", "2110", "2120"] } } }, _sum: { credit: true } }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "PURCHASE_INVOICE", isDeleted: false, documentDate: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true }),
  ]);

  // Compute balances from trial balance
  const incomeTotal = trialBalance.rows.filter((r) => r.type === "INCOME").reduce((s, r) => s + r.balance, 0);
  const expenseTotal = trialBalance.rows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + Math.abs(r.balance), 0);

  // Cash & bank balances
  const cashBalance = trialBalance.rows.filter((r) => r.code.startsWith("1000")).reduce((s, r) => s + r.balance, 0);
  const bankBalance = trialBalance.rows.filter((r) => r.code.startsWith("1010")).reduce((s, r) => s + r.balance, 0);

  return {
    kpis: {
      cashBalance: Math.abs(cashBalance),
      bankBalance: Math.abs(bankBalance),
      totalCash: Math.abs(cashBalance) + Math.abs(bankBalance),
      receivables: receivables._sum.totalAmount || 0,
      payables: payables._sum.totalAmount || 0,
      revenue: incomeTotal,
      expenses: expenseTotal,
      netProfit: incomeTotal - expenseTotal,
      gstPayable: Math.abs(gstPayable._sum.credit || 0),
      monthlyRevenue: invoicing._sum.totalAmount || 0,
      monthlyExpenses: purchasing._sum.totalAmount || 0,
      outstandingInvoices: receivables._count || 0,
      outstandingBills: payables._count || 0,
    },
    chartOfAccounts: trialBalance.rows.map((r) => ({ id: r.accountId, code: r.code, name: r.name, type: r.type, balance: r.balance })),
  };
}

// ─── Helper: find or create account by code ──────────────────────────────────

async function findAccount(tx, { tenantId, companyId, code }) {
  const account = await tx.chartOfAccount.findFirst({
    where: { tenantId, companyId, code, isDeleted: false },
  });
  if (!account) {
    const e = new Error(`Chart of account not found: ${code}. Please set up your chart of accounts.`);
    e.statusCode = 422;
    throw e;
  }
  return account;
}

// ─── Core Journal Post ───────────────────────────────────────────────────────

export async function postJournalEntry(tx, req, { narration, referenceId, lines, entryDate }) {
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;

  // Validate debit = credit
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 1) {
    const e = new Error(`Journal entry imbalanced: Debit ${totalDebit} ≠ Credit ${totalCredit}`);
    e.statusCode = 422;
    throw e;
  }

  const entryNo = await nextDocNumber({ tx, tenantId, companyId, docType: "JE", date: entryDate || new Date() });

  const entry = await tx.journalEntry.create({
    data: {
      tenantId, companyId, branchId: branchId || null,
      entryNo,
      entryDate: entryDate || new Date(),
      narration: narration || null,
      referenceId: referenceId || null,
      createdBy: userId, updatedBy: userId,
    },
  });

  await tx.journalEntryLine.createMany({
    data: lines.map((l) => ({
      tenantId, companyId, branchId: branchId || null,
      journalEntryId: entry.id,
      accountId: l.accountId,
      debit: l.debit || 0,
      credit: l.credit || 0,
      createdBy: userId, updatedBy: userId,
    })),
  });

  return entry;
}

// ─── Sales Invoice Journal ────────────────────────────────────────────────────
// Dr Debtors (total)
// Cr Sales (taxable)
// Cr Output CGST | Cr Output SGST | Cr Output IGST

export async function postSalesInvoiceJournal(tx, req, invoice, customerId) {
  const { tenantId, companyId } = req;
  try {
    const [debtors, sales, outCgst, outSgst, outIgst] = await Promise.all([
      findAccount(tx, { tenantId, companyId, code: "1100" }),
      findAccount(tx, { tenantId, companyId, code: "4000" }),
      invoice.cgstAmount > 0 ? findAccount(tx, { tenantId, companyId, code: "2100" }) : null,
      invoice.sgstAmount > 0 ? findAccount(tx, { tenantId, companyId, code: "2110" }) : null,
      invoice.igstAmount > 0 ? findAccount(tx, { tenantId, companyId, code: "2120" }) : null,
    ]);

    const lines = [
      { accountId: debtors.id, debit: invoice.totalAmount, credit: 0 },
      { accountId: sales.id, debit: 0, credit: invoice.taxableAmount },
    ];
    if (invoice.cgstAmount > 0 && outCgst) lines.push({ accountId: outCgst.id, debit: 0, credit: invoice.cgstAmount });
    if (invoice.sgstAmount > 0 && outSgst) lines.push({ accountId: outSgst.id, debit: 0, credit: invoice.sgstAmount });
    if (invoice.igstAmount > 0 && outIgst) lines.push({ accountId: outIgst.id, debit: 0, credit: invoice.igstAmount });
    if (invoice.roundOff !== 0) {
      // Round-off adjusts debtors
      lines[0].debit += invoice.roundOff;
    }

    await postJournalEntry(tx, req, {
      narration: `Sales Invoice ${invoice.documentNo}`,
      referenceId: invoice.id,
      lines,
      entryDate: invoice.documentDate,
    });
  } catch (e) {
    // Non-fatal if COA not yet set up — log and continue
    if (e.statusCode === 422) {
      console.warn(`[Accounting] COA missing for sales journal on ${invoice.documentNo}: ${e.message}`);
      return;
    }
    throw e;
  }
}

// ─── Purchase Invoice Journal ─────────────────────────────────────────────────
// Dr Purchases (taxable)
// Dr Input CGST | Dr Input SGST | Dr Input IGST
// Cr Creditors (total)

export async function postPurchaseInvoiceJournal(tx, req, invoice, vendorId) {
  const { tenantId, companyId } = req;
  try {
    const [creditors, purchases, inCgst, inSgst, inIgst] = await Promise.all([
      findAccount(tx, { tenantId, companyId, code: "2000" }),
      findAccount(tx, { tenantId, companyId, code: "5000" }),
      invoice.cgstAmount > 0 ? findAccount(tx, { tenantId, companyId, code: "1200" }) : null,
      invoice.sgstAmount > 0 ? findAccount(tx, { tenantId, companyId, code: "1210" }) : null,
      invoice.igstAmount > 0 ? findAccount(tx, { tenantId, companyId, code: "1220" }) : null,
    ]);

    const lines = [
      { accountId: purchases.id, debit: invoice.taxableAmount, credit: 0 },
      { accountId: creditors.id, debit: 0, credit: invoice.totalAmount },
    ];
    if (invoice.cgstAmount > 0 && inCgst) lines.push({ accountId: inCgst.id, debit: invoice.cgstAmount, credit: 0 });
    if (invoice.sgstAmount > 0 && inSgst) lines.push({ accountId: inSgst.id, debit: invoice.sgstAmount, credit: 0 });
    if (invoice.igstAmount > 0 && inIgst) lines.push({ accountId: inIgst.id, debit: invoice.igstAmount, credit: 0 });

    await postJournalEntry(tx, req, {
      narration: `Purchase Invoice ${invoice.documentNo}`,
      referenceId: invoice.id,
      lines,
      entryDate: invoice.documentDate,
    });
  } catch (e) {
    if (e.statusCode === 422) {
      console.warn(`[Accounting] COA missing for purchase journal on ${invoice.documentNo}: ${e.message}`);
      return;
    }
    throw e;
  }
}

// ─── Payment Journal ──────────────────────────────────────────────────────────
// Receipt:  Dr Bank/Cash   Cr Debtors
// Payment:  Dr Creditors   Cr Bank/Cash

export async function postPaymentJournal(tx, req, payment, type) {
  const { tenantId, companyId } = req;
  try {
    const bankCode = payment.mode === "CASH" ? "1000" : "1010";
    const [bankAcc, debtors, creditors] = await Promise.all([
      findAccount(tx, { tenantId, companyId, code: bankCode }),
      findAccount(tx, { tenantId, companyId, code: "1100" }),
      findAccount(tx, { tenantId, companyId, code: "2000" }),
    ]);

    const lines = type === "RECEIPT"
      ? [
          { accountId: bankAcc.id, debit: payment.amount, credit: 0 },
          { accountId: debtors.id, debit: 0, credit: payment.amount },
        ]
      : [
          { accountId: creditors.id, debit: payment.amount, credit: 0 },
          { accountId: bankAcc.id, debit: 0, credit: payment.amount },
        ];

    await postJournalEntry(tx, req, {
      narration: `${type === "RECEIPT" ? "Receipt" : "Payment"} ${payment.paymentNumber}`,
      referenceId: payment.id,
      lines,
      entryDate: payment.paymentDate,
    });
  } catch (e) {
    if (e.statusCode === 422) {
      console.warn(`[Accounting] COA missing for payment journal on ${payment.paymentNumber}: ${e.message}`);
      return;
    }
    throw e;
  }
}

// ─── Trial Balance ────────────────────────────────────────────────────────────

export async function getTrialBalance(req) {
  const { getPrisma } = await import("../../config/db.js");
  const prisma = getPrisma();
  const { tenantId, companyId } = req;

  const accounts = await prisma.chartOfAccount.findMany({
    where: { tenantId, companyId, isDeleted: false },
    orderBy: { code: "asc" },
  });

  const lines = await prisma.journalEntryLine.findMany({
    where: { tenantId, companyId, isDeleted: false },
  });

  const balanceMap = new Map();
  for (const l of lines) {
    const current = balanceMap.get(l.accountId) || { debit: 0, credit: 0 };
    balanceMap.set(l.accountId, {
      debit: current.debit + l.debit,
      credit: current.credit + l.credit,
    });
  }

  return accounts.map((acc) => {
    const b = balanceMap.get(acc.id) || { debit: 0, credit: 0 };
    return {
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      totalDebit: b.debit,
      totalCredit: b.credit,
      balance: b.debit - b.credit,
    };
  });
}

// ─── Profit & Loss ────────────────────────────────────────────────────────────

export async function getProfitLoss(req, { fromDate, toDate } = {}) {
  const tb = await getTrialBalance(req);
  const income = tb.filter((a) => a.type === "INCOME");
  const expense = tb.filter((a) => a.type === "EXPENSE");

  const totalIncome = income.reduce((s, a) => s + a.totalCredit - a.totalDebit, 0);
  const totalExpense = expense.reduce((s, a) => s + a.totalDebit - a.totalCredit, 0);

  return {
    income,
    expense,
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
  };
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────

export async function getBalanceSheet(req) {
  const tb = await getTrialBalance(req);
  const assets = tb.filter((a) => a.type === "ASSET");
  const liabilities = tb.filter((a) => a.type === "LIABILITY");
  const equity = tb.filter((a) => a.type === "EQUITY");

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + (a.totalCredit - a.totalDebit), 0);
  const totalEquity = equity.reduce((s, a) => s + (a.totalCredit - a.totalDebit), 0);

  return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}

// ─── Seed COA for new tenant ──────────────────────────────────────────────────

export async function seedChartOfAccounts(tx, { tenantId, companyId, userId }) {
  const accounts = [
    ["1000", "Cash", "ASSET"],
    ["1010", "Bank", "ASSET"],
    ["1100", "Debtors (Accounts Receivable)", "ASSET"],
    ["1200", "Input CGST", "ASSET"],
    ["1210", "Input SGST", "ASSET"],
    ["1220", "Input IGST", "ASSET"],
    ["1300", "TDS Receivable", "ASSET"],
    ["2000", "Creditors (Accounts Payable)", "LIABILITY"],
    ["2100", "Output CGST", "LIABILITY"],
    ["2110", "Output SGST", "LIABILITY"],
    ["2120", "Output IGST", "LIABILITY"],
    ["2200", "TDS Payable", "LIABILITY"],
    ["3000", "Owner Equity", "EQUITY"],
    ["4000", "Sales Revenue", "INCOME"],
    ["4100", "Other Income", "INCOME"],
    ["5000", "Purchases / COGS", "EXPENSE"],
    ["5100", "Salaries & Wages", "EXPENSE"],
    ["5200", "Rent & Utilities", "EXPENSE"],
    ["5300", "Depreciation", "EXPENSE"],
    ["5400", "Other Expenses", "EXPENSE"],
  ];

  await tx.chartOfAccount.createMany({
    data: accounts.map(([code, name, type]) => ({
      tenantId, companyId,
      code, name, type,
      createdBy: userId, updatedBy: userId,
    })),
    skipDuplicates: true,
  });
}
