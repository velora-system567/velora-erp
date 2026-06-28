import {
  Activity,
  AlertCircle,
  Building2,
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
  const companyName = company?.name ?? "Your Company";

  const overviewCards = [
    { label: "Company", value: company ? "Created" : "Not set", detail: company ? "Business profile is ready" : "Create your company profile first", icon: Building2 },
    { label: "Employees", value: metrics.activeUsers, detail: "Users added by the owner", icon: Users },
    { label: "Products", value: metrics.products, detail: "Items and services created", icon: Package },
    { label: "Branches", value: metrics.activeBranches, detail: "Locations created", icon: GitBranch },
  ];

  const setupSteps = [
    { title: "Create Company", description: "Add legal name, GSTIN, address, and basic business details.", action: "Create Company" },
    { title: "Create Branch", description: "Add factory, office, warehouse, depot, or shop locations.", action: "Create Branch" },
    { title: "Add Employees", description: "Invite owners, managers, accountants, auditors, and staff.", action: "Add Employee" },
    { title: "Add Products", description: "Create item master with HSN, GST, units, and categories.", action: "Add Product" },
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
                <p className="text-base font-semibold text-slate-950">{companyName}</p>
                <p className="text-xs text-slate-500">Velora ERP</p>
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
              <p className="text-sm font-semibold text-slate-950">Fresh Installation</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Enter your own business data to start using the ERP.</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center justify-between gap-3">
                <div className="lg:hidden">
                  <p className="text-base font-semibold text-slate-950">{companyName}</p>
                  <p className="text-xs text-slate-500">Velora ERP</p>
                </div>
                <div className="hidden lg:block">
                  <p className="text-sm text-slate-500">Dashboard</p>
                  <h1 className="text-2xl font-semibold text-slate-950">{companyName}</h1>
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
                      <p className="text-sm font-medium text-blue-700">Fresh ERP setup</p>
                      <h2 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 md:text-4xl">
                        Start by creating your company profile.
                      </h2>
                      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                        This ERP is empty by design. Add your own company, branches, employees, products, and settings to build the system around your business.
                      </p>
                    </div>
                    <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                      <Building2 size={17} /> Create Company
                    </button>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {overviewCards.map((card) => (
                      <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <card.icon className="text-blue-600" size={20} />
                        <p className="mt-5 text-3xl font-semibold text-slate-950">{card.value}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{card.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{card.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">Setup Checklist</h2>
                      <p className="mt-1 text-sm text-slate-600">Complete these steps to make the ERP ready for daily use.</p>
                    </div>
                    <ClipboardCheck className="text-blue-600" size={20} />
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {setupSteps.map((step, index) => (
                      <div key={step.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">{index + 1}</span>
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{step.title}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                            <button className="mt-3 text-sm font-semibold text-blue-700">{step.action}</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <EmptyPanel
                  icon={AlertCircle}
                  title="No Notifications"
                  description="System notifications will appear here after records, approvals, imports, or other actions are created."
                  action="View Settings"
                />
                <EmptyPanel
                  icon={Activity}
                  title="No Recent Activity"
                  description="Audit logs will appear after users create, update, import, export, or approve records."
                  action="Open Audit Logs"
                />
              </aside>
            </section>

            <section id="company" className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Company Overview</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">Create the customer&apos;s legal entity before adding branches, employees, and products.</p>
                  </div>
                  <Building2 className="text-blue-600" size={22} />
                </div>
                {company ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <InfoCard label="Company" value={company.legalName} />
                    <InfoCard label="GSTIN" value={company.gstin} />
                    <InfoCard label="Storage used" value={`${metrics.storagePercent}%`} />
                  </div>
                ) : (
                  <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="text-base font-semibold text-slate-950">No Company Created</p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Add the business legal name, GSTIN, address, and primary contact to begin using Velora ERP.</p>
                    <button className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                      Create Company
                    </button>
                  </div>
                )}
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
                emptyTitle="No Branches Created"
                emptyDescription="Create the first factory, office, warehouse, depot, or shop location for this business."
                emptyActionLabel="Create Branch"
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
                emptyTitle="No Employees Added"
                emptyDescription="Invite the owner, managers, accountants, auditors, and staff who will use the ERP."
                emptyActionLabel="Add Employee"
              />
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Access Control</h2>
                  <p className="mt-1 text-sm text-slate-600">Roles and permissions will be configured by the business owner.</p>
                </div>
                <Shield className="text-blue-600" size={22} />
              </div>
              {snapshot.roles.length === 0 ? (
                <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-base font-semibold text-slate-950">No Roles Configured</p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Create roles such as Owner, Manager, Accountant, Auditor, or Staff based on this business&apos;s needs.</p>
                  <button className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                    Create Role
                  </button>
                </div>
              ) : null}
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
                emptyTitle="No Products Found"
                emptyDescription="Add products, raw materials, services, HSN codes, GST rates, and units as per this business."
                emptyActionLabel="Add Product"
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
                emptyTitle="No Imports or Exports"
                emptyDescription="Import company data from Excel or CSV after selecting the module and mapping columns."
                emptyActionLabel="Import Excel"
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
              {snapshot.auditLogs.length === 0 ? (
                <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-base font-semibold text-slate-950">No Activity Yet</p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Audit history will begin after users create, update, import, export, approve, login, or logout.</p>
                </div>
              ) : null}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof AlertCircle;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <Icon className="text-blue-600" size={20} />
      </div>
      <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="text-sm leading-6 text-slate-600">{description}</p>
        <button className="mt-4 text-sm font-semibold text-blue-700">{action}</button>
      </div>
    </section>
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
