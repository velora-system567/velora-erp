import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Warehouse, MapPin, Plus, RefreshCw, Activity, Package,
  BarChart3, X, CheckCircle2,
} from "lucide-react";
import { wmsApi } from "../../services/api";
import { ErrorBanner, ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { AddButton, PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { Card, Cell, Head, KpiTile, Pill, SectionHeader, TableShell, number, dateTime, exportCsv } from "../inventory/components/shared";

const TABS = [
  ["dashboard", BarChart3, "WMS Dashboard"],
  ["locations", MapPin, "Bin Locations"],
  ["movements", Activity, "Stock Movements"],
];

export function WmsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(localStorage.getItem("wms_tab") || "dashboard");
  const switchTab = (t) => { setTab(t); localStorage.setItem("wms_tab", t); };

  const dashQuery = useQuery({
    queryKey: ["wms-dashboard"],
    queryFn: wmsApi.dashboard,
    staleTime: 60 * 1000,
    enabled: tab === "dashboard",
  });

  const locQuery = useQuery({
    queryKey: ["wms-locations"],
    queryFn: () => wmsApi.locations({}),
    staleTime: 30 * 1000,
    enabled: tab === "locations",
  });

  const movQuery = useQuery({
    queryKey: ["wms-movements"],
    queryFn: () => wmsApi.movements({ limit: 50 }),
    staleTime: 30 * 1000,
    enabled: tab === "movements",
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader title="Warehouse Management System"
        description="Manage warehouses, bin locations, and stock movements."
        actions={<SecondaryButton label="Refresh" icon={RefreshCw} onClick={() => qc.invalidateQueries({ queryKey: ["wms"] })} />} />

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map(([key, Icon, label]) => (
          <button key={key} onClick={() => switchTab(key)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${tab === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab data={dashQuery} />}
      {tab === "locations" && <LocationsTab query={locQuery} />}
      {tab === "movements" && <MovementsTab query={movQuery} />}
    </div>
  );
}

function DashboardTab({ data: query }) {
  const qc = useQueryClient();
  if (query.isPending) return <div className="space-y-4"><SkeletonCards count={6} /><SkeletonTable rows={5} cols={4} /></div>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["wms-dashboard"] })} />;
  const d = query.data?.data;
  if (!d) return <EmptyState title="No warehouse data" />;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Warehouses" value={d.kpis.totalWarehouses} tone="blue" icon={Warehouse} detail={`${d.kpis.totalLocations} bin locations`} />
        <KpiTile label="Total Stock" value={d.kpis.totalStock} tone="slate" icon={Package} formatter={(v) => number(v, 3)} />
        <KpiTile label="Pending Transfers" value={d.kpis.pendingTransfers} tone="amber" icon={Activity} />
        <KpiTile label="Open Cycle Counts" value={d.kpis.openCycleCounts} tone="purple" icon={CheckCircle2} />
      </section>

      {d.warehouses?.length > 0 && (
        <Card>
          <SectionHeader title="Warehouse Utilization" description="Capacity and current stock levels" icon={Warehouse} />
          <div className="space-y-3">
            {d.warehouses.map((w) => (
              <div key={w.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div><p className="font-semibold text-slate-950">{w.name}</p><p className="text-xs text-slate-500">{w.type} · {w.locationCount} locations</p></div>
                  <div className="text-right"><p className="font-semibold tabular-nums">{number(w.stockUnits, 1)} units</p><p className="text-xs text-slate-500">{w.utilization}% utilized</p></div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all ${w.utilization > 90 ? "bg-rose-500" : w.utilization > 70 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(w.utilization, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function LocationsTab({ query }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ warehouseId: "", code: "", name: "", zone: "", bin: "", capacity: "" });

  const warehouses = qc.getQueryData(["wms-dashboard"])?.data?.warehouses || [];
  const createMutation = useMutation({
    mutationFn: (data) => wmsApi.createLocation(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wms-locations"] }); setShowCreate(false); },
  });

  if (query.isPending) return <SkeletonTable rows={6} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} />;
  const locations = query.data?.data || [];

  if (showCreate) {
    return (
      <Card>
        <SectionHeader title="New Bin Location" icon={MapPin} actions={<button onClick={() => setShowCreate(false)}><X size={18} /></button>} />
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Warehouse<select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} required className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Select</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
            <label className="text-sm font-medium">Code<small className="text-slate-400 ml-1">(e.g. B12-03-07)</small><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
            <label className="text-sm font-medium">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
            <label className="text-sm font-medium">Zone<input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="A, B, C..." /></label>
          </div>
          {createMutation.error && <div className="mt-3"><ErrorBanner error={createMutation.error} /></div>}
          <button type="submit" disabled={createMutation.isPending} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{createMutation.isPending ? "Creating…" : "Create Location"}</button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><AddButton label="New Location" onClick={() => setShowCreate(true)} /></div>
      {locations.length ? (
        <TableShell>
          <Head><th className="px-4 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Zone</th><th className="px-4 py-3">Bin</th><th className="px-4 py-3 text-right">Capacity</th></Head>
          <tbody className="divide-y divide-slate-100">
            {locations.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <Cell className="font-mono text-xs font-semibold text-blue-700">{l.code}</Cell>
                <Cell className="text-slate-950">{l.name}</Cell>
                <Cell><Pill tone="blue">{l.zone || "—"}</Pill></Cell>
                <Cell className="font-mono text-xs text-slate-600">{l.bin || "—"}</Cell>
                <Cell className="text-right tabular-nums">{l.capacity ? number(l.capacity, 2) : "—"}</Cell>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : <EmptyState title="No locations" description="Create your first bin location." />}
    </div>
  );
}

function MovementsTab({ query }) {
  const qc = useQueryClient();
  if (query.isPending) return <SkeletonTable rows={8} cols={6} />;
  if (query.isError) return <ErrorState error={query.error} />;
  const movements = query.data?.data || [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-3">
      <SecondaryButton label="Export CSV" icon={RefreshCw} onClick={() => exportCsv("stock-movements.csv", movements, [
        { label: "Date", value: (r) => r.createdAt },
        { label: "Item", value: (r) => r.item?.name },
        { label: "SKU", value: (r) => r.item?.itemCode },
        { label: "Type", value: (r) => r.transactionType },
        { label: "Warehouse", value: (r) => r.warehouse?.name },
        { label: "Qty", value: (r) => r.quantity },
      ])} />
      <TableShell>
        <Head><th className="px-4 py-3">Date</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Warehouse</th><th className="px-4 py-3 text-right">Qty</th></Head>
        <tbody className="divide-y divide-slate-100">
          {movements.length ? movements.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50">
              <Cell className="text-slate-600 text-xs">{dateTime(m.createdAt)}</Cell>
              <Cell><p className="font-medium text-slate-950">{m.item?.name || "—"}</p><p className="text-xs text-slate-500">{m.item?.itemCode}</p></Cell>
              <Cell><Pill tone={Number(m.quantity) < 0 ? "rose" : "emerald"}>{m.transactionType?.replace(/_/g, " ")}</Pill></Cell>
              <Cell className="text-slate-600 text-xs">{m.warehouse?.name || "—"}</Cell>
              <Cell className={`text-right font-semibold tabular-nums ${Number(m.quantity) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{Number(m.quantity) > 0 ? "+" : ""}{number(m.quantity, 3)}</Cell>
            </tr>
          )) : (
            <tr><Cell colSpan={5} className="py-12 text-center text-slate-500">No movements found.</Cell></tr>
          )}
        </tbody>
      </TableShell>
      {meta && <p className="text-xs text-slate-500">Showing {movements.length} of {meta.total} movements</p>}
    </div>
  );
}
