import {
  Activity,
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  GitBranch,
  Home as HomeIcon,
  Package,
  Plus,
  Search,
  Shield,
  Upload,
  Users,
} from "lucide-react";
import { DataTable } from "@/components/data-table";
import { FormDraftPanel } from "@/components/form-draft-panel";
import { getPlatformSnapshot } from "@/lib/platform";

const navigation = [
  { label: "Dashboard", href: "#dashboard", icon: HomeIcon },
  { label: "Company", href: "#company", icon: Building2 },
  { label: "Branches", href: "#branches", icon: GitBranch },
  { label: "Employees", href: "#employees", icon: Users },
  { label: "Products", href: "#products", icon: Package },
  { label: "Imports", href: "#imports", icon: Upload },
  { label: "Activity", href: "#activity", icon: Activity },
] as const;

export default function Home() {
  const snapshot = getPlatformSnapshot();
  const { company, metrics } = snapshot;

  const overviewCards = [
    { label: "Employees", value: "50-100", detail: `${metrics.activeUsers} active users set up`, icon: Users },
    { label: "Products", value: metrics.products, detail: "Items and services ready", icon: Package },
    { label: "Branches", value: metrics.activeBranches, detail: "Operating locations active", icon: GitBranch },
    { label: "Notifications", value: metrics.unreadNotifications, detail: "Need owner attention", icon: Bell },
  ];

  const pendingTasks = [
    "Approve Bengaluru branch activation",
    "Review product import results",
    "Invite accountant and store manager",
    "Complete company GST and address details",
  ];

  const quickActions = [
    { label: "Add employee", icon: Users },
    { label: "Add product", icon: Package },
    { label: "Import Excel", icon: FileSpreadsheet },
    { label: "Create branch", icon: GitBranch },
  ];

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-900">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[272px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
                <Building2 size={20} />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-950">Velora ERP</p>
                <p className="text-xs text-slate-500">Core Platform</p>
              </div>
            </div>

            <nav className="mt-8 space-y-1">
              {navigation.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                >
                  <item.icon size={18} />
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">Built for MSMEs</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">For owners managing 2-50 Cr turnover, teams, branches, and daily operations.</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center justify-between gap-3">
                <div className="lg:hidden">
                  <p className="text-base font-semibold text-slate-950">Velora ERP</p>
                  <p className="text-xs text-slate-500">Simple business system</p>
                </div>
                <div className="hidden lg:block">
                  <p className="text-sm text-slate-500">Today</p>
                  <h1 className="text-2xl font-semibold text-slate-950">Business Overview</h1>
                </div>
                <button className="grid size-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden" aria-label="Search">
                  <Search size={18} />
                </button>
              </div>

              <nav className="flex gap-1 overflow-x-auto lg:hidden">
                {navigation.slice(0, 5).map((item) => (
                  <a key={item.label} href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                    {item.label}
                  </a>
                ))}
              </nav>

              <div className="hidden items-center gap-2 xl:flex">
                <button className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                  <FileSpreadsheet size={17} /> Import Excel
                </button>
                <button className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                  <Plus size={17} /> New Record
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 xl:p-8">
            <section id="dashboard" className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700">Business operating system for Indian MSMEs</p>
                      <h2 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 md:text-4xl">
                        Know what is happening, what is pending, and what needs action.
                      </h2>
                      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                        Velora keeps company, employees, branches, products, imports, alerts, and activity history in one simple place for owners and managers.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:w-56">
                      <p className="text-sm text-slate-500">Company health</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-950">{metrics.healthScore}%</p>
                      <div className="mt-3 h-2 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${metrics.healthScore}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {overviewCards.map((card) => (
                      <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <card.icon className="text-blue-600" size={20} />
                          <CheckCircle2 className="text-slate-300" size={18} />
                        </div>
                        <p className="mt-5 text-3xl font-semibold text-slate-950">{card.value}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{card.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{card.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <section className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-slate-950">Pending Work</h2>
                      <ClipboardCheck className="text-blue-600" size={20} />
                    </div>
                    <div className="mt-4 space-y-3">
                      {pendingTasks.map((task, index) => (
                        <div key={task} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">{index + 1}</span>
                          <p className="text-sm font-medium text-slate-800">{task}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-slate-950">Quick Actions</h2>
                      <Plus className="text-blue-600" size={20} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {quickActions.map((action) => (
                        <button key={action.label} className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                          <action.icon size={18} />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-950">Alerts</h2>
                    <AlertCircle className="text-blue-600" size={20} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {snapshot.notifications.slice(0, 4).map((notification) => (
                      <div key={notification.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-950">{notification.title}</p>
                          <span className="text-xs text-slate-500">{notification.createdAt}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{notification.message}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-950">Recent Activity</h2>
                    <Activity className="text-blue-600" size={20} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {snapshot.auditLogs.slice(0, 4).map((log) => (
                      <div key={log.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                        <p className="text-sm font-medium text-slate-900">{log.summary}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{log.actor} · {log.createdAt}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </section>

            <section id="company" className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Company Overview</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">The basic business profile every module depends on.</p>
                  </div>
                  <Building2 className="text-blue-600" size={22} />
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <InfoCard label="Company" value={company.legalName} />
                  <InfoCard label="GSTIN" value={company.gstin} />
                  <InfoCard label="Storage used" value={`${metrics.storagePercent}%`} />
                </div>
              </div>
              <FormDraftPanel />
            </section>

            <div id="branches">
              <DataTable
                title="Branches"
                description="Factories, offices, depots, and sales locations with clear manager ownership."
                rows={snapshot.branches}
                columns={[
                  { key: "name", label: "Branch" },
                  { key: "city", label: "City" },
                  { key: "state", label: "State" },
                  { key: "manager", label: "Manager" },
                  { key: "users", label: "Employees" },
                ]}
              />
            </div>

            <div id="employees">
              <DataTable
                title="Employees"
                description="Owners, managers, accountants, auditors, and staff with simple role-based access."
                rows={snapshot.users}
                columns={[
                  { key: "name", label: "Name" },
                  { key: "email", label: "Email" },
                  { key: "roleId", label: "Role" },
                  { key: "branchId", label: "Branch" },
                  { key: "lastActive", label: "Last active" },
                ]}
              />
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Access Control</h2>
                  <p className="mt-1 text-sm text-slate-600">Keep business data protected without making permissions hard to understand.</p>
                </div>
                <Shield className="text-blue-600" size={22} />
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                {snapshot.roles.map((role) => (
                  <div key={role.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-950">{role.name}</h3>
                      <span className="text-xs text-slate-500">{role.users} people</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{role.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <div id="products">
              <DataTable
                title="Products"
                description="One item master for products, raw material, services, HSN, GST, and units."
                rows={snapshot.products}
                columns={[
                  { key: "sku", label: "Code" },
                  { key: "name", label: "Product / Service" },
                  { key: "category", label: "Category" },
                  { key: "unit", label: "Unit" },
                  { key: "hsn", label: "HSN" },
                  { key: "taxRate", label: "GST %" },
                ]}
              />
            </div>

            <div id="imports">
              <DataTable
                title="Excel Import and Export"
                description="Move existing Excel records into Velora and download clean reports when needed."
                rows={snapshot.importExportJobs}
                columns={[
                  { key: "module", label: "Area" },
                  { key: "type", label: "Work" },
                  { key: "format", label: "File" },
                  { key: "rows", label: "Rows" },
                  { key: "createdAt", label: "Time" },
                ]}
              />
            </div>

            <section id="activity" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Activity History</h2>
                  <p className="mt-1 text-sm text-slate-600">A simple record of who did what and when.</p>
                </div>
                <Activity className="text-blue-600" size={22} />
              </div>
              <div className="mt-5 space-y-3">
                {snapshot.auditLogs.map((log) => (
                  <div key={log.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-[160px_1fr_160px]">
                    <span className="font-mono text-xs text-slate-500">{log.createdAt}</span>
                    <span className="text-slate-700"><strong className="text-slate-950">{log.actor}</strong> · {log.summary} · {log.module}</span>
                    <span className="font-mono text-xs text-slate-500 md:text-right">{log.ipAddress}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold leading-6 text-slate-950">{value}</p>
    </div>
  );
}
