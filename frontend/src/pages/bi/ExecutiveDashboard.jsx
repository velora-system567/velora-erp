import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package,
  AlertTriangle, CheckCircle2, Building2, RefreshCw, BarChart3,
  Activity, Clock, CreditCard,
} from "lucide-react";
import { biApi } from "../../services/api";
import { formatRupees } from "../../utils/money";
import { Card, KpiTile, SectionHeader, Pill, StatusPill, number, dateTime } from "../inventory/components/shared";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader, SecondaryButton } from "../../components/PageHeader";

export default function ExecutiveDashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const activityRoute = (type) => {
    if (type === "INVOICE" || type === "SALES_ORDER" || type === "QUOTATION" || type === "DELIVERY_NOTE") return "/sales";
    if (type === "PURCHASE_ORDER" || type === "PURCHASE_REQUEST" || type === "RFQ" || type === "GRN") return "/purchase";
    return null;
  };

  const execQuery = useQuery({
    queryKey: ["bi-executive"],
    queryFn: () => biApi.executiveDashboard(),
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const deptQuery = useQuery({
    queryKey: ["bi-departments"],
    queryFn: () => biApi.departments(),
    staleTime: 5 * 60 * 1000,
  });

  const insightsQuery = useQuery({
    queryKey: ["bi-insights"],
    queryFn: () => biApi.insights(),
    staleTime: 10 * 60 * 1000,
  });

  if (execQuery.isPending) return <div className="space-y-4 p-8"><SkeletonCards count={8} /></div>;
  if (execQuery.isError) return <ErrorState error={execQuery.error} onRetry={() => qc.invalidateQueries({ queryKey: ["bi"] })} />;

  const data = execQuery.data?.data;
  if (!data || !data.kpis) return <EmptyState title="No executive data" description="Connect your backend API to see business insights." />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 md:py-6 xl:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Executive Command Center</h1>
          <p className="text-sm text-slate-500">Your business at a glance. Last updated {dateTime(data.timestamp)}.</p>
        </div>
        <SecondaryButton label="Refresh" icon={RefreshCw} onClick={() => qc.invalidateQueries({ queryKey: ["bi"] })} />
      </div>

      {/* Business Health Score */}
      {data.health?.factors && (
        <Card className={`border-2 ${data.health.score >= 80 ? "border-emerald-200" : data.health.score >= 60 ? "border-blue-200" : data.health.score >= 40 ? "border-amber-200" : "border-rose-200"}`}>
          <div className="flex items-center gap-4">
            <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${data.health.score >= 80 ? "bg-emerald-100" : data.health.score >= 60 ? "bg-blue-100" : data.health.score >= 40 ? "bg-amber-100" : "bg-rose-100"}`}>
              <span className="text-2xl font-bold">{data.health.score}</span>
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-950">Business Health Score</p>
              <p className="text-sm text-slate-600">{data.health.status}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {Object.entries(data.health.factors).map(([key, ok]) => (
                  <span key={key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {ok ? "✓" : "✗"} {key}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* KPI Grid */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Today's Revenue" value={data.kpis.todayRevenue} tone="blue" icon={DollarSign} formatter={formatRupees} />
        <KpiTile label="Monthly Revenue" value={data.kpis.monthlyRevenue} tone="emerald" icon={TrendingUp} formatter={formatRupees} detail={data.kpis.revenueGrowth >= 0 ? `+${data.kpis.revenueGrowth}% vs last month` : `${data.kpis.revenueGrowth}% vs last month`} />
        <KpiTile label="Pending Orders" value={data.kpis.pendingOrders} tone="amber" icon={ShoppingCart} detail={`${data.kpis.todayOrders} today`} />
        <KpiTile label="New Customers" value={data.kpis.newCustomers} tone="purple" icon={Users} detail={`${data.kpis.totalCustomers} total`} />
        <KpiTile label="Receivables" value={data.kpis.receivables} tone="rose" icon={CreditCard} formatter={formatRupees} detail={`${data.kpis.outstandingInvoices} invoices`} />
        <KpiTile label="Payables" value={data.kpis.payables} tone="amber" icon={AlertTriangle} formatter={formatRupees} />
        <KpiTile label="GST Payable" value={data.kpis.gstPayable} tone="purple" icon={BarChart3} formatter={formatRupees} />
        <KpiTile label="Inventory" value={data.kpis.inventoryValue} tone="slate" icon={Package} formatter={(v) => number(v, 0)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {/* Department Scorecards */}
        <DeptScorecards query={deptQuery} />
        {/* Business Insights */}
        <InsightsPanel query={insightsQuery} />
      </section>

      {/* Recent Activity */}
      {data.recentActivity?.length > 0 && (
        <Card padding="p-0">
          <div className="border-b border-slate-200 p-5">
            <SectionHeader title="Recent Activity" description="Last 30 days" icon={Activity} />
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentActivity.map((a) => {
              const route = activityRoute(a.type);
              const row = (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${a.type === "INVOICE" ? "bg-emerald-50" : a.type === "SALES_ORDER" ? "bg-blue-50" : a.type === "PURCHASE_ORDER" ? "bg-amber-50" : "bg-slate-50"}`}>
                      {a.type === "INVOICE" ? <DollarSign size={14} className="text-emerald-600" /> :
                       a.type === "SALES_ORDER" ? <ShoppingCart size={14} className="text-blue-600" /> :
                       <Package size={14} className="text-amber-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-950">{a.ref || a.type}</p>
                      <p className="text-xs text-slate-500">{(a.type || "").replace(/_/g, " ")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {a.amount > 0 && <p className="font-semibold text-sm">{formatRupees(a.amount)}</p>}
                    <StatusPill status={a.status} />
                  </div>
                </>
              );
              return route ? (
                <button key={a.id} onClick={() => navigate(route)} className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-slate-50">
                  {row}
                </button>
              ) : (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">{row}</div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function DeptScorecards({ query }) {
  if (query.isPending) return <SkeletonCards count={5} />;
  const depts = query.data?.data || [];
  return (
    <Card>
      <SectionHeader title="Department Scorecards" description="Performance at a glance" icon={Building2} />
      <div className="space-y-3">
        {depts.map((dept) => (
          <div key={dept.name} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-950">{dept.name}</p>
                <Pill tone={dept.score >= 80 ? "emerald" : dept.score >= 60 ? "blue" : "amber"}>{dept.score}%</Pill>
              </div>
              <span className={`text-xs font-semibold ${dept.trend === "up" ? "text-emerald-600" : "text-slate-400"}`}>
                {dept.trend === "up" ? "↑ Improving" : "→ Stable"}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-xs text-slate-500">{dept.metric}</p>
              {dept.revenue > 0 && <p className="text-xs font-semibold">{formatRupees(dept.revenue)}</p>}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${dept.score >= 80 ? "bg-emerald-500" : dept.score >= 60 ? "bg-blue-500" : "bg-amber-500"}`}
                style={{ width: `${dept.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InsightsPanel({ query }) {
  if (query.isPending) return <SkeletonCards count={3} />;
  const insights = query.data?.data || [];
  return (
    <Card>
      <SectionHeader title="Business Insights" description="AI-powered analysis" icon={Activity} />
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className={`rounded-xl border p-4 ${insight.type === "positive" ? "border-emerald-200 bg-emerald-50" : insight.type === "warning" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}>
            <div className="flex items-start gap-3">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${insight.type === "positive" ? "bg-emerald-100" : insight.type === "warning" ? "bg-amber-100" : "bg-blue-100"}`}>
                {insight.icon === "trendingUp" ? <TrendingUp size={16} className="text-emerald-600" /> :
                 insight.icon === "alert" ? <AlertTriangle size={16} className="text-amber-600" /> :
                 insight.icon === "users" ? <Users size={16} className="text-amber-600" /> :
                 insight.icon === "star" ? <CheckCircle2 size={16} className="text-emerald-600" /> :
                 <Activity size={16} className="text-blue-600" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">{insight.title}</p>
                <p className="text-xs text-slate-600 mt-0.5">{insight.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
