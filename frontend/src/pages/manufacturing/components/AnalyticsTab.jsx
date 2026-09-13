import { useMemo } from "react";
import { useManufacturingAnalytics } from "../hooks/useManufacturingApi";
import { useProductionOrders } from "../hooks/useManufacturingApi";
import { useMachines } from "../hooks/useManufacturingApi";
import { useMfgListData } from "./useMfgListData";
import { BarChart3, TrendingUp, DollarSign, Activity, Settings, FileText, AlertOctagon } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend, Cell } from "recharts";
import { EmptyState } from "./EmptyState";

const CHART_PALETTE = ["#2563eb", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

export function AnalyticsTab() {
  const analyticsQuery = useManufacturingAnalytics();
  const productionOrdersQuery = useProductionOrders();
  const machinesQuery = useMachines();

  const { list: productionOrders, isEmpty: isProductionOrdersEmpty } = useMfgListData(productionOrdersQuery);
  const { list: machines, isEmpty: isMachinesEmpty } = useMfgListData(machinesQuery);

  const isLoading = analyticsQuery.isLoading || productionOrdersQuery.isLoading || machinesQuery.isLoading;
  const hasError = analyticsQuery.error || productionOrdersQuery.error || machinesQuery.error;
  const hasAnyData = !isProductionOrdersEmpty || !isMachinesEmpty;

  if (!isLoading && !hasError && !hasAnyData) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-10">
        <EmptyState title="No analytics data" subtitle="Production and machine data will appear here once you create orders and register machines." />
      </div>
    );
  }

  if (!isLoading && hasError) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-10">
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center">
          <p className="text-lg font-semibold text-rose-700">Unable to load analytics</p>
          <p className="mt-2 text-sm text-slate-600">Please try again.</p>
        </div>
      </div>
    );
  }

  // Use real analytics data from backend, fallback to empty arrays
  const analytics = analyticsQuery.data?.data || {};

  // 1. Output chart data from real production orders by status
  const outputData = useMemo(() => {
    if (analytics.productionOrders && analytics.productionOrders.length > 0) {
      return analytics.productionOrders.map((s) => ({
        name: s.status,
        planned: 0,
        actual: s._count || 0,
      }));
    }
    return productionOrders.length > 0
      ? productionOrders.reduce((acc, o) => {
          const existing = acc.find((a) => a.name === o.status);
          if (existing) {
            existing.actual += 1;
          } else {
            acc.push({ name: o.status, planned: 0, actual: 1 });
          }
          return acc;
        }, [])
      : [];
  }, [analytics.productionOrders, productionOrders]);

  // 2. Cost chart - not available from backend yet
  const costData = useMemo(() => {
    return [];
  }, [productionOrders]);

  // 3. OEE trend from quality data
  const oeeData = useMemo(() => {
    if (analytics.quality && analytics.quality.passRatePct !== undefined) {
      const rate = parseFloat(analytics.quality.passRatePct);
      if (rate > 0) {
        return [{ name: "Today", oee: rate }];
      }
    }
    return [];
  }, [analytics.quality]);

  // 4. Downtime reasons from maintenance data
  const downtimeData = useMemo(() => {
    if (analytics.maintenance && analytics.maintenance.length > 0) {
      return analytics.maintenance.map((m) => ({
        reason: `${m.taskType} - ${m.status}`,
        minutes: 0,
        type: m.taskType === "PREVENTIVE" ? "Planned" : "Unplanned",
      }));
    }
    return [];
  }, [analytics.maintenance]);

  // 5. Defect trend from quality pass rate
  const defectData = useMemo(() => {
    if (analytics.quality && analytics.quality.passRatePct !== undefined) {
      const scrapRate = (100 - parseFloat(analytics.quality.passRatePct)).toFixed(1);
      if (parseFloat(scrapRate) > 0) {
        return [{ name: "Today", rate: parseFloat(scrapRate) }];
      }
    }
    return [];
  }, [analytics.quality]);

  // 6. Top Products volume data from real production orders
  const topProductsData = useMemo(() => {
    if (productionOrders.length === 0) return [];

    const productVolumes = productionOrders.reduce((acc, o) => {
      const qty = Number(o.quantity || 0);
      if (!acc[o.itemId || o.product]) {
        acc[o.itemId || o.product] = { name: o.product || "Unknown", qty: 0 };
      }
      acc[o.itemId || o.product].qty += qty;
      return acc;
    }, {});

    return Object.values(productVolumes)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map((p, i) => ({ ...p, fill: CHART_PALETTE[i % CHART_PALETTE.length] }));
  }, [productionOrders]);

  // 7. Top Machines by utilization
  const topMachinesData = useMemo(() => {
    return machines
      .map((m) => ({ name: m.machineCode || m.id, utilization: m.utilizationPct || 0 }))
      .sort((a, b) => b.utilization - a.utilization)
      .slice(0, 5);
  }, [machines]);

  return (
    <div className="space-y-6">

      {/* Upper Grid: Output & Cost & OEE */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

        {/* Output chart */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Activity size={14} className="text-indigo-500" />
              Production Output (planned vs actual)
            </h4>
            <p className="text-[10px] text-slate-400">Total wafer die volumes processed daily</p>
          </div>
          <div className="w-full text-xs font-semibold" style={{ height: 160 }}>
            {outputData.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={outputData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="planned" name="Planned" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="Actual" fill="#2563eb" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-slate-400 text-xs">
                No production order data available
              </div>
            )}
          </div>
        </div>

        {/* Cost chart */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <DollarSign size={14} className="text-emerald-500" />
              Process Expenditure (INR Lakhs)
            </h4>
            <p className="text-[10px] text-slate-400">Wafer dicing, lithography, DRIE chemical feeds cost</p>
          </div>
          <div className="w-full text-xs font-semibold" style={{ height: 160 }}>
            {costData.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={costData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="litho" name="Litho" fill="#2563eb" stackId="a" />
                  <Bar dataKey="etch" name="Etching" fill="#0ea5e9" stackId="a" />
                  <Bar dataKey="bond" name="Bonding" fill="#f59e0b" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-slate-400 text-xs">
                Cost tracking not yet available
              </div>
            )}
          </div>
        </div>

        {/* OEE efficiency */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-blue-500" />
              OEE Composite Trends
            </h4>
            <p className="text-[10px] text-slate-400">Shift OEE composite ratios timeline</p>
          </div>
          <div className="w-full text-xs font-semibold" style={{ height: 160 }}>
            {oeeData.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={oeeData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip />
                  <Line dataKey="oee" name="OEE %" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-slate-400 text-xs">
                No quality data available
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Middle Grid: Downtime, Defects & Material Usage */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

        {/* Downtime Graph */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Settings size={14} className="text-slate-500" />
              Downtime Distribution (Minutes)
            </h4>
            <p className="text-[10px] text-slate-400">Planned PM vs Unplanned excursions</p>
          </div>
          <div className="w-full text-xs font-semibold" style={{ height: 160 }}>
            {downtimeData.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={downtimeData} layout="vertical" margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis dataKey="reason" type="category" width={120} tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="minutes">
                    {downtimeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.type === "Planned" ? "#3b82f6" : "#f43f5e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-slate-400 text-xs">
                No maintenance data available
              </div>
            )}
          </div>
        </div>

        {/* Quality Defect Graph */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <AlertOctagon size={14} className="text-rose-500" />
              Defect Scrap Rate (%)
            </h4>
            <p className="text-[10px] text-slate-400">Silicon die scrap percentages per day</p>
          </div>
          <div className="w-full text-xs font-semibold" style={{ height: 160 }}>
            {defectData.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={defectData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis domain={[0, 6]} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip />
                  <Line dataKey="rate" name="Scrap %" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-slate-400 text-xs">
                No quality inspection data available
              </div>
            )}
          </div>
        </div>

        {/* Material Consumption compound */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText size={14} className="text-sky-500" />
              Daily SOI Wafer Consumption
            </h4>
            <p className="text-[10px] text-slate-400">Total pcs 200mm wafers drawn from stocks</p>
          </div>
          <div className="w-full text-xs font-semibold" style={{ height: 160 }}>
            <div className="h-[160px] flex items-center justify-center text-slate-400 text-xs">
              Material consumption tracking not yet implemented
            </div>
          </div>
        </div>

      </div>

      {/* Lower Grid: Top Products vs Top Machines horizontal bars */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Top products Horizontal bar */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Products by Volume Output</h4>
            <p className="text-[10px] text-slate-400">Wafer die manufacturing yields</p>
          </div>
          <div className="w-full text-xs font-semibold" style={{ height: 180 }}>
            {topProductsData.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={topProductsData} layout="vertical" margin={{ top: 8, right: 8, left: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={110} tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-400 text-xs">
                No production order data available
              </div>
            )}
          </div>
        </div>

        {/* Top Machines Horizontal bar */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Machines by Utilization</h4>
            <p className="text-[10px] text-slate-400">Active tooling utilization rates</p>
          </div>
          <div className="w-full text-xs font-semibold" style={{ height: 180 }}>
            {topMachinesData.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={topMachinesData} layout="vertical" margin={{ top: 8, right: 8, left: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={110} tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="utilization" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-400 text-xs">
                No machine data available
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}