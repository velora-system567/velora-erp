import { useQuery } from "@tanstack/react-query";
import { Building2, ClipboardCheck, Package, ReceiptText, WalletCards } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "../../components/EmptyState";
import { getDashboardKpis, getSalesChart, hasApiBaseUrl } from "../../services/api";

export function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: getDashboardKpis,
    retry: false,
    enabled: hasApiBaseUrl,
  });
  const chartQuery = useQuery({
    queryKey: ["dashboard-sales-chart"],
    queryFn: getSalesChart,
    retry: false,
    enabled: hasApiBaseUrl,
  });
  const kpis = data?.data;
  const salesRows = chartQuery.data?.data?.rows || [];

  const cards = [
    ["Today's Sales", kpis?.todaysSalesPaise ?? 0, ReceiptText],
    ["Outstanding", kpis?.totalOutstandingPaise ?? 0, WalletCards],
    ["Low Stock Items", kpis?.lowStockItems?.length ?? 0, Package],
    ["Pending POs", kpis?.pendingPurchaseOrders ?? 0, ClipboardCheck],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-6 md:py-6 xl:p-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-700">Business Overview</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">Start with your company data</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              This ERP starts empty. Add company, branches, employees, items, customers, vendors, and opening stock to activate live KPIs.
            </p>
          </div>
          <Building2 className="hidden shrink-0 text-blue-600 sm:block" size={24} />
        </div>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Icon className="text-blue-600" size={20} />
            <p className="mt-4 text-2xl font-semibold text-slate-950">{value}</p>
            <p className="mt-1 text-sm text-slate-600">{label}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-600">Today's Sales</p>
              <p className="mt-1 text-3xl font-semibold text-slate-950">₹{((kpis?.todaysSalesPaise || 0) / 100).toLocaleString("en-IN")}</p>
              <p className="mt-1 text-xs text-slate-500">Last 7 days from saved sales records</p>
            </div>
            <ReceiptText className="text-blue-600" size={22} />
          </div>
          <div className="mt-5 h-56">
            {salesRows.some((row) => row.sales > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesRows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Sales"]} />
                  <Area type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} fill="url(#salesFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No Sales Yet" description="Add a sales record to see the sales trend." action="" />
            )}
          </div>
        </div>
        <EmptyState title="No Stock Data" description="Add warehouses, items, and opening stock to start inventory tracking." action="Add Opening Stock" />
      </section>
      {!hasApiBaseUrl ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          This hosted frontend is running without a connected backend API. Set <span className="font-mono font-semibold">VITE_API_BASE_URL</span> in Vercel after deploying the Express API.
        </section>
      ) : null}
    </div>
  );
}
