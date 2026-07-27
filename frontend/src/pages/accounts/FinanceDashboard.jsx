import { useQuery } from "@tanstack/react-query";
import {
  DollarSign, TrendingUp, TrendingDown, Receipt, CreditCard,
  Building2, BarChart3, RefreshCw, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { accountsApi } from "../../services/api";
import { formatRupees } from "../../utils/money";
import { EmptyState } from "../../components/EmptyState";
import { Card, KpiTile, SectionHeader, number } from "../inventory/components/shared";
import { SkeletonCards } from "../../components/Skeleton";
import { ErrorState } from "../../components/ErrorState";

export default function FinanceDashboard() {
  const query = useQuery({
    queryKey: ["finance-dashboard"],
    queryFn: () => accountsApi.dashboard(),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (query.isPending) return <div className="space-y-4"><SkeletonCards count={6} /></div>;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const data = query.data?.data;
  if (!data) return <EmptyState title="No financial data" description="Post journal entries or invoices to see your financial position." />;
  const { kpis, chartOfAccounts } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 md:py-6 xl:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Financial Dashboard</h1>
        <p className="text-sm text-slate-500">Your company's financial position at a glance.</p>
      </div>

      {/* Cash & Liquidity */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Total Cash" value={kpis.totalCash} tone="emerald" icon={DollarSign} formatter={formatRupees} detail={`Cash: ${formatRupees(kpis.cashBalance)} · Bank: ${formatRupees(kpis.bankBalance)}`} />
        <KpiTile label="Receivables" value={kpis.receivables} tone="amber" icon={Receipt} formatter={formatRupees} detail={`${kpis.outstandingInvoices} outstanding invoices`} />
        <KpiTile label="Payables" value={kpis.payables} tone="rose" icon={CreditCard} formatter={formatRupees} detail={`${kpis.outstandingBills} unpaid bills`} />
        <KpiTile label="GST Payable" value={kpis.gstPayable} tone="purple" icon={BarChart3} formatter={formatRupees} />
      </section>

      {/* Profit & Revenue */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Revenue" value={kpis.revenue} tone="blue" icon={TrendingUp} formatter={formatRupees} />
        <KpiTile label="Expenses" value={kpis.expenses} tone="rose" icon={TrendingDown} formatter={formatRupees} />
        <KpiTile label="Net Profit" value={kpis.netProfit} tone={kpis.netProfit >= 0 ? "emerald" : "rose"} icon={kpis.netProfit >= 0 ? ArrowUpRight : ArrowDownRight} formatter={formatRupees} />
        <KpiTile label="Monthly Revenue" value={kpis.monthlyRevenue} tone="blue" icon={BarChart3} formatter={formatRupees} />
      </section>

      {/* Chart of Accounts Summary */}
      {chartOfAccounts?.length > 0 && (
        <Card>
          <SectionHeader title="Chart of Accounts" description="Balance by account type" icon={Building2} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map((type) => {
              const accounts = chartOfAccounts.filter((a) => a.type === type);
              const total = accounts.reduce((s, a) => s + Math.abs(a.balance), 0);
              return (
                <div key={type} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{type.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{formatRupees(total)}</p>
                  <p className="text-xs text-slate-500">{accounts.length} accounts</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
