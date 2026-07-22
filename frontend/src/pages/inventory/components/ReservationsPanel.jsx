import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { inventoryApi } from "../../../services/api";
import { ErrorState } from "../../../components/ErrorState";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonTable } from "../../../components/Skeleton";
import { Card, Cell, Head, Pill, SectionHeader, TableShell, number } from "./shared";

export default function ReservationsPanel({ warehouses = [], items = [] }) {
  const qc = useQueryClient();
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const query = useQuery({
    queryKey: ["inventory-reservations"],
    queryFn: () => inventoryApi.reservations(),
    staleTime: 60 * 1000,
  });

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
        <SectionHeader
          title="Stock reservations"
          description="Active allocations against on-hand stock."
          icon={Layers}
        />
      </div>
      {rows.length ? (
        <TableShell>
          <Head>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Warehouse</th>
            <th className="px-4 py-3 text-right">Quantity</th>
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3 text-right">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </Head>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <Cell>
                  <p className="font-medium text-slate-950">{itemMap.get(row.itemId)?.name || row.itemId}</p>
                  <p className="font-mono text-xs text-slate-500">{itemMap.get(row.itemId)?.itemCode || ""}</p>
                </Cell>
                <Cell className="text-sm text-slate-600">
                  {warehouseMap.get(row.warehouseId)?.name || row.warehouseId}
                </Cell>
                <Cell className="text-right tabular-nums font-semibold">{number(row.quantity, 3)}</Cell>
                <Cell className="text-xs text-slate-600">
                  {row.referenceType || "—"} · {(row.referenceId || "—").slice(0, 8)}
                </Cell>
                <Cell className="text-right">
                  <Pill tone={row.status === "ACTIVE" ? "emerald" : "slate"}>{row.status}</Pill>
                </Cell>
                <Cell className="text-right">
                  {row.status === "ACTIVE" ? (
                    <button
                      onClick={() => release.mutate(row.id)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Release
                    </button>
                  ) : null}
                </Cell>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : (
        <div className="p-5">
          <EmptyState title="No active reservations" description="Allocations created from sales orders will appear here." />
        </div>
      )}
    </Card>
  );
}
