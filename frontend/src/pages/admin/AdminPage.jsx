/**
 * AdminPage — Administration panel for role, permission, and user management.
 *
 * Features:
 * - Role CRUD
 * - Excel-style Permission Matrix grid
 * - User role assignment
 * - System health
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, ShieldCheck, Users, Plus, Save, Trash2, X, Copy, Search,
  RefreshCw, Activity, UserCog, Check, Eye, EyeOff,
} from "lucide-react";
import { apiRequest } from "../../services/api";
import { PageHeader, SecondaryButton } from "../../components/PageHeader";
import { Card, SectionHeader } from "../inventory/components/shared";
import { SkeletonTable } from "../../components/Skeleton";
import { ErrorState, ErrorBanner } from "../../components/ErrorState";
import { usePermissionStore } from "../../hooks/usePermissions";

// ─── API helpers ────────────────────────────────────────────────────────────

const adminApi = {
  roles: () => apiRequest("/admin/roles"),
  createRole: (data) => apiRequest("/admin/roles", { method: "POST", body: JSON.stringify(data) }),
  updateRole: (id, data) => apiRequest(`/admin/roles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRole: (id) => apiRequest(`/admin/roles/${id}`, { method: "DELETE" }),
  permissions: () => apiRequest("/admin/permissions"),
  users: () => apiRequest("/admin/users"),
  assignRole: (userId, roleId) => apiRequest(`/admin/users/${userId}/roles`, { method: "POST", body: JSON.stringify({ roleId }) }),
  removeRole: (userId, roleId) => apiRequest(`/admin/users/${userId}/roles/${roleId}`, { method: "DELETE" }),
  health: () => apiRequest("/admin/health"),
};

// ─── Permission module grouping ─────────────────────────────────────────────

const MODULE_GROUPS = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "sales", label: "Sales", icon: "💰" },
  { key: "purchase", label: "Procurement", icon: "📦" },
  { key: "inventory", label: "Inventory", icon: "🏭" },
  { key: "manufacturing", label: "Manufacturing", icon: "⚙️" },
  { key: "accounts", label: "Finance", icon: "🏦" },
  { key: "crm", label: "CRM", icon: "👥" },
  { key: "hr", label: "HR", icon: "👤" },
  { key: "reports", label: "Reports", icon: "📈" },
  { key: "audit", label: "Audit", icon: "📋" },
  { key: "settings", label: "Settings", icon: "⚙️" },
  { key: "admin", label: "Administration", icon: "🛡️" },
  { key: "users", label: "User Management", icon: "👥" },
  { key: "branches", label: "Branches", icon: "🏢" },
  { key: "company", label: "Company", icon: "🏛️" },
  { key: "supplierPortal", label: "Supplier Portal", icon: "🤝" },
  { key: "eam", label: "Asset Management", icon: "🔧" },
];

const ACTION_LABELS = {
  view: "View", create: "Create", edit: "Edit", delete: "Delete",
  approve: "Approve", payment: "Payment", export: "Export", print: "Print",
  adjust: "Adjust", transfer: "Transfer", receive: "Receive", dispatch: "Dispatch",
  journal: "Journal", report: "Reports", receipt: "Receipts",
  bom: "BOM", quality: "Quality", workOrder: "Work Orders",
  payroll: "Payroll", attendance: "Attendance", leaveapprove: "Leave Approve",
  convertLead: "Convert Lead", assignLead: "Assign Lead",
  manageRoles: "Manage Roles", manageUsers: "Manage Users",
  managePermissions: "Manage Permissions", manageBranches: "Manage Branches",
  manageCompanies: "Manage Companies", systemConfig: "System Config",
  resetPassword: "Reset Password", assignRoles: "Assign Roles",
  maintenance: "Maintenance",
};

// ─── Admin Page ────────────────────────────────────────────────────────────

export function AdminPage() {
  const [tab, setTab] = useState("roles");

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader
        title="Administration"
        description="Manage roles, permissions, users, and system settings"
      />

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {[
          ["roles", Shield, "Role & Permission Management"],
          ["users", Users, "User Management"],
          ["health", Activity, "System Health"],
        ].map(([key, Icon, hint]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all
              ${tab === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <Icon size={16} />
            {key === "roles" ? "Roles & Permissions" : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {tab === "roles" && <RoleManagement />}
      {tab === "users" && <UserManagement />}
      {tab === "health" && <SystemHealth />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROLE MANAGEMENT + PERMISSION MATRIX
// ═══════════════════════════════════════════════════════════════════════════════

function RoleManagement() {
  const qc = useQueryClient();

  const rolesQuery = useQuery({ queryKey: ["admin-roles"], queryFn: adminApi.roles });
  const permsQuery = useQuery({ queryKey: ["admin-permissions"], queryFn: adminApi.permissions });

  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [editName, setEditName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const roles = rolesQuery.data?.data || [];
  const allKeys = permsQuery.data?.data?.allKeys || [];
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const rolePermissionKeys = selectedRole?.rolePermissions?.map((rp) => rp.permission?.key) || [];

  // Group permissions by module
  const permissionsByModule = useMemo(() => {
    const grouped = {};
    for (const perm of allKeys) {
      const mod = perm.module || perm.key.split(":")[0];
      if (!grouped[mod]) grouped[mod] = [];
      grouped[mod].push(perm);
    }
    return grouped;
  }, [allKeys]);

  // Filtered permissions by search
  const filteredModules = useMemo(() => {
    if (!searchTerm) return MODULE_GROUPS;
    const term = searchTerm.toLowerCase();
    return MODULE_GROUPS.filter((m) => {
      const perms = permissionsByModule[m.key] || [];
      return m.label.toLowerCase().includes(term) ||
        perms.some((p) => p.key?.toLowerCase().includes(term) || p.action?.toLowerCase().includes(term));
    });
  }, [searchTerm, permissionsByModule]);

  // Create role mutation
  const createRole = useMutation({
    mutationFn: (name) => adminApi.createRole({ name, permissionKeys: getDefaultPermissions(name) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-roles"] }); setShowCreate(false); setNewRoleName(""); },
  });

  // Update role permissions
  const updateRolePerms = useMutation({
    mutationFn: ({ id, permissionKeys }) => adminApi.updateRole(id, { permissionKeys }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-roles"] }),
  });

  // Delete role
  const deleteRoleMut = useMutation({
    mutationFn: (id) => adminApi.deleteRole(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-roles"] }); setSelectedRoleId(null); },
  });

  // Toggle a single permission for the selected role
  const togglePermission = useCallback((permKey) => {
    if (!selectedRoleId) return;
    const current = rolePermissionKeys;
    const updated = current.includes(permKey)
      ? current.filter((k) => k !== permKey)
      : [...current, permKey];
    updateRolePerms.mutate({ id: selectedRoleId, permissionKeys: updated });
  }, [selectedRoleId, rolePermissionKeys, updateRolePerms]);

  // Toggle all permissions in a module
  const toggleModule = useCallback((moduleKey, enable) => {
    if (!selectedRoleId) return;
    const modulePerms = permissionsByModule[moduleKey] || [];
    const moduleKeys = modulePerms.map((p) => p.key);
    const current = rolePermissionKeys;
    const updated = enable
      ? [...new Set([...current, ...moduleKeys])]
      : current.filter((k) => !moduleKeys.includes(k));
    updateRolePerms.mutate({ id: selectedRoleId, permissionKeys: updated });
  }, [selectedRoleId, rolePermissionKeys, permissionsByModule, updateRolePerms]);

  if (rolesQuery.isError) return <ErrorState error={rolesQuery.error} onRetry={() => qc.invalidateQueries({ queryKey: ["admin-roles"] })} />;

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
      {/* Role list sidebar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Roles</h3>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={13} /> New
          </button>
        </div>

        {showCreate && (
          <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 p-2">
            <input
              type="text"
              placeholder="Role name..."
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newRoleName.trim() && createRole.mutate(newRoleName.trim())}
              className="h-8 flex-1 rounded border border-blue-200 bg-white px-2 text-xs outline-none"
            />
            <button onClick={() => { setShowCreate(false); setNewRoleName(""); }} className="p-1 text-blue-400 hover:text-blue-600"><X size={14} /></button>
          </div>
        )}

        {rolesQuery.isPending ? (
          <SkeletonTable rows={6} cols={1} />
        ) : (
          <div className="space-y-0.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => { setSelectedRoleId(role.id); setEditName(role.name); }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors
                  ${selectedRoleId === role.id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"}`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={15} className={role.name === "OWNER" ? "text-amber-500" : "text-blue-500"} />
                  <span>{role.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400">{role._count?.userRoles || 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Permission Matrix */}
      <div className="min-w-0">
        {selectedRole ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="text-blue-600" />
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {selectedRole.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </h3>
                  <p className="text-xs text-slate-500">{rolePermissionKeys.length} permissions assigned</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleModule(Object.keys(permissionsByModule), true)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Select All
                </button>
                <button
                  onClick={() => toggleModule(Object.keys(permissionsByModule), false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search permissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400"
              />
            </div>

            {/* Permission matrix grid */}
            <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <ErrorBanner error={updateRolePerms.error} />

              {filteredModules.map((mod) => {
                const modulePerms = permissionsByModule[mod.key] || [];
                if (modulePerms.length === 0) return null;
                const allEnabled = modulePerms.every((p) => rolePermissionKeys.includes(p.key));
                const someEnabled = modulePerms.some((p) => rolePermissionKeys.includes(p.key));

                return (
                  <div key={mod.key} className="rounded-lg border border-slate-100 bg-slate-50/50">
                    {/* Module header */}
                    <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={allEnabled}
                        ref={(el) => { if (el) el.indeterminate = someEnabled && !allEnabled; }}
                        onChange={() => toggleModule(mod.key, !allEnabled)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <span className="text-sm font-semibold text-slate-700">{mod.icon} {mod.label}</span>
                      <span className="text-[10px] font-medium text-slate-400">{modulePerms.length} permissions</span>
                    </div>

                    {/* Permission checkboxes */}
                    <div className="flex flex-wrap gap-1 px-3 py-2">
                      {modulePerms.map((perm) => {
                        const action = perm.key?.split(":")[1] || perm.action;
                        const label = ACTION_LABELS[action] || action?.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
                        const enabled = rolePermissionKeys.includes(perm.key);

                        return (
                          <label
                            key={perm.key}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all
                              ${enabled
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={() => togglePermission(perm.key)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredModules.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">No permissions match your search.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
            <div className="text-center">
              <Shield size={40} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">Select a role to manage permissions</p>
              <p className="mt-1 text-xs text-slate-400">Choose a role from the left panel</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Default permissions for new roles ───────────────────────────────────────

function getDefaultPermissions(name) {
  const upper = name.toUpperCase().replace(/\s+/g, "_");
  const common = ["dashboard:view"];
  if (upper.includes("ADMIN")) return [...common, ...MODULE_GROUPS.filter((m) => m.key !== "admin").map((m) => `${m.key}:view`)];
  if (upper.includes("MANAGER") || upper.includes("HEAD")) return [...common, "sales:view", "purchase:view", "inventory:view", "accounts:view", "reports:view"];
  return common;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

function UserManagement() {
  const qc = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: adminApi.users });
  const rolesQuery = useQuery({ queryKey: ["admin-roles"], queryFn: adminApi.roles });
  const [assigning, setAssigning] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const users = usersQuery.data?.data || [];
  const roles = rolesQuery.data?.data || [];

  const assignRole = useMutation({
    mutationFn: ({ userId, roleId }) => adminApi.assignRole(userId, roleId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setAssigning(null); setSelectedRoleId(""); },
  });

  if (usersQuery.isError) return <ErrorState error={usersQuery.error} onRetry={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />;

  return (
    <Card>
      <SectionHeader title="User Management" icon={Users} description="Assign roles to users" />
      {usersQuery.isPending ? (
        <SkeletonTable rows={8} cols={4} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Current Roles</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.userRoles?.filter((ur) => !ur.isDeleted).map((ur) => (
                        <span key={ur.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {ur.role.name.replace(/_/g, " ")}
                          <button
                            onClick={() => adminApi.removeRole(user.id, ur.id).then(() => qc.invalidateQueries({ queryKey: ["admin-users"] }))}
                            className="ml-0.5 text-blue-400 hover:text-rose-600"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                      {(!user.userRoles || user.userRoles.filter((ur) => !ur.isDeleted).length === 0) && (
                        <span className="text-xs text-slate-400">No role</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {assigning === user.id ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={selectedRoleId}
                          onChange={(e) => setSelectedRoleId(e.target.value)}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        >
                          <option value="">Select role...</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => selectedRoleId && assignRole.mutate({ userId: user.id, roleId: selectedRoleId })}
                          className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <Check size={13} />
                        </button>
                        <button onClick={() => setAssigning(null)} className="p-1 text-slate-400 hover:text-slate-600">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAssigning(user.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        <UserCog size={13} /> Assign Role
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SYSTEM HEALTH
// ═══════════════════════════════════════════════════════════════════════════════

function SystemHealth() {
  const healthQuery = useQuery({ queryKey: ["admin-health"], queryFn: adminApi.health, refetchInterval: 30000 });

  if (healthQuery.isPending) return <SkeletonTable rows={4} cols={2} />;
  if (healthQuery.isError) return <ErrorState error={healthQuery.error} onRetry={healthQuery.refetch} />;

  const health = healthQuery.data?.data;

  if (!health) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No health data available</div>;

  const metrics = [
    { label: "System Status", value: health.status === "healthy" ? "✅ Healthy" : "❌ Unhealthy", color: health.status === "healthy" ? "text-emerald-600" : "text-rose-600" },
    { label: "Database Latency", value: health.dbLatency },
    { label: "Node Version", value: health.nodeVersion },
    { label: "Environment", value: health.environment },
    { label: "Uptime", value: `${Math.floor(health.uptime / 60)}m ${Math.floor(health.uptime % 60)}s` },
    { label: "Total Users", value: health.counts?.users || "—" },
    { label: "Total Roles", value: health.counts?.roles || "—" },
    { label: "Total Documents", value: health.counts?.documents || "—" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{m.label}</p>
          <p className={`mt-2 text-lg font-bold tabular-nums ${m.color || "text-slate-900"}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}
