import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "../../../services/api";
import { formatRupees } from "../../../utils/money";
import { ErrorState } from "../../../components/ErrorState";
import { SkeletonTable } from "../../../components/Skeleton";
import { Cell, Head, Pill, TableShell, number, date } from "./shared";

export default function BatchTable({ warehouseId }) {
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
        <select
          aria-label="Filter batch status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="ALL">All batches</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRING">Expiring within 90 days</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <Pill tone="blue">
          {rows.length} batch{rows.length === 1 ? "" : "es"}
        </Pill>
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
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id}>
                <Cell>
                  <p className="font-medium text-slate-950">{row.item?.name}</p>
                  <p className="font-mono text-xs text-slate-500">{row.item?.itemCode}</p>
                </Cell>
                <Cell className="font-mono text-xs text-slate-700">{row.batchNumber || "Unbatched"}</Cell>
                <Cell className="text-slate-600">{row.warehouse?.name}</Cell>
                <Cell className="text-right font-semibold tabular-nums">{number(row.qtyRemaining, 3)}</Cell>
                <Cell>
                  <Pill tone={row.expiryDate && new Date(row.expiryDate) < new Date() ? "rose" : "slate"}>
                    {date(row.expiryDate)}
                  </Pill>
                </Cell>
                <Cell className="text-right tabular-nums">{formatRupees(row.costRate)}</Cell>
              </tr>
            ))
          ) : (
            <tr>
              <Cell colSpan={6} className="py-12 text-center text-slate-500">
                No batches match this traceability view.
              </Cell>
            </tr>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
