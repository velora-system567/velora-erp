import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "../../../services/api";
import { formatRupees } from "../../../utils/money";
import { ErrorState } from "../../../components/ErrorState";
import { SkeletonTable } from "../../../components/Skeleton";
import { Cell, Head, Pill, TableShell, number, date, dateTime } from "./shared";

const MOVEMENT_TYPES = [
  "PURCHASE", "SALE", "TRANSFER_IN", "TRANSFER_OUT",
  "ADJUSTMENT", "OPENING", "PRODUCTION_IN", "PRODUCTION_OUT",
];

export default function MovementTable({ warehouseId }) {
  const [filters, setFilters] = useState({ transactionType: "", fromDate: "", toDate: "" });
  const [page, setPage] = useState(1);

  const params = {
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    page,
    limit: 50,
  };
  if (warehouseId) params.warehouseId = warehouseId;

  const query = useQuery({
    queryKey: ["inventory-ledger", warehouseId, filters, page],
    queryFn: () => inventoryApi.ledger(params),
    staleTime: 60 * 1000,
  });

  if (query.isPending) return <SkeletonTable rows={8} cols={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const rows = query.data?.data || [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          aria-label="Filter movement type"
          value={filters.transactionType}
          onChange={(e) => { setFilters({ ...filters, transactionType: e.target.value }); setPage(1); }}
          className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All movement types</option>
          {MOVEMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input
          aria-label="From date"
          type="date"
          value={filters.fromDate}
          onChange={(e) => { setFilters({ ...filters, fromDate: e.target.value }); setPage(1); }}
          className="h-11 rounded-lg border border-slate-200 px-3 text-sm"
        />
        <input
          aria-label="To date"
          type="date"
          value={filters.toDate}
          onChange={(e) => { setFilters({ ...filters, toDate: e.target.value }); setPage(1); }}
          className="h-11 rounded-lg border border-slate-200 px-3 text-sm"
        />
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
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id}>
                <Cell className="text-slate-600">{dateTime(row.createdAt)}</Cell>
                <Cell>
                  <p className="font-medium text-slate-950">{row.item?.name || "Unknown item"}</p>
                  <p className="font-mono text-xs text-slate-500">{row.item?.itemCode}</p>
                </Cell>
                <Cell>
                  <Pill tone={Number(row.quantity) < 0 ? "rose" : "emerald"}>
                    {(row.transactionType || "MOVEMENT").replaceAll("_", " ")}
                  </Pill>
                </Cell>
                <Cell className="text-slate-600">{row.warehouse?.name || "—"}</Cell>
                <Cell className="text-right font-semibold tabular-nums">
                  {Number(row.quantity) > 0 ? "+" : ""}
                  {number(row.quantity, 3)}
                </Cell>
                <Cell className="text-right tabular-nums">{formatRupees(Math.abs(row.value))}</Cell>
              </tr>
            ))
          ) : (
            <tr>
              <Cell colSpan={6} className="py-12 text-center text-slate-500">
                No movements match these filters.
              </Cell>
            </tr>
          )}
        </tbody>
      </TableShell>
      {meta && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {rows.length} of {meta.total} movements · page {meta.page} / {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
            >
              Previous
            </button>
            <button
              disabled={page >= (meta.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
