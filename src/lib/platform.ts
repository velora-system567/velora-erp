import {
  auditLogs,
  branches,
  companies,
  importExportJobs,
  notifications,
  products,
  roles,
  users,
} from "./seed-data";

export const coreModules = [
  "Company Management",
  "Branch Management",
  "User Management",
  "RBAC",
  "Product / Item Master",
  "Dashboard",
  "Notifications",
  "Excel / CSV Import & Export",
  "Audit Logs",
] as const;

export function getPlatformSnapshot() {
  const [company] = companies;
  const activeUsers = users.filter((user) => user.status === "active").length;
  const activeBranches = branches.filter((branch) => branch.status === "active").length;
  const unreadNotifications = notifications.filter((notification) => notification.unread).length;
  const storagePercent = company ? Math.round((company.storageUsedGb / company.storageLimitGb) * 100) : 0;
  const healthScore = company ? company.healthScore : 0;

  return {
    company,
    branches,
    roles,
    users,
    products,
    notifications,
    auditLogs,
    importExportJobs,
    metrics: {
      activeUsers,
      products: products.length,
      activeBranches,
      unreadNotifications,
      storagePercent,
      healthScore,
    },
  };
}
