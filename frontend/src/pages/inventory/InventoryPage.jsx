/**
 * Inventory Module — Enterprise ERP
 *
 * Tabs:
 *  - Overview    : KPI grid + warehouse summary + ABC + recommendations + activity
 *  - Stock       : On-hand balances with bulk actions and filters
 *  - Movements   : Audit ledger with date and type filters
 *  - Traceability: Batch / lot traceability
 *  - Operations  : Transfers + adjustments + opening stock
 *  - Reserved Stocks: Active allocations and releases
 *  - Warehouses  : List / create warehouses
 */
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownUp, Boxes, FileClock, Layers,
  PackagePlus, RefreshCw, Search, Truck, Warehouse,
  BarChart3, Building2, Tag,
} from "lucide-react";
import { AddButton, PageHeader, SecondaryButton } from "../../components/PageHeader";
import { ErrorState } from "../../components/ErrorState";
import { coreApi } from "../../services/api";
import Overview from "./components/Overview";
import StockTable from "./components/StockTable";
import MovementTable from "./components/MovementTable";
import BatchTable from "./components/BatchTable";
import TransferWorkspace from "./components/TransferWorkspace";
import ReservationsPanel from "./components/ReservationsPanel";
import WarehouseManager from "./components/WarehouseManager";

const TABS = [
  ["Overview", Boxes, "Health & KPIs"],
  ["Stock", PackagePlus, "On-hand balances"],
  ["Movements", ArrowDownUp, "Audit ledger"],
  ["Traceability", FileClock, "Batches & lots"],
  ["Operations", Truck, "Transfer / adjust / open"],
  ["Reserved Stocks", Layers, "Active allocations"],
  ["Warehouses", Warehouse, "Sites & zones"],
];

export function InventoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  // Seed tab from a KPI drill-down (navigate('/inventory', { state: { tab } })).
  const [tab, setTab] = useState(() => location.state?.tab || "Overview");
  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");

  const masters = useQuery({
    queryKey: ["inventory-masters"],
    queryFn: async () => {
      const [whRes, itemRes] = await Promise.all([
        coreApi.list("warehouses", { limit: 100 }),
        coreApi.list("items", { limit: 100 }),
      ]);
      return { warehouses: whRes.data || [], items: itemRes.data || [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const warehouses = masters.data?.warehouses || [];
  const items = masters.data?.items || [];

  const renderTab = () => {
    if (masters.isError)
      return (
        <ErrorState
          title="Inventory setup data unavailable"
          error={masters.error}
          onRetry={masters.refetch}
        />
      );
    switch (tab) {
      case "Overview":
        return <Overview warehouseId={warehouseId} onJump={setTab} />;
      case "Stock":
        return <StockTable warehouseId={warehouseId} search={search} />;
      case "Movements":
        return <MovementTable warehouseId={warehouseId} />;
      case "Traceability":
        return <BatchTable warehouseId={warehouseId} />;
      case "Operations":
        return (
          <TransferWorkspace
            warehouses={warehouses}
            items={items}
            onPosted={() => setTab("Overview")}
          />
        );
      case "Reserved Stocks":
        return <ReservationsPanel warehouses={warehouses} items={items} />;
      case "Warehouses":
        return <WarehouseManager />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader
        title="Inventory control tower"
        description="Monitor stock health, trace FIFO batches, investigate movements, and execute controlled warehouse operations."
        actions={
          <>
            <SecondaryButton
              label="Refresh"
              icon={RefreshCw}
              onClick={() => qc.invalidateQueries({ queryKey: ["inventory"] })}
            />
            <AddButton label="Stock operation" onClick={() => setTab("Operations")} />
          </>
        }
      />

      {/* Quick links to related module pages */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => navigate("/inventory/products")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <Tag size={14} /> Products
        </button>
        <button onClick={() => navigate("/inventory/reports")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <BarChart3 size={14} /> Reports
        </button>
        <button onClick={() => navigate("/inventory/suppliers")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <Building2 size={14} /> Suppliers
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Inventory workspace" className="flex min-w-0 gap-1 overflow-x-auto">
          {TABS.map(([name, Icon, hint]) => (
            <button
              role="tab"
              aria-selected={tab === name}
              key={name}
              onClick={() => setTab(name)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${
                tab === name
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2 lg:justify-end">
          {tab === "Stock" && (
            <label className="relative min-w-0 flex-1 lg:max-w-xs">
              <Search
                aria-hidden="true"
                size={16}
                className="pointer-events-none absolute left-3 top-3 text-slate-400"
              />
              <input
                aria-label="Search stock by product or SKU"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SKU or product…"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          )}
          <select
            aria-label="Filter warehouse"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="h-11 max-w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-500">{TABS.find(([n]) => n === tab)?.[2]}</p>
      {renderTab()}
    </div>
  );
}
