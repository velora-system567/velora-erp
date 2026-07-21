/**
 * Inventory Module — Enterprise Frontend
 *
 * Sub-modules in this file:
 *  - InventoryOverview   : KPI grid + warehouse summary + ABC + recommendations + activity
 *  - StockTable          : on-hand balances with bulk actions and filters
 *  - MovementTable       : ledger with date and type filters
 *  - BatchTable          : batch / lot traceability
 *  - TransferWorkspace   : transfers + adjustments + opening stock
 *  - ReservationsPanel   : active reservations and releases
 *  - CycleCountPanel     : create and complete cycle counts
 *  - WarehouseManager    : list / create warehouses
 *  - ReorderPlanner      : actionable reorder recommendations
 *
 * Reuses:
 *  - EmptyState, ErrorState, ErrorBanner, Skeleton components
 *  - inventoryApi, coreApi, formatRupees, formatRupeesCompact
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowDownUp, Boxes, ChevronDown, ClipboardList,
  Download, FileClock, Layers, PackagePlus, Plus, RefreshCw,
  Search, Send, Sparkles, Truck, Warehouse, Zap, MapPin, Box, BarChart3,
} from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner, ErrorState } from "../../components/ErrorState";
import { AddButton, PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { coreApi, inventoryApi } from "../../services/api";
import { formatRupees, formatRupeesCompact } from "../../utils/money";

// ─── Formatting helpers ───────────────────────────────────────────────────────
const number = (value, digits = 0) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(value || 0));
const date = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const dateTime = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const pct = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

function exportCsv(filename, rows, columns) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [columns.map((column) => escape(column.label)).join(","), ...rows.map((row) => columns.map((column) => escape(column.value(row))).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

// ─── Reusable UI primitives ───────────────────────────────────────────────────

function Card({ children, className = "", padding = "p-5" }) {
  return <article className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${padding} ${className}`}>{children}</article>;
}

function SectionHeader({ title, description, icon: Icon, actions }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
          {Icon ? <Icon size={18} className="text-blue-600" /> : null}
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function TableShell({ children }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-left text-sm">{children}</table></div>;
}

function Head({ children }) {
  return <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{children}</tr></thead>;
}

function Cell({ children, className = "" }) {
  return <td className={`px-4 py-3.5 align-middle ${className}`}>{children}</td>;
}

function KpiTile({ label, value, detail, tone = "slate", icon: Icon, formatter }) {
  const tones = {
    slate: "border-slate-200 text-slate-900",
    blue: "border-blue-200 text-blue-900",
    amber: "border-amber-200 text-amber-900",
    rose: "border-rose-200 text-rose-900",
    emerald: "border-emerald-200 text-emerald-900",
    purple: "border-purple-200 text-purple-900",
  };
  const iconTones = {
    slate: "text-slate-500 bg-slate-100",
    blue: "text-blue-600 bg-blue-50",
    amber: "text-amber-600 bg-amber-50",
    rose: "text-rose-600 bg-rose-50",
    emerald: "text-emerald-600 bg-emerald-50",
    purple: "text-purple-600 bg-purple-50",
  };
  const display = formatter ? formatter(value) : value;
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {Icon ? <div className={`grid h-8 w-8 place-items-center rounded-lg ${iconTones[tone]}`}><Icon size={15} /></div> : null}
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{display}</p>
      {detail ? <p className="mt-1 text-xs text-slate-600">{detail}</p> : null}
    </article>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function Overview({ warehouseId, onJump }) {
  const query = useQuery({
    queryKey: ["inventory-dashboard-v2", warehouseId],
    queryFn: () => inventoryApi.dashboard(warehouseId ? { warehouseId } : {}),
    staleTime: 60 * 1000,
  });
  if (query.isPending) return <><SkeletonCards count={4} /><SkeletonTable rows={6} cols={5} /></>;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const data = query.data?.data;
  if (!data) return <EmptyState title="No data available" description="The inventory dashboard returned an empty payload." />;
  const k = data.kpis;

  const isFresh = k.inventoryValuePaise > 0 || k.totalStock > 0;
  const hasRisks = k.lowStockItems > 0 || k.outOfStockItems > 0 || k.expiringBatches > 0;

  return (
    <div className="space-y-6">
      {!isFresh && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold text-slate-950">Start with opening stock</h2>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Post opening balances to activate FIFO valuation, low-stock alerts, ABC analysis, and procurement recommendations. You can also approve a Goods Receipt Note (GRN) from the Purchase module.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AddButton label="Post opening stock" onClick={() => onJump("Transfers")} />
            </div>
          </div>
        </Card>
      )}

      {/* Primary KPI grid */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Inventory value" value={k.inventoryValuePaise} tone="blue" icon={BarChart3} formatter={formatRupeesCompact} detail="FIFO cost basis" />
        <KpiTile label="Total stock" value={k.totalStock} tone="slate" icon={Boxes} formatter={(v) => `${number(v, 3)} u`} detail={`${k.totalSkus || 0} active SKUs`} />
        <KpiTile label="Turnover (annualized)" value={k.inventoryTurnover} tone="purple" icon={RefreshCw} formatter={(v) => `${number(v, 2)}x`} detail="Sales ÷ avg on-hand" />
        <KpiTile label="Reserved stock" value={k.reservedStock} tone="emerald" icon={Layers} formatter={(v) => number(v, 3)} detail="Active allocations" />
      </section>

      {/* Risk / Health strip */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Out of stock" value={k.outOfStockItems} tone="rose" icon={AlertTriangle} detail="Items with zero on-hand" />
        <KpiTile label="Low stock" value={k.lowStockItems} tone="amber" icon={AlertTriangle} detail="At or below reorder level" />
        <KpiTile label="Overstock" value={k.overstockItems} tone="amber" icon={Box} detail="Above 3× reorder level" />
        <KpiTile label="Expiring (90d)" value={k.expiringBatches} tone="rose" icon={FileClock} detail="Batches needing attention" />
      </section>

      {/* Warehouse summary + ABC */}
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <SectionHeader title="Warehouse summary" description="Stock quantity and FIFO value by storage site." icon={Warehouse}
            actions={data.warehouseSummary.length ? <SecondaryButton label="Export CSV" icon={Download} onClick={() => exportCsv("velora-warehouse-summary.csv", data.warehouseSummary, [{ label: "Warehouse", value: (r) => r.warehouseName }, { label: "SKUs", value: (r) => r.skuCount }, { label: "Quantity", value: (r) => r.quantity }, { label: "Value (₹)", value: (r) => (r.valuePaise / 100).toFixed(2) }])} /> : null}
          />
          {data.warehouseSummary.length ? (
            <div className="space-y-2.5">
              {data.warehouseSummary.map((row) => {
                const share = data.warehouseSummary.reduce((s, r) => s + r.valuePaise, 0);
                const pctValue = share > 0 ? Math.round((row.valuePaise / share) * 100) : 0;
                return (
                  <div key={row.warehouseId} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{row.warehouseName}</p>
                        <p className="text-xs text-slate-500">{number(row.skuCount)} active SKUs · {number(row.quantity, 3)} units</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums text-slate-950">{formatRupees(row.valuePaise)}</p>
                        <p className="text-xs text-slate-500">{pctValue}% of total</p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pctValue}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No warehouses with stock" description="Post opening stock or approve a goods receipt to populate warehouse balances." />
          )}
        </Card>

        <Card>
          <SectionHeader title="ABC analysis" description="Classified by current inventory value (Pareto)." icon={BarChart3} />
          {data.abcSummary.length ? (
            <div className="space-y-2.5">
              {data.abcSummary.map((row) => (
                <div key={row.classification} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                  <Pill tone={row.classification === "A" ? "rose" : row.classification === "B" ? "amber" : "blue"}>Class {row.classification}</Pill>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{number(row.itemCount)} SKUs</p>
                    <p className="text-xs text-slate-500">{row.classification === "A" ? "Tight control, frequent counts" : row.classification === "B" ? "Moderate control" : "Loose control, periodic review"}</p>
                  </div>
                  <strong className="tabular-nums text-slate-950">{formatRupeesCompact(row.valuePaise)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No data" description="ABC analysis appears after first stock movement." />
          )}
        </Card>
      </section>

      {/* Top moving / slow moving */}
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Top stocked products" description="Highest on-hand value across the company." icon={Boxes} />
          {data.topMovingProducts.length ? (
            <div className="divide-y divide-slate-100">
              {data.topMovingProducts.map((row, i) => (
                <div key={row.itemId} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{row.name}</p>
                      <p className="font-mono text-xs text-slate-500">{row.itemCode}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-slate-950">{number(row.quantity, 3)}</p>
                    <p className="text-xs text-slate-500">{formatRupeesCompact(row.valuePaise)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No on-hand stock" description="Post opening stock or receive a GRN to see your top items." />}
        </Card>

        <Card>
          <SectionHeader title="Slow-moving / aging stock" description="Oldest stock that may need action." icon={FileClock} />
          {data.slowMovingProducts.length ? (
            <div className="divide-y divide-slate-100">
              {data.slowMovingProducts.map((row) => (
                <div key={row.itemId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{row.name}</p>
                    <p className="font-mono text-xs text-slate-500">{row.itemCode} · {row.ageDays || 0} days on hand</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-slate-950">{number(row.quantity, 3)}</p>
                    <p className="text-xs text-slate-500">{formatRupeesCompact(row.valuePaise)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No slow-moving stock" description="Items older than 90 days will surface here." />}
        </Card>
      </section>

      {/* Reorder recommendations + expiring batches */}
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Reorder recommendations" description="Items at or below their reorder level." icon={Zap}
            actions={data.recommendations.length ? <Pill tone="rose">{data.recommendations.length} action{data.recommendations.length > 1 ? "s" : ""}</Pill> : null}
          />
          {data.recommendations.length ? (
            <div className="space-y-2">
              {data.recommendations.map((row) => (
                <div key={row.itemId} className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{row.name}</p>
                    <p className="font-mono text-xs text-slate-500">{row.itemCode}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Pill tone={row.urgency === "HIGH" ? "rose" : "amber"}>{row.urgency}</Pill>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">On hand {number(row.onHand, 3)} / Reorder {number(row.reorderLevel, 3)}</p>
                      <p className="text-sm font-semibold tabular-nums text-slate-950">Suggest PO: {number(row.suggestedOrderQty, 3)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No reorders needed" description="Every SKU is above its reorder threshold." />}
        </Card>

        <Card>
          <SectionHeader title="Expiring batches (90 days)" description="Batches that need usage or write-off decisions." icon={AlertTriangle} />
          {data.expiringBatches.length ? (
            <div className="divide-y divide-slate-100">
              {data.expiringBatches.slice(0, 8).map((row) => {
                const days = row.expiryDate ? Math.floor((new Date(row.expiryDate).getTime() - Date.now()) / 86400000) : null;
                return (
                  <div key={row.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{row.item?.name}</p>
                      <p className="font-mono text-xs text-slate-500">{row.item?.itemCode} · Batch {row.batchNumber || "—"} · {row.warehouse?.name || ""}</p>
                    </div>
                    <div className="text-right">
                      <Pill tone={days != null && days < 0 ? "rose" : days != null && days < 30 ? "amber" : "blue"}>
                        {days != null ? (days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`) : "No expiry"}
                      </Pill>
                      <p className="mt-1 text-xs text-slate-500">{number(row.qtyRemaining, 3)} remaining</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState title="No expiring batches" description="Items with expiry dates within 90 days will appear here." />}
        </Card>
      </section>

      {/* Recent activity */}
      <Card padding="p-0">
        <div className="border-b border-slate-200 p-5">
          <SectionHeader title="Recent inventory activity" description="Approved goods receipts, transfers, production, and adjustments." icon={ArrowDownUp} />
        </div>
        {data.recentActivity.length ? (
          <div className="divide-y divide-slate-100">
            {data.recentActivity.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{row.item?.name || "Inventory movement"}</p>
                  <p className="text-xs text-slate-500">{row.warehouse?.name || "Warehouse"} · {dateTime(row.createdAt)}</p>
                </div>
                <div className="text-right">
                  <Pill tone={Number(row.quantity) < 0 ? "rose" : "emerald"}>{row.transactionType.replaceAll("_", " ")}</Pill>
                  <p className="mt-1 tabular-nums text-xs text-slate-600">{Number(row.quantity) > 0 ? "+" : ""}{number(row.quantity, 3)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5"><EmptyState title="No inventory activity" description="Approved goods receipts, transfers, production, and adjustments appear here." /></div>
        )}
      </Card>

      {!hasRisks && isFresh && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Zap size={18} className="shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-900"><span className="font-semibold">All clear.</span> No low stock, no expiring batches, no overstock signals.</p>
        </div>
      )}
    </div>
  );
}

// ─── Stock balances table ─────────────────────────────────────────────────────

function StockTable({ warehouseId, search }) {
  const [sortBy, setSortBy] = useState("name");
  const [selected, setSelected] = useState([]);
  const query = useQuery({
    queryKey: ["stock-summary", warehouseId],
    queryFn: () => inventoryApi.stockSummary(warehouseId ? { warehouseId } : {}),
    staleTime: 60 * 1000,
  });
  if (query.isPending) return <SkeletonTable rows={8} cols={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const rows = useMemo(() => {
    const list = (query.data?.data || []).filter((row) => `${row.item?.itemCode || ""} ${row.item?.name || ""}`.toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => sortBy === "quantity" ? Number(b.quantity) - Number(a.quantity) : (a.item?.name || "").localeCompare(b.item?.name || ""));
    return list;
  }, [query.data, search, sortBy]);

  const toggleAll = () => setSelected(selected.length === rows.length ? [] : rows.map((row) => row.itemId));
  const exportRows = rows.filter((row) => !selected.length || selected.includes(row.itemId));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {number(rows.length)} stock balance{rows.length === 1 ? "" : "s"} {selected.length ? `· ${selected.length} selected` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {selected.length > 0 && <Pill tone="blue">{selected.length} selected</Pill>}
          <SecondaryButton
            label="Export CSV"
            icon={Download}
            onClick={() => exportCsv("velora-stock-summary.csv", exportRows, [
              { label: "SKU", value: (r) => r.item?.itemCode },
              { label: "Product", value: (r) => r.item?.name },
              { label: "Warehouse", value: (r) => r.warehouseId },
              { label: "Quantity", value: (r) => r.quantity },
              { label: "FIFO value (₹)", value: (r) => (r.valuePaise / 100).toFixed(2) },
            ])}
          />
        </div>
      </div>
      <TableShell>
        <Head>
          <th className="w-12 px-4 py-3">
            <input aria-label="Select all stock rows" type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={toggleAll} />
          </th>
          <th className="px-4 py-3">
            <button className="inline-flex items-center gap-1" onClick={() => setSortBy("name")}>
              Product <ChevronDown size={13} />
            </button>
          </th>
          <th className="px-4 py-3">Warehouse</th>
          <th className="px-4 py-3 text-right">
            <button className="inline-flex items-center gap-1" onClick={() => setSortBy("quantity")}>
              On hand <ChevronDown size={13} />
            </button>
          </th>
          <th className="px-4 py-3 text-right">FIFO value</th>
        </Head>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? rows.map((row) => (
            <tr key={`${row.itemId}-${row.warehouseId}`} className="hover:bg-slate-50">
              <Cell>
                <input aria-label={`Select ${row.item?.name || row.itemId}`} type="checkbox" checked={selected.includes(row.itemId)} onChange={() => setSelected((current) => current.includes(row.itemId) ? current.filter((id) => id !== row.itemId) : [...current, row.itemId])} />
              </Cell>
              <Cell>
                <p className="font-medium text-slate-950">{row.item?.name || "Unknown item"}</p>
                <p className="font-mono text-xs text-slate-500">{row.item?.itemCode || row.itemId}</p>
              </Cell>
              <Cell className="font-mono text-xs text-slate-600">{row.warehouseId}</Cell>
              <Cell className={`text-right font-semibold tabular-nums ${Number(row.quantity) <= 0 ? "text-rose-700" : "text-slate-950"}`}>{number(row.quantity, 3)}</Cell>
              <Cell className="text-right font-semibold tabular-nums text-slate-900">{formatRupees(row.valuePaise)}</Cell>
            </tr>
          )) : (
            <tr><Cell className="py-12 text-center text-slate-500" colSpan={5}>No stock balance matches the selected filters.</Cell></tr>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}

// ─── Movement ledger ──────────────────────────────────────────────────────────

function MovementTable({ warehouseId }) {
  const [filters, setFilters] = useState({ transactionType: "", fromDate: "", toDate: "" });
  const query = useQuery({
    queryKey: ["inventory-ledger", warehouseId, filters],
    queryFn: () => inventoryApi.ledger({ ...(warehouseId ? { warehouseId } : {}), ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }),
    staleTime: 60 * 1000,
  });
  if (query.isPending) return <SkeletonTable rows={8} cols={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const rows = query.data?.data || [];
  const meta = query.data?.meta;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <select aria-label="Filter movement type" value={filters.transactionType} onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
          <option value="">All movement types</option>
          {["PURCHASE", "SALE", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT", "OPENING", "PRODUCTION_IN", "PRODUCTION_OUT"].map((type) => <option key={type}>{type}</option>)}
        </select>
        <input aria-label="From date" type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} className="h-11 rounded-lg border border-slate-200 px-3 text-sm" />
        <input aria-label="To date" type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} className="h-11 rounded-lg border border-slate-200 px-3 text-sm" />
      </div>
      <TableShell>
        <Head>
          <th className="px-4 py-3">Date</th>
          <th className="px-4 py-3">Product</th>
          <th className="px-4 py-3">Movement</th>
          <th className="px-4 py-3">Warehouse</th>
          <th className="px-4 py-3 text-right">Quantity</th>
          <th className="px-4 py-3 text-right">Value</th>
        </Head>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? rows.map((row) => (
            <tr key={row.id}>
              <Cell className="text-slate-600">{date(row.createdAt)}</Cell>
              <Cell><p className="font-medium text-slate-950">{row.item?.name || "Unknown item"}</p><p className="font-mono text-xs text-slate-500">{row.item?.itemCode}</p></Cell>
              <Cell><Pill tone={Number(row.quantity) < 0 ? "rose" : "emerald"}>{row.transactionType.replaceAll("_", " ")}</Pill></Cell>
              <Cell className="text-slate-600">{row.warehouse?.name || "—"}</Cell>
              <Cell className="text-right font-semibold tabular-nums">{Number(row.quantity) > 0 ? "+" : ""}{number(row.quantity, 3)}</Cell>
              <Cell className="text-right tabular-nums">{formatRupees(Math.abs(row.value))}</Cell>
            </tr>
          )) : (
            <tr><Cell colSpan={6} className="py-12 text-center text-slate-500">No movements match these filters.</Cell></tr>
          )}
        </tbody>
      </TableShell>
      {meta && (
        <p className="text-xs text-slate-500">Showing {rows.length} of {meta.total} movements · page {meta.page} / {meta.totalPages}</p>
      )}
    </div>
  );
}

// ─── Batch traceability ───────────────────────────────────────────────────────

function BatchTable({ warehouseId }) {
  const [status, setStatus] = useState("ALL");
  const query = useQuery({
    queryKey: ["inventory-batches", warehouseId, status],
    queryFn: () => inventoryApi.batches({ status, ...(warehouseId ? { warehouseId } : {}) }),
    staleTime: 60 * 1000,
  });
  if (query.isPending) return <SkeletonTable rows={6} cols={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const rows = query.data?.data || [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select aria-label="Filter batch status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
          <option value="ALL">All batches</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRING">Expiring within 90 days</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <Pill tone="blue">{rows.length} batch{rows.length === 1 ? "" : "es"}</Pill>
      </div>
      <TableShell>
        <Head>
          <th className="px-4 py-3">Product</th>
          <th className="px-4 py-3">Batch / lot</th>
          <th className="px-4 py-3">Warehouse</th>
          <th className="px-4 py-3 text-right">Available</th>
          <th className="px-4 py-3">Expiry</th>
          <th className="px-4 py-3 text-right">Cost</th>
        </Head>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? rows.map((row) => (
            <tr key={row.id}>
              <Cell><p className="font-medium text-slate-950">{row.item?.name}</p><p className="font-mono text-xs text-slate-500">{row.item?.itemCode}</p></Cell>
              <Cell className="font-mono text-xs text-slate-700">{row.batchNumber || "Unbatched"}</Cell>
              <Cell className="text-slate-600">{row.warehouse?.name}</Cell>
              <Cell className="text-right font-semibold tabular-nums">{number(row.qtyRemaining, 3)}</Cell>
              <Cell><Pill tone={row.expiryDate && new Date(row.expiryDate) < new Date() ? "rose" : "slate"}>{date(row.expiryDate)}</Pill></Cell>
              <Cell className="text-right tabular-nums">{formatRupees(row.costRate)}</Cell>
            </tr>
          )) : (
            <tr><Cell colSpan={6} className="py-12 text-center text-slate-500">No batches match this traceability view.</Cell></tr>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}

// ─── Transfer / adjustment / opening stock workspace ─────────────────────────

function TransferWorkspace({ warehouses, items, onPosted }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState("transfer");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ itemId: "", fromWarehouseId: "", toWarehouseId: "", warehouseId: "", quantity: "", adjustmentQty: "", reason: "", costRate: "" });
  const [openingForm, setOpeningForm] = useState({ warehouseId: "", itemId: "", quantity: "", costRate: "", batchNumber: "" });
  const [openingRows, setOpeningRows] = useState([]);

  const mutation = useMutation({
    mutationFn: () => mode === "transfer"
      ? inventoryApi.createTransfer({ itemId: form.itemId, fromWarehouseId: form.fromWarehouseId, toWarehouseId: form.toWarehouseId, quantity: Number(form.quantity) })
      : inventoryApi.createAdjustment({ itemId: form.itemId, warehouseId: form.warehouseId, adjustmentQty: Number(form.adjustmentQty), reason: form.reason, costRate: form.costRate ? Number(form.costRate) : undefined }),
    onSuccess: () => {
      setNotice(mode === "transfer" ? "Transfer posted successfully." : "Stock adjustment posted successfully.");
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
      qc.invalidateQueries({ queryKey: ["inventory-dashboard-v2"] });
      qc.invalidateQueries({ queryKey: ["inventory-ledger"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      onPosted?.();
    },
  });

  const openingMutation = useMutation({
    mutationFn: () => inventoryApi.openingStock({ warehouseId: openingForm.warehouseId, items: openingRows }),
    onSuccess: () => {
      setNotice("Opening stock posted successfully.");
      setOpeningRows([]);
      setOpeningForm({ warehouseId: "", itemId: "", quantity: "", costRate: "", batchNumber: "" });
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
      qc.invalidateQueries({ queryKey: ["inventory-dashboard-v2"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      onPosted?.();
    },
  });

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const updateOpening = (key) => (e) => setOpeningForm({ ...openingForm, [key]: e.target.value });

  const productSelect = (key = "itemId") => (
    <select required value={form[key]} onChange={update(key)} className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3">
      <option value="">Select product</option>
      {items.map((item) => <option key={item.id} value={item.id}>{item.itemCode} · {item.name}</option>)}
    </select>
  );

  const warehouseSelect = (key, label) => (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select required value={form[key]} onChange={update(key)} className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3">
        <option value="">Select warehouse</option>
        {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
      </select>
    </label>
  );

  const addOpeningRow = () => {
    if (!openingForm.itemId || !openingForm.quantity || !openingForm.costRate) return;
    const item = items.find((i) => i.id === openingForm.itemId);
    if (!item) return;
    setOpeningRows([...openingRows, { itemId: openingForm.itemId, quantity: Number(openingForm.quantity), costRate: Number(openingForm.costRate), batchNumber: openingForm.batchNumber || "" }]);
    setOpeningForm({ ...openingForm, itemId: "", quantity: "", costRate: "", batchNumber: "" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title="Stock operations" description="Move stock between warehouses, correct balances, or post opening stock." icon={Truck} />
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setMode("transfer")} className={`min-h-11 rounded-lg text-sm font-semibold ${mode === "transfer" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>Transfer</button>
          <button onClick={() => setMode("adjustment")} className={`min-h-11 rounded-lg text-sm font-semibold ${mode === "adjustment" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>Adjustment</button>
          <button onClick={() => setMode("opening")} className={`min-h-11 rounded-lg text-sm font-semibold ${mode === "opening" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>Opening stock</button>
        </div>
      </Card>

      {mode !== "opening" ? (
        <Card>
          <form onSubmit={(e) => { e.preventDefault(); setNotice(""); mutation.mutate(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Product{productSelect("itemId")}</label>
              {mode === "transfer" ? (
                <>
                  {warehouseSelect("fromWarehouseId", "From warehouse")}
                  {warehouseSelect("toWarehouseId", "To warehouse")}
                  <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Quantity
                    <input required min="0.001" step="0.001" type="number" value={form.quantity} onChange={update("quantity")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" />
                  </label>
                </>
              ) : (
                <>
                  {warehouseSelect("warehouseId", "Warehouse")}
                  <label className="block text-sm font-medium text-slate-700">Quantity change
                    <input required step="0.001" type="number" value={form.adjustmentQty} onChange={update("adjustmentQty")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Unit cost (₹, optional)
                    <input min="0" step="0.01" type="number" value={form.costRate} onChange={update("costRate")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Reason
                    <textarea required minLength={3} value={form.reason} onChange={update("reason")} className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 p-3" />
                  </label>
                </>
              )}
            </div>
            {mutation.error && <div className="mt-4"><ErrorBanner error={mutation.error} /></div>}
            {notice && <p aria-live="polite" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{notice}</p>}
            <button disabled={mutation.isPending} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              <Send size={16} />{mutation.isPending ? "Posting…" : mode === "transfer" ? "Post transfer" : "Post adjustment"}
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Warehouse
              <select required value={openingForm.warehouseId} onChange={updateOpening("warehouseId")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3">
                <option value="">Select warehouse</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Product
              <select value={openingForm.itemId} onChange={updateOpening("itemId")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3">
                <option value="">Select product</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.itemCode} · {item.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Quantity
              <input min="0.001" step="0.001" type="number" value={openingForm.quantity} onChange={updateOpening("quantity")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Unit cost (₹)
              <input min="0" step="0.01" type="number" value={openingForm.costRate} onChange={updateOpening("costRate")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" />
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Batch / lot (optional)
              <input value={openingForm.batchNumber} onChange={updateOpening("batchNumber")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" />
            </label>
          </div>
          <button type="button" onClick={addOpeningRow} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Plus size={16} /> Add to opening stock
          </button>
          {openingRows.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-sm font-medium text-slate-700">{openingRows.length} item{openingRows.length === 1 ? "" : "s"} ready to post</p>
              <div className="space-y-1.5">
                {openingRows.map((row, idx) => {
                  const item = items.find((i) => i.id === row.itemId);
                  return (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{item?.name || "Item"}</p>
                        <p className="text-xs text-slate-500">Batch {row.batchNumber || "—"} · Qty {row.quantity} · ₹{row.costRate}</p>
                      </div>
                      <button onClick={() => setOpeningRows(openingRows.filter((_, i) => i !== idx))} className="text-xs font-semibold text-rose-600 hover:underline">Remove</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {openingMutation.error && <div className="mt-4"><ErrorBanner error={openingMutation.error} /></div>}
          {notice && <p aria-live="polite" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{notice}</p>}
          <button disabled={openingMutation.isPending || openingRows.length === 0 || !openingForm.warehouseId} onClick={() => { setNotice(""); openingMutation.mutate(); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            <Send size={16} />{openingMutation.isPending ? "Posting…" : `Post ${openingRows.length} opening balance${openingRows.length === 1 ? "" : "s"}`}
          </button>
        </Card>
      )}
    </div>
  );
}

// ─── Reservations panel ───────────────────────────────────────────────────────

function ReservationsPanel() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["inventory-reservations"], queryFn: () => inventoryApi.reservations(), staleTime: 60 * 1000 });
  const release = useMutation({
    mutationFn: (id) => inventoryApi.releaseReservation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-reservations"] }),
  });
  if (query.isPending) return <SkeletonTable rows={4} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const rows = query.data?.data || [];
  return (
    <Card padding="p-0">
      <div className="border-b border-slate-200 p-5">
        <SectionHeader title="Stock reservations" description="Active allocations against on-hand stock." icon={Layers} />
      </div>
      {rows.length ? (
        <TableShell>
          <Head>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Warehouse</th>
            <th className="px-4 py-3 text-right">Quantity</th>
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3 text-right">Action</th>
          </Head>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <Cell className="font-mono text-xs text-slate-700">{row.itemId}</Cell>
                <Cell className="font-mono text-xs text-slate-700">{row.warehouseId}</Cell>
                <Cell className="text-right tabular-nums">{number(row.quantity, 3)}</Cell>
                <Cell className="text-slate-600">{row.referenceType || "—"} · {row.referenceId || "—"}</Cell>
                <Cell className="text-right">
                  {row.status === "ACTIVE" ? (
                    <button onClick={() => release.mutate(row.id)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Release
                    </button>
                  ) : <Pill tone="slate">{row.status}</Pill>}
                </Cell>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : <div className="p-5"><EmptyState title="No active reservations" description="Allocations created from sales orders will appear here." /></div>}
    </Card>
  );
}

// ─── Cycle counts panel ───────────────────────────────────────────────────────

function CycleCountsPanel({ warehouses }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ warehouseId: "", notes: "" });
  const list = useQuery({ queryKey: ["cycle-counts"], queryFn: () => inventoryApi.cycleCounts(), staleTime: 60 * 1000 });
  const create = useMutation({
    mutationFn: () => inventoryApi.createCycleCount({ warehouseId: form.warehouseId, notes: form.notes || undefined }),
    onSuccess: () => { setForm({ warehouseId: "", notes: "" }); qc.invalidateQueries({ queryKey: ["cycle-counts"] }); },
  });
  if (list.isPending) return <SkeletonTable rows={4} cols={4} />;
  if (list.isError) return <ErrorState error={list.error} onRetry={list.refetch} />;
  const rows = list.data?.data || [];
  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title="Schedule cycle count" description="Snapshot expected balances and reconcile physical counts." icon={ClipboardList} />
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <select required value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="">Warehouse</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          <button disabled={!form.warehouseId || create.isPending} onClick={() => create.mutate()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            <Plus size={16} />{create.isPending ? "Creating…" : "Create"}
          </button>
        </div>
        {create.error && <div className="mt-3"><ErrorBanner error={create.error} /></div>}
      </Card>
      <Card padding="p-0">
        <div className="border-b border-slate-200 p-5">
          <SectionHeader title="Recent cycle counts" description="Open and completed cycle counts." icon={ClipboardList} />
        </div>
        {rows.length ? (
          <TableShell>
            <Head>
              <th className="px-4 py-3">Count #</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </Head>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <Cell className="font-mono text-xs text-slate-700">{row.countNumber}</Cell>
                  <Cell className="font-mono text-xs text-slate-700">{row.warehouseId}</Cell>
                  <Cell><Pill tone={row.status === "COMPLETED" ? "emerald" : "amber"}>{row.status}</Pill></Cell>
                  <Cell className="text-slate-600">{date(row.createdAt)}</Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : <div className="p-5"><EmptyState title="No cycle counts yet" description="Schedule one to start reconciling physical stock." /></div>}
      </Card>
    </div>
  );
}

// ─── Warehouse manager ────────────────────────────────────────────────────────

function WarehouseManager() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["warehouses"], queryFn: () => coreApi.list("warehouses", { limit: 100 }), staleTime: 5 * 60 * 1000 });
  const [form, setForm] = useState({ name: "", code: "", warehouseType: "WAREHOUSE", capacity: "" });
  const create = useMutation({
    mutationFn: () => coreApi.create("warehouses", { name: form.name, code: form.code || null, warehouseType: form.warehouseType, capacity: form.capacity ? Number(form.capacity) : null }),
    onSuccess: () => { setForm({ name: "", code: "", warehouseType: "WAREHOUSE", capacity: "" }); qc.invalidateQueries({ queryKey: ["warehouses"] }); qc.invalidateQueries({ queryKey: ["inventory-masters"] }); },
  });
  if (list.isPending) return <SkeletonTable rows={4} cols={4} />;
  if (list.isError) return <ErrorState error={list.error} onRetry={list.refetch} />;
  const rows = list.data?.data || [];
  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title="Add warehouse" description="Create storage sites, zones, or quarantine areas." icon={Warehouse} />
        <div className="grid gap-3 sm:grid-cols-4">
          <input placeholder="Warehouse name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          <input placeholder="Code (optional)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          <select value={form.warehouseType} onChange={(e) => setForm({ ...form, warehouseType: e.target.value })} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            {["WAREHOUSE", "STORE", "QUARANTINE", "DAMAGE", "RETURNS", "TRANSIT", "OVERFLOW"].map((t) => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="Capacity (optional)" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="h-11 rounded-lg border border-slate-200 px-3 text-sm" />
        </div>
        {create.error && <div className="mt-3"><ErrorBanner error={create.error} /></div>}
        <button disabled={!form.name || create.isPending} onClick={() => create.mutate()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          <Plus size={16} />{create.isPending ? "Saving…" : "Create warehouse"}
        </button>
      </Card>
      <Card padding="p-0">
        <div className="border-b border-slate-200 p-5">
          <SectionHeader title="Warehouses" description={`${rows.length} site${rows.length === 1 ? "" : "s"} configured`} icon={MapPin} />
        </div>
        {rows.length ? (
          <TableShell>
            <Head>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Capacity</th>
              <th className="px-4 py-3">Status</th>
            </Head>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <Cell className="font-medium text-slate-950">{row.name}</Cell>
                  <Cell className="font-mono text-xs text-slate-600">{row.code || "—"}</Cell>
                  <Cell><Pill tone="blue">{row.warehouseType || "WAREHOUSE"}</Pill></Cell>
                  <Cell className="text-right tabular-nums">{row.capacity ? number(row.capacity, 3) : "—"}</Cell>
                  <Cell><Pill tone={row.isActive !== false ? "emerald" : "slate"}>{row.isActive !== false ? "Active" : "Inactive"}</Pill></Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : <div className="p-5"><EmptyState title="No warehouses" description="Create your first warehouse to start posting stock." /></div>}
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
  ["Overview", Boxes, "Health & KPIs"],
  ["Stock", PackagePlus, "On-hand balances"],
  ["Movements", ArrowDownUp, "Audit ledger"],
  ["Traceability", FileClock, "Batches & lots"],
  ["Operations", Truck, "Transfer / adjust / open"],
  ["Reservations", Layers, "Allocations"],
  ["CycleCounts", ClipboardList, "Physical counts"],
  ["Warehouses", Warehouse, "Sites & zones"],
];

export function InventoryPage() {
  const [tab, setTab] = useState("Overview");
  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");

  const masters = useQuery({
    queryKey: ["inventory-masters"],
    queryFn: async () => {
      const [warehouseResponse, itemResponse] = await Promise.all([
        coreApi.list("warehouses", { limit: 100 }),
        coreApi.list("items", { limit: 100 }),
      ]);
      return { warehouses: warehouseResponse.data || [], items: itemResponse.data || [] };
    },
    staleTime: 5 * 60 * 1000,
  });
  const warehouses = masters.data?.warehouses || [];
  const items = masters.data?.items || [];

  const renderTab = () => {
    if (masters.isError) return <ErrorState title="Inventory setup data unavailable" error={masters.error} onRetry={masters.refetch} />;
    switch (tab) {
      case "Overview": return <Overview warehouseId={warehouseId} onJump={setTab} />;
      case "Stock": return <StockTable warehouseId={warehouseId} search={search} />;
      case "Movements": return <MovementTable warehouseId={warehouseId} />;
      case "Traceability": return <BatchTable warehouseId={warehouseId} />;
      case "Operations": return <TransferWorkspace warehouses={warehouses} items={items} onPosted={() => setTab("Overview")} />;
      case "Reservations": return <ReservationsPanel />;
      case "CycleCounts": return <CycleCountsPanel warehouses={warehouses} />;
      case "Warehouses": return <WarehouseManager />;
      default: return null;
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader
        title="Inventory control tower"
        description="Monitor stock health, trace FIFO batches, investigate movements, and execute controlled warehouse operations."
        actions={
          <>
            <SecondaryButton label="Refresh" icon={RefreshCw} onClick={() => window.location.reload()} />
            <AddButton label="Stock operation" onClick={() => setTab("Operations")} />
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Inventory workspace" className="flex min-w-0 gap-1 overflow-x-auto">
          {TABS.map(([name, Icon, hint]) => (
            <button
              role="tab"
              aria-selected={tab === name}
              key={name}
              onClick={() => setTab(name)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${tab === name ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon size={16} />{name}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2 lg:justify-end">
          <label className="relative min-w-0 flex-1 lg:max-w-xs">
            <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <input aria-label="Search stock by product or SKU" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU or product" className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
          <select aria-label="Filter warehouse" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="h-11 max-w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="">All warehouses</option>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {TABS.find(([name]) => name === tab)?.[2]}
      </p>

      {renderTab()}
    </div>
  );
}
