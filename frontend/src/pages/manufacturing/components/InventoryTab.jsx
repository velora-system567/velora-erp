import { useMemo } from "react";
import { EmptyState } from "./EmptyState";
import { PackageOpen, AlertTriangle, ShieldCheck, TrendingUp, ShoppingCart, RefreshCcw, BarChart3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export function InventoryTab() {
  // Inventory consumption for the Manufacturing module is not implemented
  // in backend yet, so we intentionally show the real empty state.
  const inventoryConsumption = [];
  const hasData = false; // placeholder until backend wiring exists

  // Create chart data for compound material usage trend
  // Inventory consumption is not yet wired to backend list APIs in useManufacturingApi.js.
  // Until implemented, render an empty state so new workspaces show 0 by default.
  const chartData = useMemo(() => [], []);

  // Compute severity statistics
  const criticalAlerts = useMemo(() => {
    return inventoryConsumption.filter((item) => item.severity === "critical");
  }, [inventoryConsumption]);

  const handleRaiseReorder = (item) => {
    alert(`Reorder purchase request raised successfully for ${item.name} (${item.sku}). Ordered quantity: ${item.requiredStock * 2} ${item.unit}.`);
  };

  if (!hasData) {
    return (
      <div className="space-y-6">
        <EmptyState title="No inventory consumption" subtitle="Production consumption isn't available yet for this workspace." />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Critical Warnings */}
      {criticalAlerts.length > 0 && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
            <AlertTriangle size={15} />
            Critical Stock Shortages Detected
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {criticalAlerts.map((item) => (
              <div key={item.sku} className="rounded-2xl border border-rose-100 bg-white p-3.5 flex items-start gap-3">
                <div className="rounded-xl bg-rose-50 p-2 text-rose-600 mt-0.5 shrink-0">
                  <PackageOpen size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{item.sku}</span>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      {item.daysOfStock} Days Left
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 mt-1 leading-tight">{item.name}</h5>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Current Stock: <span className="font-semibold text-slate-900">{item.onHand}</span> / Safety Stock: <span className="font-semibold text-slate-900">{item.requiredStock}</span> {item.unit}.
                  </p>
                  <p className="text-[10px] font-bold text-rose-600 mt-2 bg-rose-50 px-2.5 py-1 rounded-md inline-block">
                    Impact: Critical - Cleanroom photolithography line will halt
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart Section */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recharts Bar */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-950 flex items-center gap-1.5">
                  <BarChart3 size={18} className="text-blue-600" />
                  Material Consumption Trends
                </h3>
                <p className="text-xs text-slate-500">Wafer substrate and chemical resist usage patterns (this week)</p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                <TrendingUp size={12} /> Consumption Rate
              </span>
            </div>

            <div className="w-full text-xs" style={{ height: 230 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="WFR-SOI-200" name="SOI Wafer (pcs)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="PR-AZ-9260" name="Photoresist (L)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="GAS-SF6" name="SF6 Gas (cyl)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Insight card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">Material Safety Audits</h3>
            <p className="text-xs text-slate-500">Cleanroom stock integrity & vendor SLAs</p>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-150">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Automated Replenishment</span>
                <p className="text-xs font-bold text-slate-800 mt-1 leading-normal">
                  Minimum-cover rules are set to 4 days. Critical lots automatically flag purchases in the Velora Procurement module.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-150 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">SLA Coverage</span>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Silicon Quest India</span>
                  <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">98.5% Delivery</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">ResiChem Inc</span>
                  <span className="font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">84.0% Delivery Delay</span>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Last Sync: 5 mins ago</span>
            <span className="font-bold text-blue-600 hover:underline cursor-pointer">Configure rules</span>
          </div>
        </div>
      </div>

      {/* Material Stock Grid */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3.5">SKU</th>
                <th className="px-4 py-3.5">Material Component Name</th>
                <th className="px-4 py-3.5 text-right">On Hand Stock</th>
                <th className="px-4 py-3.5 text-right">Required (Safety Stock)</th>
                <th className="px-4 py-3.5 text-center">Unit</th>
                <th className="px-4 py-3.5 text-center">Days left cover</th>
                <th className="px-4 py-3.5">Pre-Qualified Vendor</th>
                <th className="px-4 py-3.5 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {inventoryConsumption.map((item) => {
                const isCritical = item.severity === "critical";
                const isWarning = item.severity === "warning";
                return (
                  <tr key={item.sku} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3.5 font-bold text-slate-400 tabular-nums">{item.sku}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      <div>
                        <p>{item.name}</p>
                        <p className={`text-[9px] font-bold mt-0.5 ${
                          isCritical ? "text-rose-600" : isWarning ? "text-amber-600" : "text-emerald-600"
                        }`}>
                          {isCritical ? "Excursion Risk: High" : isWarning ? "Excursion Risk: Moderate" : "Fully covered"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums">{item.onHand}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-500 tabular-nums">{item.requiredStock}</td>
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-400 uppercase">{item.unit}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                        isCritical ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100" :
                        isWarning ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                      }`}>
                        {item.daysOfStock} days
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-600">{item.vendor}</td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handleRaiseReorder(item)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border ${
                          isCritical
                            ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <ShoppingCart size={11} />
                        Reorder Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}