import {
  Activity,
  Bell,
  Building2,
  CheckCircle2,
  Database,
  Factory,
  FileSpreadsheet,
  GitBranch,
  LayoutDashboard,
  Package,
  Plus,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { DataTable } from "@/components/data-table";
import { FormDraftPanel } from "@/components/form-draft-panel";
import { getPlatformSnapshot, coreModules } from "@/lib/platform";
import type { NotificationKind } from "@/lib/types";

const notificationStyles: Record<NotificationKind, string> = {
  system: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  approval: "border-violet-300/30 bg-violet-300/10 text-violet-100",
  warning: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  information: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  success: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  error: "border-rose-300/30 bg-rose-300/10 text-rose-100",
};

export default function Home() {
  const snapshot = getPlatformSnapshot();
  const { company, metrics } = snapshot;

  const metricCards = [
    { label: "Active Users", value: metrics.activeUsers, icon: Users, tone: "text-cyan-200" },
    { label: "Products", value: metrics.products, icon: Package, tone: "text-emerald-200" },
    { label: "Branches", value: metrics.activeBranches, icon: GitBranch, tone: "text-amber-200" },
    { label: "Notifications", value: metrics.unreadNotifications, icon: Bell, tone: "text-violet-200" },
  ];

  return (
    <main className="min-h-screen bg-[#090b0f] text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-black/20 p-5 lg:block">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-cyan-300 text-black">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Velora ERP</p>
              <p className="text-xs text-zinc-500">Core Platform v1.0.0</p>
            </div>
          </div>
          <nav className="mt-8 space-y-1">
            {coreModules.map((module, index) => (
              <a
                key={module}
                href={`#module-${index}`}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                {index === 0 ? <Building2 size={16} /> : index === 3 ? <Shield size={16} /> : index === 4 ? <Package size={16} /> : <LayoutDashboard size={16} />}
                {module}
              </a>
            ))}
          </nav>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#090b0f]/85 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">India Native · Modular · Offline Ready</p>
                <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">{company.name}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-200">
                  <FileSpreadsheet size={16} /> Import
                </button>
                <button className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-medium text-black">
                  <Plus size={16} /> New Record
                </button>
              </div>
            </div>
          </header>

          <div className="space-y-6 p-4 md:p-8">
            <section id="module-5" className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Executive Dashboard</h2>
                    <p className="mt-1 max-w-2xl text-sm text-zinc-400">A dynamic command surface for company health, operating activity, notifications, and platform readiness.</p>
                  </div>
                  <CheckCircle2 className="text-emerald-200" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {metricCards.map((card) => (
                    <div key={card.label} className="rounded-lg border border-white/10 bg-black/25 p-4">
                      <card.icon className={card.tone} size={18} />
                      <p className="mt-4 text-3xl font-semibold text-white">{card.value}</p>
                      <p className="mt-1 text-sm text-zinc-400">{card.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Company Health</span>
                      <span className="text-sm font-medium text-emerald-200">{metrics.healthScore}%</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-emerald-300" style={{ width: `${metrics.healthScore}%` }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Storage Usage</span>
                      <span className="text-sm font-medium text-cyan-200">{metrics.storagePercent}%</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-cyan-300" style={{ width: `${metrics.storagePercent}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div id="module-6" className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                <h2 className="text-lg font-semibold text-white">Notifications</h2>
                <div className="mt-4 space-y-3">
                  {snapshot.notifications.map((notification) => (
                    <div key={notification.id} className="rounded-md border border-white/10 bg-black/25 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`rounded-full border px-2 py-1 text-xs capitalize ${notificationStyles[notification.kind]}`}>{notification.kind}</span>
                        <span className="text-xs text-zinc-500">{notification.createdAt}</span>
                      </div>
                      <p className="mt-3 text-sm font-medium text-white">{notification.title}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-400">{notification.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="module-0" className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <Building2 className="text-cyan-200" size={20} />
                <p className="mt-4 text-sm text-zinc-400">Legal Entity</p>
                <p className="mt-1 font-medium text-white">{company.legalName}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <Factory className="text-emerald-200" size={20} />
                <p className="mt-4 text-sm text-zinc-400">Template</p>
                <p className="mt-1 font-medium text-white">{company.industryTemplate}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <Database className="text-amber-200" size={20} />
                <p className="mt-4 text-sm text-zinc-400">GSTIN</p>
                <p className="mt-1 font-medium text-white">{company.gstin}</p>
              </div>
            </section>

            <FormDraftPanel />

            <div id="module-1">
              <DataTable
                title="Branch Management"
                description="Search, filter, sort, paginate, export, and extend branch records without industry-specific assumptions."
                rows={snapshot.branches}
                columns={[
                  { key: "name", label: "Branch" },
                  { key: "city", label: "City" },
                  { key: "state", label: "State" },
                  { key: "manager", label: "Manager" },
                  { key: "users", label: "Users" },
                ]}
              />
            </div>

            <div id="module-2">
              <DataTable
                title="User Management"
                description="Core identity list ready for authentication, branch scoping, and role assignment."
                rows={snapshot.users}
                columns={[
                  { key: "name", label: "User" },
                  { key: "email", label: "Email" },
                  { key: "roleId", label: "Role" },
                  { key: "branchId", label: "Branch" },
                  { key: "lastActive", label: "Last Active" },
                ]}
              />
            </div>

            <section id="module-3" className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-base font-semibold text-white">Role Based Access Control</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {snapshot.roles.map((role) => (
                  <div key={role.id} className="rounded-md border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-white">{role.name}</h3>
                      <span className="text-xs text-zinc-500">{role.users} users</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{role.description}</p>
                    <p className="mt-4 text-xs text-cyan-200">{role.permissions.length} permissions enabled</p>
                  </div>
                ))}
              </div>
            </section>

            <div id="module-4">
              <DataTable
                title="Product / Item Master"
                description="Generic item master for future inventory, procurement, sales, finance, and analytics modules."
                rows={snapshot.products}
                columns={[
                  { key: "sku", label: "SKU" },
                  { key: "name", label: "Item" },
                  { key: "category", label: "Category" },
                  { key: "unit", label: "Unit" },
                  { key: "hsn", label: "HSN" },
                  { key: "taxRate", label: "GST %" },
                ]}
              />
            </div>

            <div id="module-7">
              <DataTable
                title="Excel / CSV Import & Export"
                description="Central operation registry for bulk data exchange with audit integration."
                rows={snapshot.importExportJobs}
                columns={[
                  { key: "module", label: "Module" },
                  { key: "type", label: "Type" },
                  { key: "format", label: "Format" },
                  { key: "rows", label: "Rows" },
                  { key: "createdAt", label: "Created" },
                ]}
              />
            </div>

            <section id="module-8" className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Audit Logs</h2>
                  <p className="mt-1 text-sm text-zinc-400">Every platform action feeds this immutable activity timeline.</p>
                </div>
                <Activity className="text-cyan-200" size={20} />
              </div>
              <div className="mt-4 space-y-3">
                {snapshot.auditLogs.map((log) => (
                  <div key={log.id} className="grid gap-2 rounded-md border border-white/10 bg-black/20 p-3 text-sm md:grid-cols-[160px_1fr_160px]">
                    <span className="font-mono text-xs text-zinc-500">{log.createdAt}</span>
                    <span className="text-zinc-200"><strong className="text-white">{log.actor}</strong> · {log.summary} · {log.module}</span>
                    <span className="font-mono text-xs text-zinc-500 md:text-right">{log.ipAddress}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
