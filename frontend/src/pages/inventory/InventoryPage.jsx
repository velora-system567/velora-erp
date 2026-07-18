import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Package, AlertTriangle, BarChart3 } from "lucide-react";
import { inventoryApi } from "../../services/api";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { SkeletonTable, SkeletonCards } from "../../components/Skeleton";
import { formatRupees } from "../../utils/money";

const TABS = ["Stock Summary", "Low Stock Alerts", "Valuation Report", "Transfers"];

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

function StockSummaryTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["stock-summary"], queryFn: () => inventoryApi.stockSummary() });
  const rows = query.data?.data || [];

  if (query.isPending) return <SkeletonTable rows={8} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["stock-summary"] })} />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>{["Item Code", "Item Name", "Warehouse", "Qty on Hand", "Value (FIFO)"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No stock entries found. Add opening stock to get started.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.item?.itemCode || "—"}</td>
                <td className="px-4 py-3 font-medium text-slate-950">{r.item?.name || r.itemId.slice(0, 8)}</td>
                <td className="px-4 py-3 text-slate-600">{r.warehouseId.slice(0, 8)}…</td>
                <td className={`px-4 py-3 font-bold tabular-nums ${r.quantity <= 0 ? "text-rose-600" : "text-slate-950"}`}>
                  {Number(r.quantity).toFixed(3)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">{formatRupees(r.valuePaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LowStockTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["low-stock"], queryFn: inventoryApi.lowStockAlerts });
  const alerts = query.data?.data || [];

  if (query.isPending) return <SkeletonTable rows={5} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["low-stock"] })} />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600" />
          <span className="text-sm font-semibold text-slate-950">{alerts.length} items at or below reorder level</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
            <tr>{["Code", "Item", "Current Stock", "Reorder Level", "Deficit", "Reorder Qty"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alerts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">All items are above reorder levels.</td></tr>
            ) : alerts.map((a) => (
              <tr key={a.itemId} className="hover:bg-amber-50/30">
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{a.itemCode}</td>
                <td className="px-4 py-3 font-medium text-slate-950">{a.name}</td>
                <td className={`px-4 py-3 font-bold tabular-nums ${a.currentStock <= 0 ? "text-rose-600" : "text-amber-700"}`}>
                  {Number(a.currentStock).toFixed(2)}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-700">{Number(a.reorderLevel).toFixed(2)}</td>
                <td className="px-4 py-3 font-semibold text-rose-700 tabular-nums">{Number(a.deficit).toFixed(2)}</td>
                <td className="px-4 py-3 tabular-nums text-slate-700">{Number(a.reorderQuantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ValuationTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["valuation-report"], queryFn: inventoryApi.valuationReport });
  const data = query.data?.data;

  if (query.isPending) return <SkeletonTable rows={6} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["valuation-report"] })} />;

  const rows = data?.rows || [];
  const totalValue = data?.totalValuePaise || 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-600">Total Inventory Value (FIFO Cost)</p>
        <p className="mt-1 text-3xl font-bold text-slate-950">{formatRupees(totalValue)}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>{["Code", "Item", "Qty", "Avg Cost", "Total Value"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.item?.itemCode || "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-950">{r.item?.name || r.itemId.slice(0, 8)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{Number(r.quantity).toFixed(3)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{formatRupees(r.avgCostRate)}</td>
                  <td className="px-4 py-3 font-bold text-slate-950">{formatRupees(r.valuePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TransfersTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["stock-transfers"], queryFn: inventoryApi.stockTransfers });
  const rows = query.data?.data || [];

  if (query.isPending) return <SkeletonTable rows={4} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["stock-transfers"] })} />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>{["Date", "Item", "From", "To", "Qty", "Status"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No stock transfers recorded.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 text-slate-700">{r.itemId.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-slate-600">{r.fromWarehouseId.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-slate-600">{r.toWarehouseId.slice(0, 8)}…</td>
                <td className="px-4 py-3 font-bold tabular-nums text-slate-950">{Number(r.quantity).toFixed(3)}</td>
                <td className="px-4 py-3 text-emerald-700 font-semibold">COMPLETED</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState("Stock Summary");
  const tabContent = {
    "Stock Summary": <StockSummaryTab />,
    "Low Stock Alerts": <LowStockTab />,
    "Valuation Report": <ValuationTab />,
    "Transfers": <TransfersTab />,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Inventory</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">Real-time FIFO stock balances, low stock alerts, transfers, and valuation.</p>
          </div>
          <Package className="hidden shrink-0 text-blue-600 sm:block" size={22} />
        </div>
      </header>
      <TabBar active={activeTab} onChange={setActiveTab} />
      <div className="min-h-[300px]">{tabContent[activeTab]}</div>
    </div>
  );
}
