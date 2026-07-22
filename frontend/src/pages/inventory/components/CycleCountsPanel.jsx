import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { inventoryApi } from "../../../services/api";
import { ErrorBanner } from "../../../components/ErrorState";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonTable } from "../../../components/Skeleton";
import { Card, Cell, Head, Pill, SectionHeader, TableShell, date } from "./shared";

export default function CycleCountsPanel({ warehouses = [] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ warehouseId: "", notes: "" });

  const list = useQuery({
    queryKey: ["cycle-counts"],
    queryFn: () => inventoryApi.cycleCounts(),
    staleTime: 60 * 1000,
  });

  const create = useMutation({
    mutationFn: () =>
      inventoryApi.createCycleCount({
        warehouseId: form.warehouseId,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      setForm({ warehouseId: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
  });

  if (list.isPending) return <SkeletonTable rows={4} cols={4} />;
  if (list.isError) return <ErrorState error={list.error} onRetry={list.refetch} />;

  const rows = list.data?.data || [];
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader
          title="Schedule cycle count"
          description="Snapshot expected balances and reconcile physical counts."
          icon={ClipboardList}
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <select
            required
            value={form.warehouseId}
            onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm"
          />
          <button
            disabled={!form.warehouseId || create.isPending}
            onClick={() => create.mutate()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={16} />
            {create.isPending ? "Creating…" : "Create"}
          </button>
        </div>
        {create.error && <div className="mt-3"><ErrorBanner error={create.error} /></div>}
      </Card>

      <Card padding="p-0">
        <div className="border-b border-slate-200 p-5">
          <SectionHeader
            title="Recent cycle counts"
            description="Open and completed cycle counts."
            icon={ClipboardList}
          />
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
                  <Cell className="font-mono text-xs text-slate-700">
                    {warehouseMap.get(row.warehouseId)?.name || row.warehouseId}
                  </Cell>
                  <Cell>
                    <Pill tone={row.status === "COMPLETED" ? "emerald" : "amber"}>{row.status}</Pill>
                  </Cell>
                  <Cell className="text-slate-600">{date(row.createdAt)}</Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No cycle counts yet"
              description="Schedule one to start reconciling physical stock."
            />
          </div>
        )}
      </Card>
    </div>
  );
}
