import { useMemo } from "react";
import { useManufacturingStore } from "../hooks/useManufacturingStore";
import { BarChart3, TrendingUp, DollarSign, Activity, Settings, FileText, AlertOctagon } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend, Cell } from "recharts";

const CHART_PALETTE = ["#2563eb", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

export function AnalyticsTab() {
  const { productionOrders, machines, inventoryConsumption } = useManufacturingStore();

  // 1. Output chart data (This Week)
  const outputData = [
    { name: "Mon", planned: 10000, actual: 9800 },
    { name: "Tue", planned: 12000, actual: 11850 },
    { name: "Wed", planned: 11000, actual: 10400 },
    { name: "Thu", planned: 13000, actual: 12900 },
    { name: "Fri", planned: 12500, actual: 12400 },
    { name: "Sat", planned: 9000, actual: 9200 },
    { name: "Sun", planned: 0, actual: 0 },
  ];

  // 2. Cost chart data (INR Lakhs)
  const costData = [
    { name: "Mon", litho: 2.1, etch: 1.5, bond: 0.8 },
    { name: "Tue", litho: 2.4, etch: 1.8, bond: 0.9 },
    { name: "Wed", litho: 2.0, etch: 2.2, bond: 0.7 },
    { name: "Thu", litho: 2.8, etch: 1.9, bond: 1.1 },
    { name: "Fri", litho: 2.6, etch: 1.7, bond: 1.0 },
    { name: "Sat", litho: 1.8, etch: 1.2, bond: 0.6 },
    { name: "Sun", litho: 0.2, etch: 0.1, bond: 0.1 },
  ];

  // 3. OEE trend
  const oeeData = [
    { name: "Mon", oee: 76.5 },
    { name: "Tue", oee: 78.0 },
    { name: "Wed", oee: 74.2 },
    { name: "Thu", oee: 79.8 },
    { name: "Fri", oee: 81.1 },
    { name: "Sat", oee: 78.9 },
    { name: "Today", oee: 78.4 },
  ];

  // 4. Downtime reasons
  const downtimeData = [
    { reason: "Chamber clean", minutes: 48, type: "Planned" },
    { reason: "Lot setup change", minutes: 36, type: "Planned" },
    { reason: "Prober replace", minutes: 22, type: "Unplanned" },
    { reason: "Vacuum pressure", minutes: 19, type: "Unplanned" },
    { reason: "Pump electrical", minutes: 17, type: "Unplanned" },
  ];

  // 5. Defect trend
  const defectData = [
    { name: "Mon", rate: 3.9 },
    { name: "Tue", rate: 3.6 },
    { name: "Wed", rate: 4.2 },
    { name: "Thu", rate: 3.0 },
    { name: "Fri", rate: 3.4 },
    { name: "Sat", rate: 2.8 },
    { name: "Today", rate: 3.1 },
  ];

  // 6. Top Products volume data
  const topProductsData = useMemo(() => {
    return [
      { name: "MEMS Press Sensor", qty: 24000, fill: "#2563eb" },
      { name: "3-Axis Accel", qty: 18000, fill: "#3b82f6" },
      { name: "Analog Microphone", qty: 15200, fill: "#10b981" },
      { name: "Gyroscope Industrial", qty: 9000, fill: "#f59e0b" },
      { name: "Flow Sensor Medical", qty: 3200, fill: "#8b5cf6" },
    ];
  }, []);

  // 7. Top Machines by utilization
  const topMachinesData = useMemo(() => {
    return machines
      .map((m) => ({ name: m.id, utilization: m.utilization }))
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
            <ResponsiveContainer>
              <LineChart data={oeeData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis domain={[60, 100]} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip />
                <Line dataKey="oee" name="OEE %" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer>
              <BarChart data={downtimeData} layout="vertical" margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis dataKey="reason" type="category" width={80} tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="minutes">
                  {downtimeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.type === "Planned" ? "#3b82f6" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer>
              <LineChart data={defectData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis domain={[0, 6]} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip />
                <Line dataKey="rate" name="Scrap %" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer>
              <BarChart data={[
                { name: "Mon", wafer: 12 },
                { name: "Tue", wafer: 15 },
                { name: "Wed", wafer: 14 },
                { name: "Thu", wafer: 18 },
                { name: "Fri", wafer: 16 },
                { name: "Sat", wafer: 9 },
                { name: "Today", wafer: 11 },
              ]} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="wafer" name="Wafers (pcs)" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Lower Grid: Top Products vs Top Machines horizontal bars */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Top products Horizontal bar */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Products by Volume Output</h4>
            <p className="text-[10px] text-slate-400">Wafer die manufacturing yields (past 30 days)</p>
          </div>
          <div className="w-full text-xs font-semibold" style={{ height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={topProductsData} layout="vertical" margin={{ top: 8, right: 8, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={110} tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top machines Horizontal bar */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Tool Machine Utilities</h4>
            <p className="text-[10px] text-slate-400">Average percentage tool runtime allocation</p>
          </div>
          <div className="w-full text-xs font-semibold" style={{ height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={topMachinesData} layout="vertical" margin={{ top: 8, right: 8, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={70} tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="utilization" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
