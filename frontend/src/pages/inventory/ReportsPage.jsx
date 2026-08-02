/**
 * Inventory Reports — Stock analysis, valuation, movement, and reorder insights.
 *
 * Sub-reports:
 *  - Stock Valuation
 *  - Movement Report
 *  - Dead Stock / Slow Moving
 *  - Fast Moving Products
 *  - Low Stock Report
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Download, FileBarChart, TrendingDown, TrendingUp } from "lucide-react";
import { inventoryApi } from "../../services/api";
import { formatRupees } from "../../utils/money";
import { ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonTable } from "../../components/Skeleton";
import {
  Card, Cell, Head, Pill, SectionHeader,
  StatusPill, TableShell, number, date, exportCsv,
} from "./components/shared";

const REPORTS = [
  ["valuation", BarChart3, "Stock valuation report"],
  ["movements", FileBarChart, "Stock movement summary"],
  ["dead-stock", TrendingDown, "Dead & slow-moving stock"],
  ["fast-moving", TrendingUp, "Fast-moving products"],
  ["low-stock", BarChart3, "Low stock alerts & reorder suggestions"],
];

export default function ReportsPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState("valuation");

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <button onClick={() => navigate("/inventory")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 mb-2">
        <ArrowLeft size={14} /> Back to Inventory
      </button>
      <PageHeader
        title="Inventory reports"
        description="Stock valuation, movement analysis, and reorder insights."
      />

      <div className="flex flex-wrap gap-2">
        {REPORTS.map(([key, Icon, desc]) => (
          <button
            key={key}
            onClick={() => setReport(key)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${
              report === key ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Icon size={16} />
            {key.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </button>
        ))}
      </div>

      {report === "valuation" && <ValuationReport />}
      {report === "movements" && <MovementReport />}
      {report === "dead-stock" && <DeadStockReport />}
      {report === "fast-moving" && <FastMovingReport />}
      {report === "low-stock" && <LowStockReport />}
    </div>
  );
}

function ValuationReport() {
  const query = useQuery({
    queryKey: ["inventory-valuation-report"],
    queryFn: () => inventoryApi.valuationReport(),
    staleTime: 60 * 1000,
  });

  if (query.isPending) return <SkeletonTable rows={8} cols={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const { rows = [], totalValuePaise = 0 } = query.data?.data || {};

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Total inventory value (FIFO)</p>
            <p className="text-3xl font-bold text-blue-950">{formatRupees(totalValuePaise)}</p>
          </div>
          <BarChart3 size={40} className="text-blue-300" />
        </div>
      </Card>

      {rows.length ? (
        <>
          <SecondaryButton
            label="Export CSV"
            icon={Download}
            onClick={() =>
              exportCsv("velora-valuation.csv", rows, [
                { label: "SKU", value: (r) => r.item?.itemCode },
                { label: "Product", value: (r) => r.item?.name },
                { label: "Warehouse", value: (r) => r.warehouseId },
                { label: "Quantity", value: (r) => r.quantity },
                { label: "Avg Cost (₹)", value: (r) => (r.avgCostRate / 100).toFixed(2) },
                { label: "Value (₹)", value: (r) => (r.valuePaise / 100).toFixed(2) },
              ])
            }
          />
          <TableShell>
            <Head>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Avg Cost</th>
              <th className="px-4 py-3 text-right">FIFO Value</th>
              <th className="px-4 py-3 text-right">% of Total</th>
            </Head>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${row.itemId}-${row.warehouseId}`} className="hover:bg-slate-50">
                  <Cell className="font-medium text-slate-950">{row.item?.name || "Unknown"}</Cell>
                  <Cell className="font-mono text-xs text-blue-700">{row.item?.itemCode}</Cell>
                  <Cell className="text-right tabular-nums font-semibold">{number(row.quantity, 3)}</Cell>
                  <Cell className="text-right tabular-nums">{formatRupees(row.avgCostRate)}</Cell>
                  <Cell className="text-right tabular-nums font-semibold">{formatRupees(row.valuePaise)}</Cell>
                  <Cell className="text-right tabular-nums">
                    {totalValuePaise > 0 ? `${((row.valuePaise / totalValuePaise) * 100).toFixed(1)}%` : "—"}
                  </Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </>
      ) : (
        <EmptyState title="No stock data" description="Post opening stock or receive goods to see valuation." />
      )}
    </div>
  );
}

function MovementReport() {
  const query = useQuery({
    queryKey: ["inventory-ledger", "ALL"],
    queryFn: () => inventoryApi.ledger({ limit: 100 }),
    staleTime: 60 * 1000,
  });

  if (query.isPending) return <SkeletonTable rows={8} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const rows = query.data?.data || [];

  // Group by transaction type
  const byType = {};
  for (const row of rows) {
    byType[row.transactionType] = (byType[row.transactionType] || 0) + Math.abs(Number(row.quantity));
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(byType).map(([type, qty]) => (
          <Card key={type} padding="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{(type || "OTHER").replaceAll("_", " ")}</p>
            <p className="mt-2 text-xl font-bold text-slate-950">{number(qty, 3)} units</p>
          </Card>
        ))}
      </div>

      {rows.length ? (
        <>
          <SecondaryButton
            label="Export CSV"
            icon={Download}
            onClick={() =>
              exportCsv("velora-movements.csv", rows, [
                { label: "Date", value: (r) => r.createdAt },
                { label: "Product", value: (r) => r.item?.name },
                { label: "Type", value: (r) => r.transactionType },
                { label: "Quantity", value: (r) => r.quantity },
                { label: "Value (₹)", value: (r) => (r.value / 100).toFixed(2) },
              ])
            }
          />
          <TableShell>
            <Head>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Value</th>
            </Head>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 50).map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <Cell className="text-slate-600">{date(row.createdAt)}</Cell>
                  <Cell className="font-medium text-slate-950">{row.item?.name || "—"}</Cell>
                  <Cell>
                    <Pill tone={Number(row.quantity) < 0 ? "rose" : "emerald"}>
                      {(row.transactionType || "MOVEMENT").replaceAll("_", " ")}
                    </Pill>
                  </Cell>
                  <Cell className="text-right tabular-nums font-semibold">
                    {Number(row.quantity) > 0 ? "+" : ""}{number(row.quantity, 3)}
                  </Cell>
                  <Cell className="text-right tabular-nums">{formatRupees(Math.abs(row.value))}</Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </>
      ) : (
        <EmptyState title="No movements" description="Stock movements will appear as inventory transactions occur." />
      )}
    </div>
  );
}

function DeadStockReport() {
  // Use the control tower's slow-moving products
  const query = useQuery({
    queryKey: ["inventory-dashboard-v2"],
    queryFn: () => inventoryApi.dashboard({}),
    staleTime: 60 * 1000,
  });

  if (query.isPending) return <SkeletonTable rows={5} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const items = query.data?.data?.slowMovingProducts || [];

  return items.length ? (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50">
        <p className="text-sm font-semibold text-amber-800">
          {items.length} slow-moving item{items.length === 1 ? "" : "s"} identified. Items older than 90 days without recent sales are flagged.
        </p>
      </Card>
      <SecondaryButton
        label="Export CSV"
        icon={Download}
        onClick={() =>
          exportCsv("velora-dead-stock.csv", items, [
            { label: "Product", value: (r) => r.name },
            { label: "SKU", value: (r) => r.itemCode },
            { label: "Quantity", value: (r) => r.quantity },
            { label: "Value (₹)", value: (r) => (r.valuePaise / 100).toFixed(2) },
            { label: "Age (Days)", value: (r) => r.ageDays },
          ])
        }
      />
      <TableShell>
        <Head>
          <th className="px-4 py-3">Product</th>
          <th className="px-4 py-3">SKU</th>
          <th className="px-4 py-3 text-right">Quantity</th>
          <th className="px-4 py-3 text-right">Value</th>
          <th className="px-4 py-3 text-right">Age (days)</th>
        </Head>
        <tbody className="divide-y divide-slate-100">
          {items.map((row) => (
            <tr key={row.itemId} className="hover:bg-slate-50">
              <Cell className="font-medium text-slate-950">{row.name}</Cell>
              <Cell className="font-mono text-xs text-blue-700">{row.itemCode}</Cell>
              <Cell className="text-right tabular-nums font-semibold">{number(row.quantity, 3)}</Cell>
              <Cell className="text-right tabular-nums">{formatRupees(row.valuePaise)}</Cell>
              <Cell className="text-right tabular-nums">
                <Pill tone={row.ageDays > 180 ? "rose" : "amber"}>{row.ageDays || 0}d</Pill>
              </Cell>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  ) : (
    <EmptyState title="No dead stock" description="Items older than 90 days with no recent activity will surface here." />
  );
}

function FastMovingReport() {
  const query = useQuery({
    queryKey: ["inventory-dashboard-v2"],
    queryFn: () => inventoryApi.dashboard({}),
    staleTime: 60 * 1000,
  });

  if (query.isPending) return <SkeletonTable rows={5} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const items = query.data?.data?.topMovingProducts || [];

  return items.length ? (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50">
        <p className="text-sm font-semibold text-emerald-800">
          Top {items.length} products by inventory value — these represent your highest-value stocked items.
        </p>
      </Card>
      <SecondaryButton
        label="Export CSV"
        icon={Download}
        onClick={() =>
          exportCsv("velora-fast-moving.csv", items, [
            { label: "Product", value: (r) => r.name },
            { label: "SKU", value: (r) => r.itemCode },
            { label: "Quantity", value: (r) => r.quantity },
            { label: "Value (₹)", value: (r) => (r.valuePaise / 100).toFixed(2) },
          ])
        }
      />
      <TableShell>
        <Head>
          <th className="px-4 py-3">#</th>
          <th className="px-4 py-3">Product</th>
          <th className="px-4 py-3">SKU</th>
          <th className="px-4 py-3 text-right">Quantity</th>
          <th className="px-4 py-3 text-right">Value</th>
        </Head>
        <tbody className="divide-y divide-slate-100">
          {items.map((row, i) => (
            <tr key={row.itemId} className="hover:bg-slate-50">
              <Cell><span className="font-bold text-slate-400">{i + 1}</span></Cell>
              <Cell className="font-medium text-slate-950">{row.name}</Cell>
              <Cell className="font-mono text-xs text-blue-700">{row.itemCode}</Cell>
              <Cell className="text-right tabular-nums font-semibold">{number(row.quantity, 3)}</Cell>
              <Cell className="text-right tabular-nums">{formatRupees(row.valuePaise)}</Cell>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  ) : (
    <EmptyState title="No data" description="Post stock to see top-moving products." />
  );
}

function LowStockReport() {
  const query = useQuery({
    queryKey: ["inventory-low-stock-alerts"],
    queryFn: () => inventoryApi.lowStockAlerts(),
    staleTime: 60 * 1000,
  });

  if (query.isPending) return <SkeletonTable rows={5} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const alerts = query.data?.data || [];
  const outOfStock = alerts.filter((a) => a.status === "OUT_OF_STOCK");
  const low = alerts.filter((a) => a.status === "LOW");

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-rose-200 bg-rose-50">
          <p className="text-sm font-semibold text-rose-800">{outOfStock.length} out of stock items</p>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">{low.length} low stock items</p>
        </Card>
      </div>

      {alerts.length ? (
        <>
          <SecondaryButton
            label="Export CSV"
            icon={Download}
            onClick={() =>
              exportCsv("velora-low-stock.csv", alerts, [
                { label: "SKU", value: (r) => r.itemCode },
                { label: "Product", value: (r) => r.name },
                { label: "Status", value: (r) => r.status },
                { label: "On Hand", value: (r) => r.onHand },
                { label: "Reorder Level", value: (r) => r.reorderLevel },
                { label: "Suggested Order", value: (r) => r.suggestedOrderQty },
              ])
            }
          />
          <TableShell>
            <Head>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">On Hand</th>
              <th className="px-4 py-3 text-right">Reorder Level</th>
              <th className="px-4 py-3 text-right">Suggested Order</th>
            </Head>
            <tbody className="divide-y divide-slate-100">
              {alerts.map((row) => (
                <tr key={row.itemId} className="hover:bg-slate-50">
                  <Cell className="font-mono text-xs text-blue-700">{row.itemCode}</Cell>
                  <Cell className="font-medium text-slate-950">{row.name}</Cell>
                  <Cell>
                    <StatusPill status={row.status} />
                  </Cell>
                  <Cell className={`text-right tabular-nums font-semibold ${row.onHand <= 0 ? "text-rose-700" : "text-amber-700"}`}>
                    {number(row.onHand, 3)}
                  </Cell>
                  <Cell className="text-right tabular-nums">{number(row.reorderLevel, 3)}</Cell>
                  <Cell className="text-right tabular-nums font-semibold text-blue-700">
                    {number(row.suggestedOrderQty, 3)}
                  </Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </>
      ) : (
        <EmptyState title="All stocked up" description="No items are below their reorder threshold. Everything looks healthy." />
      )}
    </div>
  );
}
