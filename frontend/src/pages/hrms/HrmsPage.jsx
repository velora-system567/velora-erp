import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Building2, RefreshCw, BarChart3, UserCheck } from "lucide-react";
import { hrmsApi } from "../../services/api";
import { ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { Card, Cell, Head, KpiTile, Pill, SectionHeader, TableShell, number, date } from "../inventory/components/shared";

const TABS = [
  ["dashboard", BarChart3, "HR Dashboard"],
  ["employees", Users, "Employees"],
  ["departments", Building2, "Departments"],
];

export function HrmsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(localStorage.getItem("hrms_tab") || "dashboard");
  const switchTab = (t) => { setTab(t); localStorage.setItem("hrms_tab", t); };

  const dashQuery = useQuery({
    queryKey: ["hrms-dashboard"],
    queryFn: hrmsApi.dashboard,
    staleTime: 60 * 1000,
    enabled: tab === "dashboard",
  });

  const empQuery = useQuery({
    queryKey: ["hrms-employees"],
    queryFn: () => hrmsApi.employees({}),
    staleTime: 30 * 1000,
    enabled: tab === "employees",
  });

  const rolesQuery = useQuery({
    queryKey: ["hrms-roles"],
    queryFn: hrmsApi.roles,
    staleTime: 60 * 1000,
    enabled: tab === "departments",
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader title="HR & Payroll" description="Manage employees, departments, roles, and people operations."
        actions={<SecondaryButton label="Refresh" icon={RefreshCw} onClick={() => qc.invalidateQueries({ queryKey: ["hrms"] })} />} />

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map(([key, Icon, label]) => (
          <button key={key} onClick={() => switchTab(key)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${tab === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab data={dashQuery} />}
      {tab === "employees" && <EmployeesTab query={empQuery} />}
      {tab === "departments" && <DepartmentsTab query={rolesQuery} />}
    </div>
  );
}

function DashboardTab({ data: query }) {
  const qc = useQueryClient();
  if (query.isPending) return <div className="space-y-4"><SkeletonCards count={4} /><SkeletonTable rows={5} cols={4} /></div>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["hrms-dashboard"] })} />;
  const d = query.data?.data;
  if (!d) return <EmptyState title="No HR data" />;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Total Employees" value={d.kpis.totalEmployees} tone="blue" icon={Users} />
        <KpiTile label="Active" value={d.kpis.activeUsers} tone="emerald" icon={UserCheck} />
        <KpiTile label="Departments" value={d.kpis.departments} tone="purple" icon={Building2} />
        <KpiTile label="Inactive" value={d.kpis.inactiveUsers} tone="rose" icon={Users} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Departments" description="Employee distribution" icon={Building2} />
          {d.departments?.length ? d.departments.map((dept) => (
            <div key={dept.name} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <p className="font-medium text-slate-950">{dept.name}</p>
              <Pill tone="blue">{dept.count} employee{dept.count === 1 ? "" : "s"}</Pill>
            </div>
          )) : <EmptyState title="No departments" />}
        </Card>

        <Card>
          <SectionHeader title="Recent Hires" description="Newest team members" icon={Users} />
          {d.recentEmployees?.length ? d.recentEmployees.slice(0, 8).map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div><p className="font-medium text-slate-950">{e.name}</p><p className="text-xs text-slate-500">{e.role}</p></div>
              <div className="text-right"><Pill tone={e.isActive ? "emerald" : "slate"}>{e.isActive ? "Active" : "Inactive"}</Pill><p className="text-xs text-slate-500 mt-0.5">{date(e.joinedAt)}</p></div>
            </div>
          )) : <EmptyState title="No employees" />}
        </Card>
      </section>
    </div>
  );
}

function EmployeesTab({ query }) {
  const qc = useQueryClient();
  if (query.isPending) return <SkeletonTable rows={10} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} />;
  const employees = query.data?.data || [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{meta ? `${meta.total} employees` : `${employees.length} employees`}</p>
      {employees.length ? (
        <TableShell>
          <Head><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Joined</th></Head>
          <tbody className="divide-y divide-slate-100">
            {employees.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <Cell className="font-medium text-slate-950">{e.name}</Cell>
                <Cell className="text-slate-600">{e.email}</Cell>
                <Cell className="text-slate-600">{e.phone}</Cell>
                <Cell><Pill tone="blue">{e.role}</Pill></Cell>
                <Cell><Pill tone={e.isActive ? "emerald" : "slate"}>{e.isActive ? "Active" : "Inactive"}</Pill></Cell>
                <Cell className="text-slate-600 text-sm">{date(e.joinedAt)}</Cell>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : <EmptyState title="No employees" description="Add users to see them here." />}
    </div>
  );
}

function DepartmentsTab({ query }) {
  const qc = useQueryClient();
  if (query.isPending) return <SkeletonTable rows={5} cols={3} />;
  if (query.isError) return <ErrorState error={query.error} />;
  const roles = query.data?.data || [];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {roles.length ? roles.map((r) => (
        <Card key={r.id}>
          <div className="flex items-center justify-between">
            <div><p className="font-semibold text-slate-950">{r.name}</p><p className="text-xs text-slate-500">{r.description || "—"}</p></div>
            <Pill tone="blue">{r.employeeCount} member{r.employeeCount === 1 ? "" : "s"}</Pill>
          </div>
        </Card>
      )) : <div className="col-span-full"><EmptyState title="No departments" description="Create roles to organize your team." /></div>}
    </div>
  );
}
