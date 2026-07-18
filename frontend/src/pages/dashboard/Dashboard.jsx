import { useQuery } from "@tanstack/react-query";
import { Building2, ClipboardCheck, Package, ReceiptText, WalletCards, TrendingUp, AlertTriangle } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { SkeletonCards } from "../../components/Skeleton";
import { getDashboardKpis, getSalesChart, getTopItems, hasApiBaseUrl } from "../../services/api";
import { formatRupeesCompact, formatRupees } from "../../utils/money";

function KpiCard({ label, value, icon: Icon, color = "text-blue-600", formatter }) {
  const display = formatter ? formatter(value) : value;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
      <Icon className={color} size={20} />
      <p className="mt-4 text-2xl font-bold tabular-nums text-slate-950">{display}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </div>
  );
}

export function Dashboard() {
  const kpisQuery = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: getDashboardKpis,
    retry: 1,
    enabled: hasApiBaseUrl,
    staleTime: 60 * 1000,
  });

  const chartQuery = useQuery({
    queryKey: ["dashboard-sales-chart"],
    queryFn: getSalesChart,
    retry: 1,
    enabled: hasApiBaseUrl,
    staleTime: 5 * 60 * 1000,
  });

  const topItemsQuery = useQuery({
    queryKey: ["dashboard-top-items"],
    queryFn: getTopItems,
    retry: 1,
    enabled: hasApiBaseUrl,
    staleTime: 5 * 60 * 1000,
  });

  const kpis = kpisQuery.data?.data;
  const salesRows = chartQuery.data?.data?.rows || [];
  const topItems = topItemsQuery.data?.data?.rows || [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-6 md:py-6 xl:p-8">
      {/* Header */}
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-700">Business Overview</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
              {kpis ? "Live Operations Dashboard" : "Start with your company data"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {kpis
                ? "Real-time KPIs from your sales, purchases, inventory, and collections."
                : "Add company details, items, customers, and opening stock to activate live KPIs."}
            </p>
          </div>
          <Building2 className="hidden shrink-0 text-blue-600 sm:block" size={24} />
        </div>
      </header>

      {/* KPI Cards */}
      {kpisQuery.isPending ? (
        <SkeletonCards count={4} />
      ) : kpisQuery.isError ? (
        <ErrorState error={kpisQuery.error} title="Could not load KPIs" />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Today's Sales" value={kpis?.todaysSalesPaise ?? 0} icon={ReceiptText} formatter={formatRupeesCompact} />
          <KpiCard label="Outstanding Receivables" value={kpis?.totalOutstandingPaise ?? 0} icon={WalletCards} color="text-amber-600" formatter={formatRupeesCompact} />
          <KpiCard label="Low Stock Items" value={kpis?.lowStockItemCount ?? 0} icon={Package} color={kpis?.lowStockItemCount > 0 ? "text-rose-600" : "text-slate-400"} />
          <KpiCard label="Pending Purchase Orders" value={kpis?.pendingPurchaseOrders ?? 0} icon={ClipboardCheck} color="text-purple-600" />
        </section>
      )}

      {/* Secondary KPIs */}
      {kpis && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly Sales</p>
            <p className="mt-1.5 text-xl font-bold text-slate-950">{formatRupeesCompact(kpis.monthlySalesPaise)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today's Collections</p>
            <p className="mt-1.5 text-xl font-bold text-emerald-700">{formatRupeesCompact(kpis.todaysCollectionsPaise)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today's Invoices</p>
            <p className="mt-1.5 text-xl font-bold text-slate-950">{kpis.todaysInvoiceCount}</p>
          </div>
        </section>
      )}

      {/* Charts row */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Sales Trend */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-600">7-Day Sales Trend</p>
              <p className="mt-1 text-3xl font-bold text-slate-950">
                {formatRupeesCompact(kpis?.todaysSalesPaise || 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Based on approved invoices</p>
            </div>
            <TrendingUp className="text-blue-600" size={22} />
          </div>
          <div className="mt-5 h-56">
            {chartQuery.isPending ? (
              <div className="h-full animate-pulse rounded-xl bg-slate-100" />
            ) : salesRows.some((r) => r.sales > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesRows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Sales"]} />
                  <Area type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No Sales Yet" description="Post an invoice to see the 7-day trend." action="" />
            )}
          </div>
        </div>

        {/* Top Items */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Top Items This Month</p>
          <div className="mt-3 space-y-2">
            {topItemsQuery.isPending ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)
            ) : topItems.length === 0 ? (
              <EmptyState title="No Sales Data" description="Post invoices with item lines to see top performers." action="" />
            ) : (
              topItems.slice(0, 8).map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700">{i + 1}</span>
                    <span className="text-sm font-medium text-slate-950 truncate">{r.item?.name || r.item?.id || "Unknown"}</span>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-slate-950">{formatRupeesCompact(r.totalSalesPaise)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Low stock warning strip */}
      {kpis?.lowStockItemCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={18} className="shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            <span className="font-semibold">{kpis.lowStockItemCount} item{kpis.lowStockItemCount > 1 ? "s" : ""}</span>{" "}
            at or below reorder level. Check the Inventory module to review.
          </p>
        </div>
      )}

      {/* No API warning */}
      {!hasApiBaseUrl && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          Frontend running without a connected backend API. Set{" "}
          <span className="font-mono font-semibold">VITE_API_BASE_URL</span> to your deployed Express API URL.
        </section>
      )}
    </div>
  );
}
