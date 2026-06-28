export type Status = "active" | "inactive" | "draft" | "archived";

export type NotificationKind =
  | "system"
  | "approval"
  | "warning"
  | "information"
  | "success"
  | "error";

export type AuditAction =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "import"
  | "export"
  | "permission";

export type Permission =
  | "company:read"
  | "company:write"
  | "branch:read"
  | "branch:write"
  | "user:read"
  | "user:write"
  | "product:read"
  | "product:write"
  | "import:run"
  | "export:run"
  | "audit:read"
  | "notification:manage";

export type Company = {
  id: string;
  name: string;
  legalName: string;
  gstin: string;
  industryTemplate: string;
  status: Status;
  healthScore: number;
  storageUsedGb: number;
  storageLimitGb: number;
  createdAt: string;
};

export type Branch = {
  id: string;
  companyId: string;
  name: string;
  city: string;
  state: string;
  manager: string;
  users: number;
  status: Status;
};

export type Role = {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  users: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  branchId: string;
  status: Status;
  lastActive: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  hsn: string;
  taxRate: number;
  status: Status;
  updatedAt: string;
};

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: string;
  unread: boolean;
};

export type AuditLog = {
  id: string;
  action: AuditAction;
  actor: string;
  module: string;
  summary: string;
  createdAt: string;
  ipAddress: string;
};

export type ImportExportJob = {
  id: string;
  module: string;
  type: "import" | "export";
  format: "csv" | "xlsx";
  status: "completed" | "queued" | "failed";
  rows: number;
  createdAt: string;
};
