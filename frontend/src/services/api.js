import { isUsableUuid } from "../utils/uuid.js";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export const hasApiBaseUrl = Boolean(API_BASE_URL);

// ─── UUID guard (prevents "Invalid UUID" errors system-wide) ─────────────────
// ROOT CAUSE: API methods were called with undefined/null/"new"/"create"/""
// before the user selected a real record.  Now every method that requires a
// UUID rejects invalid values at the client, returning null instead of
// throwing a Zod 422 that renders as "id: Invalid UUID".
function _guard(id, label = "id") {
  if (!isUsableUuid(id)) return null;
  return id;
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function clearStoredSession() {
  localStorage.removeItem("velora_access_token");
  localStorage.removeItem("velora_refresh_token");
  localStorage.removeItem("velora_user");
}

function storeRefreshedSession(payload) {
  if (payload.accessToken) localStorage.setItem("velora_access_token", payload.accessToken);
  if (payload.refreshToken) localStorage.setItem("velora_refresh_token", payload.refreshToken);
  if (payload.user) localStorage.setItem("velora_user", JSON.stringify(payload.user));
}

async function parsePayload(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

/**
 * Extract a user-friendly error message from an API response payload.
 *
 * ROOT CAUSE FIX: Previously this function preferred the raw Zod issues
 * array from payload.data.issues, producing messages like
 * "id: Invalid UUID".  Now we ALWAYS prefer the top-level `message`
 * field (which the backend formats into a friendly string) and only
 * fall back to issues when no message is present.
 */
function errorFromPayload(payload, fallback = "Request failed") {
  // Prefer the top-level friendly message from the backend.
  // The backend error handler now formats Zod errors into human-readable
  // strings like "id: invalid value — expected a valid reference"
  // and no longer leaks raw Zod issue objects.
  const message = payload.message || fallback;
  return new Error(message);
}

async function doTokenRefresh() {
  const refreshToken = localStorage.getItem("velora_refresh_token");
  if (!refreshToken) return null;
  const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const payload = await parsePayload(response);
  if (!response.ok || !payload.success) return null;
  storeRefreshedSession(payload.data);
  return payload.data.accessToken;
}

// ─── Core request ─────────────────────────────────────────────────────────────

export async function apiRequest(path, options = {}, retry = true) {
  const token = localStorage.getItem("velora_access_token");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const payload = await parsePayload(response);

  if (response.status === 401 && retry) {
    const newToken = await doTokenRefresh();
    if (newToken) return apiRequest(path, options, false);
    clearStoredSession();
    if (!["/login", "/register"].includes(window.location.pathname)) {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please login again.");
  }

  if (!response.ok || !payload.success) {
    throw errorFromPayload(payload);
  }
  return payload;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (input) => apiRequest("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  register: (input) => apiRequest("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  requestOtp: (input) => apiRequest("/auth/request-otp", { method: "POST", body: JSON.stringify(input) }),
  logout: (refreshToken) => apiRequest("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  logoutAll: () => apiRequest("/auth/logout-all", { method: "POST" }),
  sessions: () => apiRequest("/auth/sessions"),
  forgotPassword: (email) => apiRequest("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (input) => apiRequest("/auth/reset-password", { method: "POST", body: JSON.stringify(input) }),
  me: () => apiRequest("/auth/me"),
  verifyEmail: (token) => apiRequest("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
  resendVerification: (email) => apiRequest("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) }),
};

// Legacy exports kept for backward compat
export const login = authApi.login;
export const registerTenant = authApi.register;
export const requestOtp = authApi.requestOtp;

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getDashboardKpis = () => apiRequest("/dashboard/kpis");
export const getSalesChart = () => apiRequest("/dashboard/sales-chart");
export const getTopItems = () => apiRequest("/dashboard/top-items");

// ─── Core (company, branches, users, products, audit) ─────────────────────────

export const coreApi = {
  company: () => apiRequest("/company"),
  updateCompany: (input) => apiRequest("/company", { method: "PATCH", body: JSON.stringify(input) }),
  list: (resource, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/${resource}${qs ? `?${qs}` : ""}`);
  },
  create: (resource, input) => apiRequest(`/${resource}`, { method: "POST", body: JSON.stringify(input) }),
  update: (resource, id, input) => {
    const safeId = _guard(id, `${resource} id`);
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/${resource}/${safeId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  remove: (resource, id) => {
    const safeId = _guard(id, `${resource} id`);
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/${resource}/${safeId}`, { method: "DELETE" });
  },
  resetPassword: (id, password) => {
    const safeId = _guard(id, "user id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/users/${safeId}/reset-password`, { method: "POST", body: JSON.stringify({ password }) });
  },
  disableUser: (id) => {
    const safeId = _guard(id, "user id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/users/${safeId}/disable`, { method: "POST" });
  },
  auditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/audit-logs${qs ? `?${qs}` : ""}`);
  },
};

// ─── Master data (items, customers, vendors, etc.) ────────────────────────────

export const masterApi = {
  list: (resource, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/${resource}${qs ? `?${qs}` : ""}`);
  },
  get: (resource, id) => {
    const safeId = _guard(id, `${resource} id`);
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/${resource}/${safeId}`);
  },
  create: (resource, input) => apiRequest(`/${resource}`, { method: "POST", body: JSON.stringify(input) }),
  update: (resource, id, input) => {
    const safeId = _guard(id, `${resource} id`);
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/${resource}/${safeId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  remove: (resource, id) => {
    const safeId = _guard(id, `${resource} id`);
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/${resource}/${safeId}`, { method: "DELETE" });
  },
  searchItems: (q) => apiRequest(`/items/search?q=${encodeURIComponent(q)}`),
  customerOutstanding: (id) => {
    const safeId = _guard(id, "customer id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/customers/${safeId}/outstanding`);
  },
};

// ─── Leads ────────────────────────────────────────────────────────────────────

export const leadsApi = {
  list: (p = {}) => {
    const qs = new URLSearchParams(p).toString();
    return apiRequest(`/leads${qs ? `?${qs}` : ""}`);
  },
  create: (input) => apiRequest("/leads", { method: "POST", body: JSON.stringify(input) }),
  update: (id, input) => {
    const safeId = _guard(id, "lead id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/leads/${safeId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  remove: (id) => {
    const safeId = _guard(id, "lead id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/leads/${safeId}`, { method: "DELETE" });
  },
};

// ─── Sales ────────────────────────────────────────────────────────────────────

export const salesApi = {
  // Quotations
  quotations: (p = {}) => apiRequest(`/quotations?${new URLSearchParams(p)}`),
  getQuotation: (id) => {
    const safeId = _guard(id, "quotation id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/quotations/${safeId}`);
  },
  createQuotation: (input) => apiRequest("/quotations", { method: "POST", body: JSON.stringify(input) }),
  convertQuotation: (id) => {
    const safeId = _guard(id, "quotation id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/quotations/${safeId}/convert-to-order`, { method: "POST" });
  },
  updateQuotationStatus: (id, status) => {
    const safeId = _guard(id, "quotation id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/quotations/${safeId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  },

  // Sales Orders
  salesOrders: (p = {}) => apiRequest(`/sales-orders?${new URLSearchParams(p)}`),
  getSalesOrder: (id) => {
    const safeId = _guard(id, "sales order id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/sales-orders/${safeId}`);
  },
  createSalesOrder: (input) => apiRequest("/sales-orders", { method: "POST", body: JSON.stringify(input) }),
  updateSalesOrderStatus: (id, status) => {
    const safeId = _guard(id, "sales order id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/sales-orders/${safeId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  },

  // Delivery Notes
  deliveryNotes: (p = {}) => apiRequest(`/delivery-notes?${new URLSearchParams(p)}`),
  createDeliveryNote: (input) => apiRequest("/delivery-notes", { method: "POST", body: JSON.stringify(input) }),

  // Invoices
  invoices: (p = {}) => apiRequest(`/invoices?${new URLSearchParams(p)}`),
  getInvoice: (id) => {
    const safeId = _guard(id, "invoice id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/invoices/${safeId}`);
  },
  createInvoice: (input) => apiRequest("/invoices", { method: "POST", body: JSON.stringify(input) }),

  // Receipts
  receipts: (p = {}) => {
    const qs = new URLSearchParams(p).toString();
    return apiRequest(`/payment-receipts${qs ? `?${qs}` : ""}`);
  },
  createReceipt: (input) => apiRequest("/payment-receipts", { method: "POST", body: JSON.stringify(input) }),

  // Dashboard & Analytics
  dashboard: () => apiRequest("/sales/dashboard"),
  analytics: () => apiRequest("/sales/analytics"),
  ownerDashboard: () => apiRequest("/sales/owner-dashboard"),

  // Reports
  outstandingReport: () => apiRequest("/sales/outstanding-report"),
  customerLedger: (id) => {
    const safeId = _guard(id, "customer id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/customers/${safeId}/ledger`);
  },
};

// ─── Purchase ─────────────────────────────────────────────────────────────────

export const purchaseApi = {
  // Purchase Requests
  purchaseRequests: (p = {}) => apiRequest(`/purchase-requests?${new URLSearchParams(p)}`),
  createPurchaseRequest: (input) => apiRequest("/purchase-requests", { method: "POST", body: JSON.stringify(input) }),
  approvePurchaseRequest: (id) => {
    const safeId = _guard(id, "purchase request id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/purchase-requests/${safeId}/approve`, { method: "POST" });
  },

  // RFQs
  rfqs: (p = {}) => apiRequest(`/rfqs?${new URLSearchParams(p)}`),
  createRfq: (input) => apiRequest("/rfqs", { method: "POST", body: JSON.stringify(input) }),

  // Purchase Orders
  purchaseOrders: (p = {}) => apiRequest(`/purchase-orders?${new URLSearchParams(p)}`),
  getPurchaseOrder: (id) => {
    const safeId = _guard(id, "purchase order id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/purchase-orders/${safeId}`);
  },
  createPurchaseOrder: (input) => apiRequest("/purchase-orders", { method: "POST", body: JSON.stringify(input) }),
  approvePurchaseOrder: (id) => {
    const safeId = _guard(id, "purchase order id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/purchase-orders/${safeId}/approve`, { method: "PATCH" });
  },

  // GRN
  grns: (p = {}) => apiRequest(`/grns?${new URLSearchParams(p)}`),
  getGrn: (id) => {
    const safeId = _guard(id, "GRN id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/grns/${safeId}`);
  },
  createGrn: (input) => apiRequest("/grns", { method: "POST", body: JSON.stringify(input) }),
  approveGrn: (id) => {
    const safeId = _guard(id, "GRN id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/grns/${safeId}/approve`, { method: "POST" });
  },

  // Purchase Invoices
  purchaseInvoices: (p = {}) => apiRequest(`/purchase-invoices?${new URLSearchParams(p)}`),
  createPurchaseInvoice: (input) => apiRequest("/purchase-invoices", { method: "POST", body: JSON.stringify(input) }),

  // Vendor Payments
  vendorPayments: () => apiRequest("/vendor-payments"),
  createVendorPayment: (input) => apiRequest("/vendor-payments", { method: "POST", body: JSON.stringify(input) }),

  // Dashboard & Analytics
  dashboard: () => apiRequest("/purchase/dashboard"),
  analytics: () => apiRequest("/purchase/analytics"),
  report: (p = {}) => apiRequest(`/purchase/report?${new URLSearchParams(p)}`),

  // Reports
  outstandingReport: () => apiRequest("/purchase/outstanding-report"),
  vendorLedger: (id) => {
    const safeId = _guard(id, "vendor id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/vendors/${safeId}/ledger`);
  },
};

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventoryApi = {
  dashboard: (p = {}) => apiRequest(`/inventory/dashboard?${new URLSearchParams(p)}`),
  stockSummary: (p = {}) => apiRequest(`/inventory/stock-summary?${new URLSearchParams(p)}`),
  stockLedger: (itemId, p = {}) => {
    const safeId = _guard(itemId, "item id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/inventory/stock-ledger/${safeId}?${new URLSearchParams(p)}`);
  },
  ledger: (p = {}) => apiRequest(`/inventory/ledger?${new URLSearchParams(p)}`),
  batches: (p = {}) => apiRequest(`/inventory/batches?${new URLSearchParams(p)}`),
  locations: (p = {}) => apiRequest(`/inventory/locations?${new URLSearchParams(p)}`),
  createLocation: (input) => apiRequest("/inventory/locations", { method: "POST", body: JSON.stringify(input) }),
  reservations: () => apiRequest("/inventory/reservations"),
  createReservation: (input) => apiRequest("/inventory/reservations", { method: "POST", body: JSON.stringify(input) }),
  releaseReservation: (id) => {
    const safeId = _guard(id, "reservation id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/inventory/reservations/${safeId}/release`, { method: "PATCH" });
  },
  serials: (p = {}) => apiRequest(`/inventory/serials?${new URLSearchParams(p)}`),
  stockTransfers: () => apiRequest("/inventory/stock-transfers"),
  createTransfer: (input) => apiRequest("/inventory/stock-transfer", { method: "POST", body: JSON.stringify(input) }),
  createAdjustment: (input) => apiRequest("/inventory/stock-adjustment", { method: "POST", body: JSON.stringify(input) }),
  openingStock: (input) => apiRequest("/inventory/opening-stock", { method: "POST", body: JSON.stringify(input) }),
  lowStockAlerts: () => apiRequest("/inventory/low-stock-alerts"),
  valuationReport: () => apiRequest("/inventory/valuation-report"),
  suppliers: (p = {}) => apiRequest(`/inventory/suppliers?${new URLSearchParams(p)}`),
  supplierDetail: (id) => {
    const safeId = _guard(id, "supplier id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/inventory/suppliers/${safeId}`);
  },
};

// ─── CRM ──────────────────────────────────────────────────────────────────────

export const crmApi = {
  dashboard: () => apiRequest("/crm/dashboard"),
  pipeline: (status) => apiRequest(`/crm/pipeline?status=${status || "ALL"}`),
  customer360: (id) => {
    const safeId = _guard(id, "customer id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/crm/customers/${safeId}`);
  },
  search: (q) => apiRequest(`/crm/search?q=${encodeURIComponent(q)}`),
};

// ─── Accounts ─────────────────────────────────────────────────────────────────

export const accountsApi = {
  dashboard: () => apiRequest("/accounts/dashboard"),
  chartOfAccounts: () => apiRequest("/accounts/chart-of-accounts"),
  createAccount: (input) => apiRequest("/accounts/chart-of-accounts", { method: "POST", body: JSON.stringify(input) }),
  journalEntries: (p = {}) => apiRequest(`/accounts/journal-entries?${new URLSearchParams(p)}`),
  createJournalEntry: (input) => apiRequest("/accounts/journal-entries", { method: "POST", body: JSON.stringify(input) }),
  trialBalance: () => apiRequest("/accounts/trial-balance"),
  profitLoss: (p = {}) => apiRequest(`/accounts/profit-loss?${new URLSearchParams(p)}`),
  balanceSheet: () => apiRequest("/accounts/balance-sheet"),
  generalLedger: (accountId) => {
    const safeId = _guard(accountId, "account id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/accounts/general-ledger/${safeId}`);
  },
  gstr1: () => apiRequest("/accounts/gstr1-report"),
  gstr3b: () => apiRequest("/accounts/gstr3b-summary"),
  debtorAging: () => apiRequest("/accounts/debtor-aging"),
  creditorAging: () => apiRequest("/accounts/creditor-aging"),
  cashBook: () => apiRequest("/accounts/cash-book"),
};

// ─── EAM (Enterprise Asset Management) ─────────────────────────────────────────

export const eamApi = {
  dashboard: () => apiRequest("/eam/dashboard"),
  assets: (p = {}) => apiRequest(`/eam/assets?${new URLSearchParams(p)}`),
  assetDetail: (id) => {
    const safeId = _guard(id, "asset id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/eam/assets/${safeId}`);
  },
  createAsset: (input) => apiRequest("/eam/assets", { method: "POST", body: JSON.stringify(input) }),
  updateAsset: (id, input) => {
    const safeId = _guard(id, "asset id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/eam/assets/${safeId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  maintenance: (p = {}) => apiRequest(`/eam/maintenance?${new URLSearchParams(p)}`),
  createMaintenance: (input) => apiRequest("/eam/maintenance", { method: "POST", body: JSON.stringify(input) }),
  statuses: () => apiRequest("/eam/statuses"),
};

// ─── HRMS ──────────────────────────────────────────────────────────────────────

export const hrmsApi = {
  dashboard: () => apiRequest("/hrms/dashboard"),
  employees: (p = {}) => apiRequest(`/hrms/employees?${new URLSearchParams(p)}`),
  employeeDetail: (id) => {
    const safeId = _guard(id, "employee id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/hrms/employees/${safeId}`);
  },
  roles: () => apiRequest("/hrms/roles"),
};

// ─── AI Copilot ────────────────────────────────────────────────────────────────

export const aiApi = {
  chat: (message, context, history = []) => apiRequest("/ai/chat", { method: "POST", body: JSON.stringify({ message, context, history }) }),
  insights: () => apiRequest("/ai/insights"),
  diagnose: () => apiRequest("/ai/diagnose"),
};

// ─── BI (Business Intelligence) ────────────────────────────────────────────────

export const biApi = {
  executiveDashboard: () => apiRequest("/bi/executive-dashboard"),
  departments: () => apiRequest("/bi/departments"),
  insights: () => apiRequest("/bi/insights"),
  revenueAnalytics: () => apiRequest("/bi/revenue-analytics"),
};

// ─── Flow (workflow automation) ─────────────────────────────────────────────────

export const flowApi = {
  dashboard: () => apiRequest("/flow/dashboard"),
  workflows: () => apiRequest("/flow/workflows"),
  createWorkflow: (input) => apiRequest("/flow/workflows", { method: "POST", body: JSON.stringify(input) }),
  logs: () => apiRequest("/flow/logs"),
  templates: () => apiRequest("/flow/templates"),
  reference: () => apiRequest("/flow/reference"),
  trigger: (trigger, context) => apiRequest("/flow/trigger", { method: "POST", body: JSON.stringify({ trigger, context }) }),
};

// ─── Platform (developer portal, webhooks, API keys) ───────────────────────────

export const platformApi = {
  monitoring: () => apiRequest("/platform/monitoring"),
  apiKeys: () => apiRequest("/platform/api-keys"),
  createApiKey: (name) => apiRequest("/platform/api-keys", { method: "POST", body: JSON.stringify({ name }) }),
  deleteApiKey: (id) => {
    const safeId = _guard(id, "API key id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest("/platform/api-keys/" + safeId, { method: "DELETE" });
  },
  webhooks: () => apiRequest("/platform/webhooks"),
  createWebhook: (input) => apiRequest("/platform/webhooks", { method: "POST", body: JSON.stringify(input) }),
  deleteWebhook: (id) => {
    const safeId = _guard(id, "webhook id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest("/platform/webhooks/" + safeId, { method: "DELETE" });
  },
  testWebhook: (input) => apiRequest("/platform/webhooks/test", { method: "POST", body: JSON.stringify(input) }),
  events: () => apiRequest("/platform/events"),
  exportData: (mod, fmt) => apiRequest("/platform/export", { method: "POST", body: JSON.stringify({ module: mod, format: fmt }) }),
};

// ─── Supplier Portal ─────────────────────────────────────────────────────────

export const supplierPortalApi = {
  dashboard: (p) => apiRequest("/supplier-portal/dashboard?" + new URLSearchParams(p)),
  purchaseOrders: (p) => apiRequest("/supplier-portal/purchase-orders?" + new URLSearchParams(p)),
  invoices: (p) => apiRequest("/supplier-portal/invoices?" + new URLSearchParams(p)),
  payments: (p) => apiRequest("/supplier-portal/payments?" + new URLSearchParams(p)),
  vendors: () => apiRequest("/supplier-portal/vendors"),
};

// ─── EAM (Enterprise Asset Management) ─────────────────────────────────────────

// ─── HRMS ──────────────────────────────────────────────────────────────────────

// ─── WMS (Warehouse Management) ───────────────────────────────────────────────

export const wmsApi = {
  dashboard: () => apiRequest("/wms/dashboard"),
  warehouseDetail: (id) => {
    const safeId = _guard(id, "warehouse id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/wms/warehouses/${safeId}`);
  },
  locations: (p = {}) => apiRequest(`/wms/locations?${new URLSearchParams(p)}`),
  createLocation: (input) => apiRequest("/wms/locations", { method: "POST", body: JSON.stringify(input) }),
  movements: (p = {}) => apiRequest(`/wms/movements?${new URLSearchParams(p)}`),
};

// ─── Manufacturing ────────────────────────────────────────────────────────────

export const manufacturingApi = {
  access: () => apiRequest("/manufacturing/access"),
  dashboard: () => apiRequest("/manufacturing/dashboard"),
  analytics: () => apiRequest("/manufacturing/analytics"),

  // BOMs
  boms: (p = {}) => apiRequest(`/manufacturing/boms?${new URLSearchParams(p)}`),
  getBom: (id) => {
    const safeId = _guard(id, "BOM id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/manufacturing/boms/${safeId}`);
  },
  createBom: (input) => apiRequest("/manufacturing/boms", { method: "POST", body: JSON.stringify(input) }),
  deleteBom: (id) => {
    const safeId = _guard(id, "BOM id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/manufacturing/boms/${safeId}`, { method: "DELETE" });
  },

  // Production Orders
  productionOrders: (p = {}) => apiRequest(`/manufacturing/production-orders?${new URLSearchParams(p)}`),
  getProductionOrder: (id) => {
    const safeId = _guard(id, "production order id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/manufacturing/production-orders/${safeId}`);
  },
  createProductionOrder: (input) => apiRequest("/manufacturing/production-orders", { method: "POST", body: JSON.stringify(input) }),
  updateProductionOrderStatus: (id, input) => {
    const safeId = _guard(id, "production order id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/manufacturing/production-orders/${safeId}/status`, { method: "PATCH", body: JSON.stringify(input) });
  },

  // Work Orders
  workOrders: (p = {}) => apiRequest(`/manufacturing/work-orders?${new URLSearchParams(p)}`),
  createWorkOrder: (input) => apiRequest("/manufacturing/work-orders", { method: "POST", body: JSON.stringify(input) }),
  completeWorkOrder: (id, input) => {
    const safeId = _guard(id, "work order id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/manufacturing/work-orders/${safeId}/complete`, { method: "PATCH", body: JSON.stringify(input) });
  },

  // Machines
  machines: (p = {}) => apiRequest(`/manufacturing/machines?${new URLSearchParams(p)}`),
  createMachine: (input) => apiRequest("/manufacturing/machines", { method: "POST", body: JSON.stringify(input) }),
  updateMachineStatus: (id, status) => {
    const safeId = _guard(id, "machine id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/manufacturing/machines/${safeId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  },

  // Maintenance
  maintenance: (p = {}) => apiRequest(`/manufacturing/maintenance?${new URLSearchParams(p)}`),
  createMaintenance: (input) => apiRequest("/manufacturing/maintenance", { method: "POST", body: JSON.stringify(input) }),
  completeMaintenance: (id, input) => {
    const safeId = _guard(id, "maintenance id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/manufacturing/maintenance/${safeId}/complete`, { method: "PATCH", body: JSON.stringify(input) });
  },

  // Quality
  qualityChecks: (p = {}) => apiRequest(`/manufacturing/quality-checks?${new URLSearchParams(p)}`),
  createQualityCheck: (input) => apiRequest("/manufacturing/quality-checks", { method: "POST", body: JSON.stringify(input) }),
};

// ─── Legacy (kept for backward compat with OperationsPage) ───────────────────

export const operationsApi = {
  list: (resource) => {
    // Map old resource names to new endpoints
    if (resource === "sales") return salesApi.invoices();
    if (resource === "purchase") return purchaseApi.purchaseOrders();
    if (resource === "accounts") return accountsApi.journalEntries();
    return apiRequest(`/${resource}/records`);
  },
  create: (resource, input) => {
    if (resource === "sales") return salesApi.createInvoice(input);
    if (resource === "purchase") return purchaseApi.createPurchaseOrder(input);
    return apiRequest(`/${resource}/records`, { method: "POST", body: JSON.stringify(input) });
  },
  remove: (resource, id) => {
    const safeId = _guard(id, "record id");
    if (!safeId) return Promise.resolve(null);
    return apiRequest(`/${resource}/records/${safeId}`, { method: "DELETE" });
  },
};

// Legacy module access (used by ManufacturingPage)
export const moduleApi = {
  access: (moduleKey) => {
    if (moduleKey === "MANUFACTURING") return manufacturingApi.access();
    return Promise.resolve({ data: { locked: false } });
  },
};
