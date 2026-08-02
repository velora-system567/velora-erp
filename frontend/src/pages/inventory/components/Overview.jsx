import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowDownUp, BarChart3, Box, Boxes, Download,
  FileClock, Layers, RefreshCw, Sparkles, Truck, Warehouse, Zap,
} from "lucide-react";
import { inventoryApi } from "../../../services/api";
import { formatRupees, formatRupeesCompact } from "../../../utils/money";
import { ErrorState } from "../../../components/ErrorState";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonCards, SkeletonTable } from "../../../components/Skeleton";
import { AddButton, SecondaryButton } from "../../../components/PageHeader";
import LiveIndicator from "../../../components/LiveIndicator";
import { Card, SectionHeader, KpiTile, Pill, number, dateTime, exportCsv } from "./shared";

export default function Overview({ warehouseId, onJump }) {
  const query = useQuery({
    queryKey: ["inventory-dashboard-v2", warehouseId],
    queryFn: () => inventoryApi.dashboard(warehouseId ? { warehouseId } : {}),
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  if (query.isPending) return <><SkeletonCards count={4} /><SkeletonTable rows={6} cols={5} /></>;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const data = query.data?.data;
  if (!data || !data.kpis) return <EmptyState title="No data available" description="The inventory dashboard returned an empty payload." />;

  const k = data.kpis;
  const isFresh = k.inventoryValuePaise > 0 || k.totalStock > 0;
  const hasRisks = k.lowStockItems > 0 || k.outOfStockItems > 0 || k.expiringBatches > 0;

  return (
    <div className="space-y-6">
      {/* Live status + refresh */}
      <div className="flex items-center justify-between gap-3">
        <LiveIndicator query={query} onRefresh={query.refetch} label="Inventory" />
        <span className="text-xs text-slate-400">Click a KPI to open its records</span>
      </div>

      {/* Opening stock prompt */}
      {!isFresh && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold text-slate-950">Start with opening stock</h2>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Post opening balances to activate FIFO valuation, low-stock alerts, ABC analysis, and procurement recommendations.
              </p>
            </div>
            <AddButton label="Post opening stock" onClick={() => onJump("Operations")} />
          </div>
        </Card>
      )}

      {/* KPI Grid — each tile opens its live operational list */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Inventory value" value={k.inventoryValuePaise} tone="blue" icon={BarChart3} formatter={formatRupeesCompact} detail="FIFO cost basis · view stock" onClick={() => onJump("Stock")} />
        <KpiTile label="Total stock" value={k.totalStock} tone="slate" icon={Boxes} formatter={(v) => `${number(v, 3)} u`} detail={`${k.totalSkus || 0} active SKUs · view stock`} onClick={() => onJump("Stock")} />
        <KpiTile label="Turnover (annualized)" value={k.inventoryTurnover} tone="purple" icon={RefreshCw} formatter={(v) => `${number(v, 2)}x`} detail="Sales ÷ avg on-hand · view movements" onClick={() => onJump("Movements")} />
        <KpiTile label="Reserved stock" value={k.reservedStock} tone="emerald" icon={Layers} formatter={(v) => number(v, 3)} detail="Active allocations · view reserved" onClick={() => onJump("Reserved Stocks")} />
      </section>

      {/* Risk strip */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Out of stock" value={k.outOfStockItems} tone="rose" icon={AlertTriangle} detail="Items with zero on-hand · view stock" onClick={() => onJump("Stock")} />
        <KpiTile label="Low stock" value={k.lowStockItems} tone="amber" icon={AlertTriangle} detail="At or below reorder level · view stock" onClick={() => onJump("Stock")} />
        <KpiTile label="Overstock" value={k.overstockItems} tone="amber" icon={Box} detail="Above 3× reorder level · view stock" onClick={() => onJump("Stock")} />
        <KpiTile label="Expiring (90d)" value={k.expiringBatches} tone="rose" icon={FileClock} detail="Batches needing attention · view lots" onClick={() => onJump("Traceability")} />
      </section>

      {/* Warehouse summary + ABC */}
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <WarehouseSummary data={data} />
        <AbcSummary data={data} />
      </section>

      {/* Top moving / slow moving */}
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Top stocked products" description="Highest on-hand value across the company." icon={Boxes} />
          {data.topMovingProducts?.length ? (
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
          {data.slowMovingProducts?.length ? (
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
            actions={data.recommendations?.length ? <Pill tone="rose">{data.recommendations.length} action{data.recommendations.length > 1 ? "s" : ""}</Pill> : null}
          />
          {data.recommendations?.length ? (
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

        <ExpiringBatches data={data} />
      </section>

      {/* Movement heatmap */}
      {data.movementHeatmap && (
        <MovementHeatmap data={data.movementHeatmap} />
      )}

      {/* Recent activity */}
      <Card padding="p-0">
        <div className="border-b border-slate-200 p-5">
          <SectionHeader title="Recent inventory activity" description="Approved goods receipts, transfers, production, and adjustments." icon={ArrowDownUp} />
        </div>
        {data.recentActivity?.length ? (
          <div className="divide-y divide-slate-100">
            {data.recentActivity.map((row) => (
              <button key={row.id} onClick={() => onJump("Movements")} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{row.item?.name || "Inventory movement"}</p>
                  <p className="text-xs text-slate-500">{row.warehouse?.name || "—"} · {dateTime(row.createdAt)}</p>
                </div>
                <div className="text-right">
                  <Pill tone={Number(row.quantity) < 0 ? "rose" : "emerald"}>{(row.transactionType || "MOVEMENT").replaceAll("_", " ")}</Pill>
                  <p className="mt-1 tabular-nums text-xs text-slate-600">{Number(row.quantity) > 0 ? "+" : ""}{number(row.quantity, 3)}</p>
                </div>
              </button>
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

function WarehouseSummary({ data }) {
  return (
    <Card>
      <SectionHeader title="Warehouse summary" description="Stock quantity and FIFO value by storage site." icon={Warehouse}
        actions={data.warehouseSummary?.length ? <SecondaryButton label="Export CSV" icon={Download} onClick={() => exportCsv("velora-warehouse-summary.csv", data.warehouseSummary, [
          { label: "Warehouse", value: (r) => r.warehouseName },
          { label: "SKUs", value: (r) => r.skuCount },
          { label: "Quantity", value: (r) => r.quantity },
          { label: "Value (₹)", value: (r) => (r.valuePaise / 100).toFixed(2) },
        ])} /> : null}
      />
      {data.warehouseSummary?.length ? (
        <div className="space-y-2.5">
          {data.warehouseSummary.map((row) => {
            const total = data.warehouseSummary.reduce((s, r) => s + r.valuePaise, 0);
            const pctVal = total > 0 ? Math.round((row.valuePaise / total) * 100) : 0;
            return (
              <div key={row.warehouseId} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{row.warehouseName}</p>
                    <p className="text-xs text-slate-500">{number(row.skuCount)} active SKUs · {number(row.quantity, 3)} units</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-slate-950">{formatRupees(row.valuePaise)}</p>
                    <p className="text-xs text-slate-500">{pctVal}% of total</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${pctVal}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No warehouses with stock" description="Post opening stock or approve a goods receipt to populate warehouse balances." />
      )}
    </Card>
  );
}

function AbcSummary({ data }) {
  return (
    <Card>
      <SectionHeader title="ABC analysis" description="Classified by current inventory value (Pareto)." icon={BarChart3} />
      {data.abcSummary?.length ? (
        <div className="space-y-2.5">
          {data.abcSummary.map((row) => (
            <div key={row.classification} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
              <Pill tone={row.classification === "A" ? "rose" : row.classification === "B" ? "amber" : "blue"}>
                Class {row.classification}
              </Pill>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{number(row.itemCount)} SKUs</p>
                <p className="text-xs text-slate-500">
                  {row.classification === "A" ? "Tight control, frequent counts" : row.classification === "B" ? "Moderate control" : "Loose control, periodic review"}
                </p>
              </div>
              <strong className="tabular-nums text-slate-950">{formatRupeesCompact(row.valuePaise)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No data" description="ABC analysis appears after first stock movement." />
      )}
    </Card>
  );
}

function ExpiringBatches({ data }) {
  return (
    <Card>
      <SectionHeader title="Expiring batches (90 days)" description="Batches that need usage or write-off decisions." icon={AlertTriangle} />
      {data.expiringBatches?.length ? (
        <div className="divide-y divide-slate-100">
          {data.expiringBatches.slice(0, 8).map((row) => {
            const days = row.expiryDate ? Math.floor((new Date(row.expiryDate).getTime() - Date.now()) / 86400000) : null;
            return (
              <div key={row.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{row.item?.name}</p>
                  <p className="font-mono text-xs text-slate-500">{row.item?.itemCode} · Batch {row.batchNumber || "—"} · {row.warehouse?.name || "—"}</p>
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
  );
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MovementHeatmap({ data }) {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.flatMap((row) => row), 1);
  return (
    <Card>
      <SectionHeader title="Movement heatmap (7 days)" description="Stock activity by hour. Darker = more movements." icon={BarChart3} />
      <div className="overflow-x-auto">
        <div className="flex gap-1">
          {data.map((day, di) => (
            <div key={di} className="flex flex-col items-center gap-0.5" style={{ minWidth: "24px" }}>
              <span className="text-[10px] font-medium text-slate-500">{DAY_LABELS[di]}</span>
              {day.map((count, hi) => (
                <div
                  key={hi}
                  className="rounded-sm"
                  style={{
                    width: "14px",
                    height: "14px",
                    backgroundColor: count > 0
                      ? `rgba(37, 99, 235, ${0.1 + (count / maxVal) * 0.9})`
                      : "#f1f5f9",
                  }}
                  title={`${DAY_LABELS[di]} ${hi}:00 — ${count} movements`}
                />
              ))}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-400">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-100 align-middle mr-1" /> Low
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-600 align-middle mx-1" /> High
        </p>
      </div>
    </Card>
  );
}
