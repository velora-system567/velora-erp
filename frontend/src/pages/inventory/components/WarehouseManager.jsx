import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Warehouse } from "lucide-react";
import { coreApi } from "../../../services/api";
import { ErrorBanner } from "../../../components/ErrorState";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonTable } from "../../../components/Skeleton";
import { Card, Cell, Head, Pill, SectionHeader, TableShell, number } from "./shared";

const WAREHOUSE_TYPES = [
  "WAREHOUSE", "STORE", "QUARANTINE", "DAMAGE", "RETURNS", "TRANSIT", "OVERFLOW",
];

export default function WarehouseManager() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => coreApi.list("warehouses", { limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const [form, setForm] = useState({
    name: "",
    code: "",
    warehouseType: "WAREHOUSE",
    capacity: "",
  });

  const create = useMutation({
    mutationFn: () =>
      coreApi.create("warehouses", {
        name: form.name,
        code: form.code || null,
        warehouseType: form.warehouseType,
        capacity: form.capacity ? Number(form.capacity) : null,
      }),
    onSuccess: () => {
      setForm({ name: "", code: "", warehouseType: "WAREHOUSE", capacity: "" });
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      qc.invalidateQueries({ queryKey: ["inventory-masters"] });
    },
  });

  if (list.isPending) return <SkeletonTable rows={4} cols={4} />;
  if (list.isError) return <ErrorState error={list.error} onRetry={list.refetch} />;

  const rows = list.data?.data || [];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader
          title="Add warehouse"
          description="Create storage sites, zones, or quarantine areas."
          icon={Warehouse}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            placeholder="Warehouse name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm"
          />
          <input
            placeholder="Code (optional)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm"
          />
          <select
            value={form.warehouseType}
            onChange={(e) => setForm({ ...form, warehouseType: e.target.value })}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            {WAREHOUSE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            placeholder="Capacity (optional)"
            type="number"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm"
          />
        </div>
        {create.error && <div className="mt-3"><ErrorBanner error={create.error} /></div>}
        <button
          disabled={!form.name || create.isPending}
          onClick={() => create.mutate()}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={16} />
          {create.isPending ? "Saving…" : "Create warehouse"}
        </button>
      </Card>

      <Card padding="p-0">
        <div className="border-b border-slate-200 p-5">
          <SectionHeader
            title="Warehouses"
            description={`${rows.length} site${rows.length === 1 ? "" : "s"} configured`}
            icon={MapPin}
          />
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
                  <Cell>
                    <Pill tone="blue">{row.warehouseType || "WAREHOUSE"}</Pill>
                  </Cell>
                  <Cell className="text-right tabular-nums">
                    {row.capacity ? number(row.capacity, 3) : "—"}
                  </Cell>
                  <Cell>
                    <Pill tone={row.isActive !== false ? "emerald" : "slate"}>
                      {row.isActive !== false ? "Active" : "Inactive"}
                    </Pill>
                  </Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No warehouses"
              description="Create your first warehouse to start posting stock."
            />
          </div>
        )}
      </Card>
    </div>
  );
}
