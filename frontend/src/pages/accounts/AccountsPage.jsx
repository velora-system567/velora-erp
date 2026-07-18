import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { accountsApi } from "../../services/api";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { SkeletonTable } from "../../components/Skeleton";
import { formatRupees } from "../../utils/money";

const TABS = ["Trial Balance", "P&L", "Balance Sheet", "Journal Entries", "GSTR-3B", "Debtor Aging"];

function TabBar({ active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
      {TABS.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${active === t ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

function TrialBalanceTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["trial-balance"], queryFn: accountsApi.trialBalance });
  const data = query.data?.data;

  if (query.isPending) return <SkeletonTable rows={8} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["trial-balance"] })} />;

  const rows = data?.rows || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>{["Code", "Account Name", "Type", "Total Debit", "Total Credit", "Balance"].map((h) => <th key={h} className="px-4 py-3 text-right first:text-left second:text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No journal entries found. Post an invoice or journal entry to see balances.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.accountId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.code}</td>
                <td className="px-4 py-3 font-medium text-slate-950">{r.name}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.type}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatRupees(r.totalDebit)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatRupees(r.totalCredit)}</td>
                <td className={`px-4 py-3 text-right font-bold tabular-nums ${r.balance < 0 ? "text-rose-700" : "text-slate-950"}`}>{formatRupees(Math.abs(r.balance))}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-50">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm font-bold text-slate-950">TOTALS</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-950">{formatRupees(data?.totalDebit || 0)}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-950">{formatRupees(data?.totalCredit || 0)}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  <span className={Math.abs((data?.totalDebit || 0) - (data?.totalCredit || 0)) < 2 ? "text-emerald-700" : "text-rose-700"}>
                    {Math.abs((data?.totalDebit || 0) - (data?.totalCredit || 0)) < 2 ? "Balanced ✓" : "⚠ Imbalanced"}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function ProfitLossTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["profit-loss"], queryFn: accountsApi.profitLoss });
  const pl = query.data?.data;

  if (query.isPending) return <SkeletonTable rows={6} cols={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["profit-loss"] })} />;

  if (!pl) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Total Income", pl.totalIncome, "text-emerald-700"], ["Total Expenses", pl.totalExpense, "text-rose-700"], ["Net Profit", pl.netProfit, pl.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"]].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{formatRupees(value)}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[["Income Accounts", pl.income], ["Expense Accounts", pl.expense]].map(([label, items]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-950">{label}</div>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>{["Account", "Balance"].map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(items || []).map((a) => (
                  <tr key={a.accountId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800">{a.name}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-950">{formatRupees(Math.abs(a.balance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function BalanceSheetTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["balance-sheet"], queryFn: accountsApi.balanceSheet });
  const bs = query.data?.data;

  if (query.isPending) return <SkeletonTable rows={6} cols={2} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["balance-sheet"] })} />;
  if (!bs) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[["Assets", bs.assets, bs.totalAssets], ["Liabilities & Equity", [...(bs.liabilities || []), ...(bs.equity || [])], bs.totalLiabilities + bs.totalEquity]].map(([label, items, total]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-950">{label}</div>
          <table className="min-w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              {(items || []).map((a) => (
                <tr key={a.accountId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{a.name}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-950">{formatRupees(Math.abs(a.balance))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-50">
              <tr>
                <td className="px-4 py-3 font-bold text-slate-950">Total {label.split(" ")[0]}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-950">{formatRupees(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
    </div>
  );
}

function JournalEntriesTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["journal-entries"], queryFn: () => accountsApi.journalEntries() });
  const rows = query.data?.data || [];

  if (query.isPending) return <SkeletonTable rows={6} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["journal-entries"] })} />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>{["Date", "Entry No", "Narration", "Lines"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400">No journal entries. They are auto-created when you post invoices and payments.</td></tr>
            ) : rows.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{new Date(e.entryDate).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{e.entryNo}</td>
                <td className="px-4 py-3 text-slate-800">{e.narration || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{e.lines?.length || 0} lines</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Gstr3bTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["gstr3b"], queryFn: accountsApi.gstr3b });
  const data = query.data?.data;

  if (query.isPending) return <SkeletonTable rows={3} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["gstr3b"] })} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[["Output GST (Collected)", data.outputTax, "text-slate-950"], ["Input Tax Credit", data.inputTax, "text-emerald-700"], ["Net GST Payable", data.netPayable, data.netPayable >= 0 ? "text-rose-700" : "text-emerald-700"]].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${color}`}>{formatRupees(value)}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-950">Outward Supplies Breakdown</h3>
        <div className="grid gap-3 sm:grid-cols-4 text-sm">
          {[["Taxable Value", data.outwardSupplies.taxableValue], ["CGST", data.outwardSupplies.cgst], ["SGST", data.outwardSupplies.sgst], ["IGST", data.outwardSupplies.igst]].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 font-bold text-slate-950">{formatRupees(value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DebtorAgingTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["debtor-aging"], queryFn: accountsApi.debtorAging });
  const data = query.data?.data;

  if (query.isPending) return <SkeletonTable rows={5} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["debtor-aging"] })} />;
  if (!data) return null;

  const buckets = data.buckets || {};
  const bucketKeys = ["current", "0-30", "31-60", "61-90", "90+"];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        {bucketKeys.map((key) => (
          <div key={key} className={`rounded-xl border p-3 shadow-sm ${key === "90+" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key === "current" ? "Current" : `${key} days`}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${key === "90+" ? "text-rose-700" : "text-slate-950"}`}>{formatRupees(buckets[key] || 0)}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>{["Invoice No", "Date", "Total", "Paid", "Outstanding", "Age (Days)"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.rows || []).filter((r) => r.outstandingAmount > 0).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.documentNo}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(r.documentDate).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{formatRupees(r.totalAmount)}</td>
                  <td className="px-4 py-3 text-emerald-700">{formatRupees(r.paidAmount)}</td>
                  <td className="px-4 py-3 font-bold text-rose-700">{formatRupees(r.outstandingAmount)}</td>
                  <td className={`px-4 py-3 font-semibold tabular-nums ${r.agingDays > 90 ? "text-rose-700" : r.agingDays > 60 ? "text-amber-700" : "text-slate-700"}`}>{r.agingDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AccountsPage() {
  const [activeTab, setActiveTab] = useState("Trial Balance");
  const tabContent = {
    "Trial Balance": <TrialBalanceTab />,
    "P&L": <ProfitLossTab />,
    "Balance Sheet": <BalanceSheetTab />,
    "Journal Entries": <JournalEntriesTab />,
    "GSTR-3B": <Gstr3bTab />,
    "Debtor Aging": <DebtorAgingTab />,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Accounts</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Double-entry accounting — journal entries, trial balance, P&L, balance sheet, and GST reports.
            </p>
          </div>
          <BarChart3 className="hidden shrink-0 text-blue-600 sm:block" size={22} />
        </div>
      </header>
      <TabBar active={activeTab} onChange={setActiveTab} />
      <div className="min-h-[300px]">{tabContent[activeTab]}</div>
    </div>
  );
}
