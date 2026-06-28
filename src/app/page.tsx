import {
  Activity,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  GitBranch,
  MapPin,
  Package,
  Plus,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { DataTable } from "@/components/data-table";
import { FormDraftPanel } from "@/components/form-draft-panel";
import { getPlatformSnapshot } from "@/lib/platform";
import type { NotificationKind } from "@/lib/types";

const navigation = [
  "Home",
  "Company",
  "Branches",
  "People",
  "Items",
  "Imports",
  "Audit",
] as const;

const notificationStyles: Record<NotificationKind, string> = {
  system: "border-blue-200 bg-blue-50 text-blue-700",
  approval: "border-violet-200 bg-violet-50 text-violet-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  information: "border-sky-200 bg-sky-50 text-sky-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function Home() {
  const snapshot = getPlatformSnapshot();
  const { company, metrics } = snapshot;

  const metricCards = [
    { label: "People using system", value: metrics.activeUsers, icon: Users, help: "Active staff accounts" },
    { label: "Items ready", value: metrics.products, icon: Package, help: "Products and services" },
    { label: "Active branches", value: metrics.activeBranches, icon: GitBranch, help: "Locations under control" },
    { label: "Need attention", value: metrics.unreadNotifications, icon: Bell, help: "Pending alerts" },
  ];

  const growthActions = [
    ["Add your company", "Keep GSTIN, legal name, branches, and owners in one place."],
    ["Invite your team", "Give each person only the access they need."],
    ["Create item master", "Standardize products, HSN, GST, units, and services."],
    ["Import from Excel", "Move existing records without starting from zero."],
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-emerald-600 text-white">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-950">Velora ERP</p>
              <p className="text-xs text-slate-500">Simple business system for Indian MSMEs</p>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {navigation.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {item}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <section id="home" className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                Built for Pune, Nashik, Kolhapur and MIDC businesses
              </p>
              <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 md:text-5xl">
                Run the business clearly, from one clean place.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Velora keeps company data, branches, staff, item masters, approvals, and records organized so founders can spend less time chasing information and more time growing.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                <Plus size={16} /> Add first record
              </button>
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                <FileSpreadsheet size={16} /> Import Excel data
              </button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((card) => (
                <div key={card.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <card.icon className="text-emerald-700" size={18} />
                  <p className="mt-4 text-3xl font-semibold text-slate-950">{card.value}</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{card.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.help}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950">Today&apos;s focus</h2>
              <CheckCircle2 className="text-emerald-600" size={20} />
            </div>
            <div className="mt-4 space-y-3">
              {growthActions.map(([title, copy], index) => (
                <div key={title} className="flex gap-3 rounded-md border border-slate-200 bg-white p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">{index + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section id="company" className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <Building2 className="text-emerald-700" size={20} />
            <p className="mt-4 text-sm text-slate-500">Company</p>
            <p className="mt-1 font-semibold text-slate-950">{company.legalName}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <MapPin className="text-blue-700" size={20} />
            <p className="mt-4 text-sm text-slate-500">Region ready</p>
            <p className="mt-1 font-semibold text-slate-950">Maharashtra MSME operations</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <TrendingUp className="text-amber-700" size={20} />
            <p className="mt-4 text-sm text-slate-500">Company health</p>
            <p className="mt-1 font-semibold text-slate-950">{metrics.healthScore}% setup quality</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Alerts in simple words</h2>
            <p className="mt-1 text-sm text-slate-600">Only the things that need owner or manager attention.</p>
            <div className="mt-4 space-y-3">
              {snapshot.notifications.map((notification) => (
                <div key={notification.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full border px-2 py-1 text-xs capitalize ${notificationStyles[notification.kind]}`}>{notification.kind}</span>
                    <span className="text-xs text-slate-500">{notification.createdAt}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-950">{notification.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{notification.message}</p>
                </div>
              ))}
            </div>
          </div>

          <FormDraftPanel />
        </section>

        <div id="branches">
          <DataTable
            title="Branches"
            description="Keep every factory, office, depot, and sales location organized with manager ownership."
            rows={snapshot.branches}
            columns={[
              { key: "name", label: "Branch" },
              { key: "city", label: "City" },
              { key: "state", label: "State" },
              { key: "manager", label: "Manager" },
              { key: "users", label: "People" },
            ]}
          />
        </div>

        <div id="people">
          <DataTable
            title="People and access"
            description="Invite staff, managers, accountants, and auditors with simple role-based access."
            rows={snapshot.users}
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "roleId", label: "Role" },
              { key: "branchId", label: "Branch" },
              { key: "lastActive", label: "Last seen" },
            ]}
          />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Roles made easy</h2>
              <p className="mt-1 text-sm text-slate-600">Owners stay in control while staff see only what they need.</p>
            </div>
            <Shield className="text-emerald-700" size={20} />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {snapshot.roles.map((role) => (
              <div key={role.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-950">{role.name}</h3>
                  <span className="text-xs text-slate-500">{role.users} people</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{role.description}</p>
                <p className="mt-4 text-xs font-medium text-emerald-700">{role.permissions.length} permissions enabled</p>
              </div>
            ))}
          </div>
        </section>

        <div id="items">
          <DataTable
            title="Items and services"
            description="One clean item master for products, raw material, services, HSN, GST, and units."
            rows={snapshot.products}
            columns={[
              { key: "sku", label: "Code" },
              { key: "name", label: "Item" },
              { key: "category", label: "Category" },
              { key: "unit", label: "Unit" },
              { key: "hsn", label: "HSN" },
              { key: "taxRate", label: "GST %" },
            ]}
          />
        </div>

        <div id="imports">
          <DataTable
            title="Excel import and export"
            description="Bring old Excel records into Velora and download clean reports when needed."
            rows={snapshot.importExportJobs}
            columns={[
              { key: "module", label: "Area" },
              { key: "type", label: "Work" },
              { key: "format", label: "File" },
              { key: "rows", label: "Rows" },
              { key: "createdAt", label: "Done on" },
            ]}
          />
        </div>

        <section id="audit" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Activity history</h2>
              <p className="mt-1 text-sm text-slate-600">A simple record of who did what and when.</p>
            </div>
            <Activity className="text-emerald-700" size={20} />
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.auditLogs.map((log) => (
              <div key={log.id} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-[160px_1fr_160px]">
                <span className="font-mono text-xs text-slate-500">{log.createdAt}</span>
                <span className="text-slate-700"><strong className="text-slate-950">{log.actor}</strong> · {log.summary} · {log.module}</span>
                <span className="font-mono text-xs text-slate-500 md:text-right">{log.ipAddress}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-950">Ready to grow module by module</h2>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                Inventory, procurement, finance, CRM, HR, analytics, AI, and automation can be added later without confusing the first version.
              </p>
            </div>
            <ClipboardList className="text-emerald-700" size={28} />
          </div>
        </section>
      </div>
    </main>
  );
}
