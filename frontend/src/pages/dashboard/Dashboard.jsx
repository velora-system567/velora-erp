import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, ClipboardCheck, Package, ReceiptText, WalletCards, TrendingUp, AlertTriangle, Plus, ShoppingCart, Users, FileText, CreditCard } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { SkeletonCards } from "../../components/Skeleton";
import LiveIndicator from "../../components/LiveIndicator";
import { getDashboardKpis, getSalesChart, getTopItems, hasApiBaseUrl } from "../../services/api";
import { formatRupeesCompact, formatRupees } from "../../utils/money";
import { useAuthStore } from "../../store/auth";

function KpiCard({ label, value, icon: Icon, color = "text-blue-600", formatter, to }) {
  const display = formatter ? formatter(value) : value;
  const body = (
    <>
      <Icon className={`${color} transition-transform duration-150`} size={20} />
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-slate-950">{display}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </>
  );
  const cls = "group rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-md hover:border-slate-300";
  if (to) {
    return (
      <Link to={to} className={`${cls} block cursor-pointer`}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const QUICK_ACTIONS = [
  { label: "New Sale", icon: ShoppingCart, to: "/sales?tab=Orders", color: "bg-blue-600 hover:bg-blue-700" },
  { label: "Add Customer", icon: Users, to: "/crm", color: "bg-emerald-600 hover:bg-emerald-700" },
  { label: "New Quotation", icon: FileText, to: "/sales?tab=Quotations", color: "bg-purple-600 hover:bg-purple-700" },
  { label: "Record Payment", icon: CreditCard, to: "/sales?tab=Receipts", color: "bg-amber-600 hover:bg-amber-700" },
  { label: "Add Product", icon: Package, to: "/inventory", color: "bg-slate-700 hover:bg-slate-800" },
];

export function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const firstName = (user?.name || "").split(" ")[0] || "there";
  const kpisQuery = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: getDashboardKpis,
    retry: 1,
    enabled: hasApiBaseUrl,
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
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
      {/* Header — human greeting */}
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-700">Business Overview</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
              {kpis ? `${getGreeting()}, ${firstName}` : `Welcome to Velora, ${firstName}`}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {kpis
                ? "Here is what is happening in your business today."
                : "Let's get your business set up. Add your company details, products, and customers to get started."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            <LiveIndicator query={kpisQuery} onRefresh={kpisQuery.refetch} label="Dashboard" />
            <Building2 className="hidden text-blue-600 sm:block" size={24} />
          </div>
        </div>
      </header>

      {/* Quick Actions — "What do you want to do?" */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-semibold text-slate-900">What do you want to do?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ label, icon: ActionIcon, to, color }) => (
            <Link
              key={label}
              to={to}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 ${color}`}
            >
              <Plus size={15} />
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* KPI Cards — each opens its live operational list */}
      {kpisQuery.isPending ? (
        <SkeletonCards count={4} />
      ) : kpisQuery.isError ? (
        <ErrorState error={kpisQuery.error} title="Could not load KPIs" />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Today's sales" value={kpis?.todaysSalesPaise ?? 0} icon={ReceiptText} formatter={formatRupeesCompact} to="/sales" />
          <KpiCard label="Money owed to you" value={kpis?.totalOutstandingPaise ?? 0} icon={WalletCards} color="text-amber-600" formatter={formatRupeesCompact} to="/accounts" />
          <KpiCard label="Products low in stock" value={kpis?.lowStockItemCount ?? 0} icon={Package} color={kpis?.lowStockItemCount > 0 ? "text-rose-600" : "text-slate-400"} to="/inventory" />
          <KpiCard label="Pending orders" value={kpis?.pendingPurchaseOrders ?? 0} icon={ClipboardCheck} color="text-purple-600" to="/purchase" />
        </section>
      )}

      {/* Needs your attention */}
      {kpis && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-sm font-semibold text-slate-900">Needs your attention</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {kpis.totalOutstandingPaise > 0 && (
              <Link to="/accounts" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 transition-all duration-150 hover:border-amber-300 hover:shadow-sm">
                <WalletCards size={18} className="shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{formatRupeesCompact(kpis.totalOutstandingPaise)} pending</p>
                  <p className="text-xs text-slate-500">Money customers owe you</p>
                </div>
              </Link>
            )}
            {kpis.lowStockItemCount > 0 && (
              <Link to="/inventory" className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 transition-all duration-150 hover:border-rose-300 hover:shadow-sm">
                <Package size={18} className="shrink-0 text-rose-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{kpis.lowStockItemCount} product{kpis.lowStockItemCount > 1 ? "s" : ""} low in stock</p>
                  <p className="text-xs text-slate-500">May need to reorder soon</p>
                </div>
              </Link>
            )}
            {kpis.pendingPurchaseOrders > 0 && (
              <Link to="/purchase" className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 p-3 transition-all duration-150 hover:border-purple-300 hover:shadow-sm">
                <ClipboardCheck size={18} className="shrink-0 text-purple-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{kpis.pendingPurchaseOrders} pending order{kpis.pendingPurchaseOrders > 1 ? "s" : ""}</p>
                  <p className="text-xs text-slate-500">Purchase orders to track</p>
                </div>
              </Link>
            )}
            {kpis.totalOutstandingPaise === 0 && kpis.lowStockItemCount === 0 && kpis.pendingPurchaseOrders === 0 && (
              <div className="col-span-full py-2 text-center text-sm text-slate-500">All clear — nothing needs your attention right now.</div>
            )}
          </div>
        </section>
      )}

      {/* Secondary KPIs */}
      {kpis && (
        <section className="grid gap-3 sm:grid-cols-3">
          <Link to="/sales" className="group rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all duration-200 hover:border-blue-300 hover:shadow-md">
            <p className="erp-section-title">This month's revenue</p>
            <p className="mt-2 text-xl font-bold tabular-nums text-slate-950">{formatRupeesCompact(kpis.monthlySalesPaise)}</p>
          </Link>
          <Link to="/sales" className="group rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all duration-200 hover:border-emerald-300 hover:shadow-md">
            <p className="erp-section-title">Money collected today</p>
            <p className="mt-2 text-xl font-bold tabular-nums text-emerald-700">{formatRupeesCompact(kpis.todaysCollectionsPaise)}</p>
          </Link>
          <Link to="/sales" className="group rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all duration-200 hover:border-blue-300 hover:shadow-md">
            <p className="erp-section-title">Invoices created today</p>
            <p className="mt-2 text-xl font-bold tabular-nums text-slate-950">{kpis.todaysInvoiceCount}</p>
          </Link>
        </section>
      )}

      {/* Charts row */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Sales Trend */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Sales this week</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-950">
                {formatRupeesCompact(kpis?.todaysSalesPaise || 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Based on recent invoices</p>
            </div>
            <TrendingUp className="text-blue-500" size={20} />
          </div>
          <div className="mt-4 h-52">
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
              <EmptyState title="No sales yet" description="Post an invoice to see your sales trend here." action="" />
            )}
          </div>
        </div>

        {/* Top Items */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-sm font-medium text-slate-500">Best-selling products this month</p>
          <div className="mt-3 space-y-1">
            {topItemsQuery.isPending ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)
            ) : topItems.length === 0 ? (
              <EmptyState title="No sales data yet" description="Once you create sales, your best products will appear here." action="" />
            ) : (
              topItems.slice(0, 8).map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{i + 1}</span>
                    <span className="text-sm text-slate-700 truncate">{r.item?.name || "Unknown item"}</span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatRupeesCompact(r.totalSalesPaise)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Low stock warning strip */}
      {kpis?.lowStockItemCount > 0 && (
        <Link to="/inventory" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-all duration-200 hover:border-amber-300 hover:shadow-sm">
          <AlertTriangle size={18} className="shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{kpis.lowStockItemCount} product{kpis.lowStockItemCount > 1 ? "s" : ""}</span>{" "}
            running low on stock. Click here to review and reorder.
          </p>
        </Link>
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
