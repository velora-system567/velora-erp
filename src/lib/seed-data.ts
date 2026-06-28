import type {
  AuditLog,
  Branch,
  Company,
  ImportExportJob,
  Notification,
  Product,
  Role,
  User,
} from "./types";

export const companies: Company[] = [
  {
    id: "co_velora_demo",
    name: "Velora Industries",
    legalName: "Velora Industries Private Limited",
    gstin: "27AABCV2407R1Z3",
    industryTemplate: "Core Platform",
    status: "active",
    healthScore: 92,
    storageUsedGb: 14.2,
    storageLimitGb: 50,
    createdAt: "2026-06-28",
  },
];

export const branches: Branch[] = [
  { id: "br_mum", companyId: "co_velora_demo", name: "Mumbai HQ", city: "Mumbai", state: "Maharashtra", manager: "Aarav Mehta", users: 18, status: "active" },
  { id: "br_del", companyId: "co_velora_demo", name: "Delhi Sales", city: "New Delhi", state: "Delhi", manager: "Isha Kapoor", users: 9, status: "active" },
  { id: "br_blr", companyId: "co_velora_demo", name: "Bengaluru Ops", city: "Bengaluru", state: "Karnataka", manager: "Dev Rao", users: 12, status: "draft" },
];

export const roles: Role[] = [
  {
    id: "role_owner",
    name: "Owner",
    description: "Full platform access with release and billing authority.",
    users: 2,
    permissions: ["company:read", "company:write", "branch:read", "branch:write", "user:read", "user:write", "product:read", "product:write", "import:run", "export:run", "audit:read", "notification:manage"],
  },
  {
    id: "role_ops",
    name: "Operations Manager",
    description: "Runs branch, user, product, and import operations.",
    users: 8,
    permissions: ["branch:read", "branch:write", "user:read", "product:read", "product:write", "import:run", "export:run"],
  },
  {
    id: "role_auditor",
    name: "Auditor",
    description: "Read-only oversight across masters, exports, and audit logs.",
    users: 3,
    permissions: ["company:read", "branch:read", "user:read", "product:read", "export:run", "audit:read"],
  },
];

export const users: User[] = [
  { id: "usr_aarav", name: "Aarav Mehta", email: "aarav@velora.example", roleId: "role_owner", branchId: "br_mum", status: "active", lastActive: "Today, 10:24" },
  { id: "usr_isha", name: "Isha Kapoor", email: "isha@velora.example", roleId: "role_ops", branchId: "br_del", status: "active", lastActive: "Today, 09:41" },
  { id: "usr_dev", name: "Dev Rao", email: "dev@velora.example", roleId: "role_ops", branchId: "br_blr", status: "draft", lastActive: "Yesterday, 18:12" },
  { id: "usr_naina", name: "Naina Shah", email: "naina@velora.example", roleId: "role_auditor", branchId: "br_mum", status: "active", lastActive: "Today, 08:10" },
];

export const products: Product[] = [
  { id: "prd_001", sku: "ITM-1001", name: "Universal Packing Box", category: "Packaging", unit: "Nos", hsn: "4819", taxRate: 18, status: "active", updatedAt: "2026-06-28" },
  { id: "prd_002", sku: "ITM-1002", name: "Service Installation Kit", category: "Service", unit: "Set", hsn: "9987", taxRate: 18, status: "active", updatedAt: "2026-06-27" },
  { id: "prd_003", sku: "ITM-1003", name: "Generic Raw Material", category: "Material", unit: "Kg", hsn: "3901", taxRate: 12, status: "draft", updatedAt: "2026-06-26" },
];

export const notifications: Notification[] = [
  { id: "ntf_1", kind: "approval", title: "Branch activation pending", message: "Bengaluru Ops needs owner approval before go-live.", createdAt: "10 min ago", unread: true },
  { id: "ntf_2", kind: "success", title: "Product import completed", message: "142 item master rows were validated and imported.", createdAt: "42 min ago", unread: true },
  { id: "ntf_3", kind: "warning", title: "Storage usage crossed 25%", message: "Archive old exports or increase the company storage quota.", createdAt: "Yesterday", unread: false },
  { id: "ntf_4", kind: "system", title: "Core Platform v1.0.0 ready", message: "Release baseline, changelog, and release notes are available.", createdAt: "Today", unread: false },
];

export const auditLogs: AuditLog[] = [
  { id: "aud_1", action: "login", actor: "Aarav Mehta", module: "User Management", summary: "User Login", createdAt: "2026-06-28 10:24", ipAddress: "103.42.18.91" },
  { id: "aud_2", action: "update", actor: "Isha Kapoor", module: "Company Management", summary: "Company Updated", createdAt: "2026-06-28 09:58", ipAddress: "103.42.18.92" },
  { id: "aud_3", action: "create", actor: "Dev Rao", module: "Branch Management", summary: "Branch Created", createdAt: "2026-06-27 18:12", ipAddress: "49.37.84.10" },
  { id: "aud_4", action: "permission", actor: "Aarav Mehta", module: "RBAC", summary: "Permission Changed", createdAt: "2026-06-27 16:03", ipAddress: "103.42.18.91" },
  { id: "aud_5", action: "import", actor: "Isha Kapoor", module: "Product Master", summary: "Import Completed", createdAt: "2026-06-27 12:44", ipAddress: "103.42.18.92" },
  { id: "aud_6", action: "export", actor: "Naina Shah", module: "Audit Logs", summary: "Export Downloaded", createdAt: "2026-06-26 17:19", ipAddress: "122.161.77.4" },
];

export const importExportJobs: ImportExportJob[] = [
  { id: "job_1", module: "Product Master", type: "import", format: "xlsx", status: "completed", rows: 142, createdAt: "2026-06-28 09:52" },
  { id: "job_2", module: "Users", type: "export", format: "csv", status: "completed", rows: 41, createdAt: "2026-06-27 18:05" },
  { id: "job_3", module: "Branches", type: "import", format: "csv", status: "queued", rows: 3, createdAt: "2026-06-27 15:20" },
];
