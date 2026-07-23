/**
 * Owner's Morning Dashboard
 *
 * The first thing an owner sees every day.
 * Answers: What should I focus on today?
 */
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowUpRight, Calendar, DollarSign, Phone,
  ShoppingCart, TrendingUp, TrendingDown, Users, Package,
  Clock, CheckCircle2, Bell,
} from "lucide-react";
import { salesApi } from "../../services/api";
import { formatRupees } from "../../utils/money";
import { KpiTile, Card, SectionHeader, Pill, StatusPill } from "../inventory/components/shared";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { ErrorState } from "../../components/ErrorState";

export default function OwnerDashboard() {
  const query = useQuery({
    queryKey: ["owner-dashboard"],
    queryFn: () => salesApi.ownerDashboard(),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 min
  });

  if (query.isPending) return <div className="space-y-4"><SkeletonCards count={4} /></div>;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const data = query.data?.data;
  if (!data) return null;

  const { today, kpis, focus, performance, insights } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 md:py-6 xl:p-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Good morning 👋</h1>
        <p className="text-sm text-slate-500">Here's what needs your attention today.</p>
      </div>

      {/* Insights */}
      {insights?.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-xl border p-4 ${
              insight.type === "positive" ? "border-emerald-200 bg-emerald-50" :
              insight.type === "warning" ? "border-amber-200 bg-amber-50" :
              "border-blue-200 bg-blue-50"
            }`}>
              {insight.icon === "trendingUp" ? <TrendingUp size={20} className="text-emerald-600" /> :
               insight.icon === "trendingDown" ? <TrendingDown size={20} className="text-amber-600" /> :
               <Bell size={20} className="text-blue-600" />}
              <p className="text-sm font-medium text-slate-900">{insight.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Today's KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Today's Revenue" value={today.revenue} tone="blue" icon={TrendingUp} formatter={formatRupees} detail={`${today.invoiceCount} invoice${today.invoiceCount === 1 ? "" : "s"}`} />
        <KpiTile label="Monthly Revenue" value={kpis.monthlyRevenue} tone="emerald" icon={DollarSign} formatter={formatRupees} />
        <KpiTile label="Pending Orders" value={kpis.pendingOrders} tone="amber" icon={ShoppingCart} detail={`${kpis.draftQuotes} draft quotes`} />
        <KpiTile label="Outstanding" value={kpis.outstandingPaise} tone="rose" icon={AlertTriangle} formatter={formatRupees} />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Today's Follow-ups */}
        <Card>
          <SectionHeader title="Today's Follow-ups" description="People you should call today" icon={Phone} />
          {today.followUps?.length ? today.followUps.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div><p className="font-medium text-slate-950">{f.name}</p><p className="text-xs text-slate-500">{f.contactPerson || f.phone || "—"}</p></div>
              <div className="text-right">
                {f.value > 0 && <p className="text-xs font-semibold text-blue-700">{formatRupees(f.value)}</p>}
                <Pill tone="blue">{f.time ? new Date(f.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Anytime"}</Pill>
              </div>
            </div>
          )) : <p className="text-sm text-slate-500 py-4 text-center">No follow-ups scheduled today</p>}
        </Card>

        {/* Overdue Invoices */}
        <Card>
          <SectionHeader title="Overdue Invoices" description="Past 30 days — needs action" icon={AlertTriangle} />
          {focus.overdueInvoices?.length ? focus.overdueInvoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div><p className="font-medium text-slate-950">{inv.customer}</p><p className="text-xs text-slate-500">{inv.documentNo}</p></div>
              <div className="text-right"><p className="font-semibold text-rose-700">{formatRupees(inv.amount)}</p><Pill tone="rose">{inv.daysOverdue}d overdue</Pill></div>
            </div>
          )) : <p className="text-sm text-slate-500 py-4 text-center">No overdue invoices ✅</p>}
        </Card>

        {/* Inactive Customers */}
        <Card>
          <SectionHeader title="Inactive Customers" description="Haven't purchased in 60+ days" icon={Users} />
          {focus.inactiveCustomers?.length ? focus.inactiveCustomers.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <p className="font-medium text-slate-950">{c.name}</p>
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                <Phone size={13} className="inline mr-1" /> Call
              </button>
            </div>
          )) : <p className="text-sm text-slate-500 py-4 text-center">No inactive customers</p>}
        </Card>
      </div>

      {/* Low Stock + Recent Wins */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Low Stock Alerts" description="Items below reorder level" icon={Package} />
          {focus.lowStockItems?.length ? focus.lowStockItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div><p className="font-medium text-slate-950">{item.name}</p><p className="text-xs text-slate-500">{item.itemCode}</p></div>
              <div className="text-right"><Pill tone="rose">{item.onHand} left</Pill><p className="text-xs text-slate-500 mt-0.5">Reorder at {item.reorderLevel}</p></div>
            </div>
          )) : <p className="text-sm text-slate-500 py-4 text-center">All items well-stocked ✅</p>}
        </Card>

        <Card>
          <SectionHeader title="Recent Wins" description="Invoices created this month" icon={CheckCircle2} />
          {performance.recentWins?.length ? performance.recentWins.map((w) => (
            <div key={w.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div><p className="font-medium text-slate-950">{w.customer}</p><p className="text-xs text-slate-500">{w.documentNo}</p></div>
              <div className="text-right"><p className="font-semibold text-emerald-700">{formatRupees(w.amount)}</p><p className="text-xs text-slate-500">{new Date(w.date).toLocaleDateString("en-IN")}</p></div>
            </div>
          )) : <p className="text-sm text-slate-500 py-4 text-center">No invoices this month</p>}
        </Card>
      </div>

      {/* Top Products */}
      {performance.topProducts?.length > 0 && (
        <Card>
          <SectionHeader title="Top Selling Products" description="This month" icon={TrendingUp} />
          <div className="space-y-2">
            {performance.topProducts.map((p, i) => (
              <div key={p.itemId} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">{i + 1}</span>
                  <p className="font-medium text-slate-950">{p.name}</p>
                </div>
                <div className="text-right"><p className="font-semibold">{Number(p.quantity).toFixed(0)} sold</p><p className="text-xs text-slate-500">{formatRupees(p.revenue)}</p></div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="w-full text-sm font-semibold text-slate-700 mb-1">Quick Actions</p>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><ShoppingCart size={16} /> New Order</button>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileText size={16} /> New Quote</button>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><DollarSign size={16} /> Record Payment</button>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Users size={16} /> Add Customer</button>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Phone size={16} /> Follow-up</button>
      </div>
    </div>
  );
}

function FileText({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
