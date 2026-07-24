import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu, RefreshCw, Wrench, BarChart3, Plus, X, Activity, AlertTriangle,
} from "lucide-react";
import { eamApi } from "../../services/api";
import { formatRupees } from "../../utils/money";
import { ErrorBanner, ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { AddButton, PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { Card, Cell, Head, KpiTile, Pill, SectionHeader, StatusPill, TableShell, number, date } from "../inventory/components/shared";

const TABS = [
  ["dashboard", BarChart3, "Dashboard"],
  ["assets", Cpu, "Assets"],
  ["maintenance", Wrench, "Maintenance"],
];

const STATUSES = ["IDLE", "RUNNING", "MAINTENANCE", "BREAKDOWN", "RETIRED", "BROKEN", "DISPOSED"];

export function EamPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(localStorage.getItem("eam_tab") || "dashboard");
  const switchTab = (t) => { setTab(t); localStorage.setItem("eam_tab", t); };

  const dashQuery = useQuery({ queryKey: ["eam-dashboard"], queryFn: eamApi.dashboard, staleTime: 60 * 1000, enabled: tab === "dashboard" });
  const assetsQuery = useQuery({ queryKey: ["eam-assets"], queryFn: () => eamApi.assets({ limit: 100 }), staleTime: 30 * 1000, enabled: tab === "assets" });
  const maintQuery = useQuery({ queryKey: ["eam-maintenance"], queryFn: () => eamApi.maintenance({ limit: 50 }), staleTime: 30 * 1000, enabled: tab === "maintenance" });

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader title="Enterprise Asset Management" description="Track, maintain, and optimize every asset across your organization."
        actions={<SecondaryButton label="Refresh" icon={RefreshCw} onClick={() => qc.invalidateQueries({ queryKey: ["eam"] })} />} />
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map(([key, Icon, label]) => (
          <button key={key} onClick={() => switchTab(key)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${tab === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={16} /> {label}</button>
        ))}
      </div>
      {tab === "dashboard" && <DashboardTab data={dashQuery} />}
      {tab === "assets" && <AssetsTab query={assetsQuery} />}
      {tab === "maintenance" && <MaintenanceTab query={maintQuery} />}
    </div>
  );
}

function DashboardTab({ data: query }) {
  if (query.isPending) return <div className="space-y-4"><SkeletonCards count={4} /><SkeletonTable rows={5} cols={3} /></div>;
  if (query.isError) return <ErrorState error={query.error} />;
  const d = query.data?.data;
  if (!d) return <EmptyState title="No asset data" />;
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Total Assets" value={d.kpis.totalAssets} tone="blue" icon={Cpu} detail={`${d.kpis.activeAssets} active`} />
        <KpiTile label="Active" value={d.kpis.activeAssets} tone="emerald" icon={Activity} />
        <KpiTile label="Maintenance Due" value={d.kpis.maintenanceDue} tone="amber" icon={Wrench} detail={`${d.kpis.maintenanceOverdue} overdue`} />
        <KpiTile label="Total Maintenance" value={d.kpis.totalMaintenance} tone="purple" icon={AlertTriangle} />
      </section>
      {d.recentActivity?.length > 0 && (
        <Card>
          <SectionHeader title="Recent Maintenance" description="Latest tasks" icon={Wrench} />
          <div className="divide-y divide-slate-100">{d.recentActivity.slice(0, 8).map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div><p className="font-medium text-slate-950">{t.assetName || "—"}</p><p className="text-xs text-slate-500">{t.taskType}</p></div>
              <div className="text-right"><StatusPill status={t.status} /><p className="text-xs text-slate-500 mt-0.5">{date(t.scheduledDate)}</p></div>
            </div>
          ))}</div>
        </Card>
      )}
    </div>
  );
}

function AssetsTab({ query }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ machineCode: "", name: "", type: "", location: "", status: "IDLE" });
  const createMutation = useMutation({ mutationFn: (data) => eamApi.createAsset(data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["eam-assets"] }); setShowCreate(false); } });

  if (query.isPending) return <SkeletonTable rows={8} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} />;
  const assets = query.data?.data || [];
  const meta = query.data?.meta;

  if (showCreate) {
    return (
      <Card>
        <SectionHeader title="Register Asset" icon={Cpu} actions={<button onClick={() => setShowCreate(false)}><X size={18} /></button>} />
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["machineCode", "Asset Code", "text"], ["name", "Asset Name", "text"], ["type", "Type", "text"], ["location", "Location", "text"]].map(([k, label, type]) => (
              <label key={k} className="text-sm font-medium">{label}<input type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" /></label>
            ))}
            <label className="text-sm font-medium">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
          {createMutation.error && <div className="mt-3"><ErrorBanner error={createMutation.error} /></div>}
          <button type="submit" disabled={createMutation.isPending} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{createMutation.isPending ? "Saving…" : "Register Asset"}</button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">{meta ? `${meta.total} assets` : `${assets.length} assets`}</p>
        <AddButton label="Register Asset" onClick={() => setShowCreate(true)} />
      </div>
      {assets.length ? (
        <TableShell>
          <Head><th className="px-4 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Health</th></Head>
          <tbody className="divide-y divide-slate-100">{assets.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <Cell className="font-mono text-xs font-semibold text-blue-700">{a.machineCode}</Cell>
              <Cell className="font-medium text-slate-950">{a.name}</Cell>
              <Cell><Pill tone="blue">{a.type || "—"}</Pill></Cell>
              <Cell className="text-slate-600">{a.location || "—"}</Cell>
              <Cell><StatusPill status={a.status} /></Cell>
              <Cell className="text-right"><Pill tone={a.healthScore >= 80 ? "emerald" : a.healthScore >= 50 ? "amber" : "rose"}>{a.healthScore}%</Pill></Cell>
            </tr>
          ))}</tbody>
        </TableShell>
      ) : <EmptyState title="No assets" description="Register your first asset to start tracking." />}
    </div>
  );
}

function MaintenanceTab({ query }) {
  if (query.isPending) return <SkeletonTable rows={6} cols={6} />;
  if (query.isError) return <ErrorState error={query.error} />;
  const tasks = query.data?.data || [];
  const meta = query.data?.meta;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{meta ? `${meta.total} maintenance tasks` : `${tasks.length} tasks`}</p>
      {tasks.length ? (
        <TableShell>
          <Head><th className="px-4 py-3">Task #</th><th className="px-4 py-3">Asset</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Scheduled</th><th className="px-4 py-3">Location</th></Head>
          <tbody className="divide-y divide-slate-100">{tasks.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <Cell className="font-mono text-xs text-blue-700">{t.taskNumber}</Cell>
              <Cell className="font-medium text-slate-950">{t.assetName || "—"}</Cell>
              <Cell><Pill tone="blue">{t.taskType}</Pill></Cell>
              <Cell><StatusPill status={t.status} /></Cell>
              <Cell className="text-slate-600 text-sm">{date(t.scheduledDate)}</Cell>
              <Cell className="text-slate-600 text-sm">{t.location || "—"}</Cell>
            </tr>
          ))}</tbody>
        </TableShell>
      ) : <EmptyState title="No maintenance tasks" description="Schedule maintenance for your assets." />}
    </div>
  );
}