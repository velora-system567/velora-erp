export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export const hasApiBaseUrl = Boolean(API_BASE_URL);

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

function errorFromPayload(payload, fallback = "Request failed") {
  const issues = payload.data?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    const text = issues
      .map((i) => `${i.path?.slice(1).join(".") || "Field"}: ${i.message}`)
      .join("\n");
    return new Error(text);
  }
  return new Error(payload.message || fallback);
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
  update: (resource, id, input) => apiRequest(`/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (resource, id) => apiRequest(`/${resource}/${id}`, { method: "DELETE" }),
  resetPassword: (id, password) => apiRequest(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
  disableUser: (id) => apiRequest(`/users/${id}/disable`, { method: "POST" }),
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
  get: (resource, id) => apiRequest(`/${resource}/${id}`),
  create: (resource, input) => apiRequest(`/${resource}`, { method: "POST", body: JSON.stringify(input) }),
  update: (resource, id, input) => apiRequest(`/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (resource, id) => apiRequest(`/${resource}/${id}`, { method: "DELETE" }),
  searchItems: (q) => apiRequest(`/items/search?q=${encodeURIComponent(q)}`),
  customerOutstanding: (id) => apiRequest(`/customers/${id}/outstanding`),
};

// ─── Leads ────────────────────────────────────────────────────────────────────

export const leadsApi = {
  list: () => apiRequest("/leads"),
  create: (input) => apiRequest("/leads", { method: "POST", body: JSON.stringify(input) }),
  update: (id, input) => apiRequest(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id) => apiRequest(`/leads/${id}`, { method: "DELETE" }),
};

// ─── Sales ────────────────────────────────────────────────────────────────────

export const salesApi = {
  // Quotations
  quotations: (p = {}) => apiRequest(`/quotations?${new URLSearchParams(p)}`),
  getQuotation: (id) => apiRequest(`/quotations/${id}`),
  createQuotation: (input) => apiRequest("/quotations", { method: "POST", body: JSON.stringify(input) }),
  convertQuotation: (id) => apiRequest(`/quotations/${id}/convert-to-order`, { method: "POST" }),
  updateQuotationStatus: (id, status) => apiRequest(`/quotations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // Sales Orders
  salesOrders: (p = {}) => apiRequest(`/sales-orders?${new URLSearchParams(p)}`),
  getSalesOrder: (id) => apiRequest(`/sales-orders/${id}`),
  createSalesOrder: (input) => apiRequest("/sales-orders", { method: "POST", body: JSON.stringify(input) }),
  updateSalesOrderStatus: (id, status) => apiRequest(`/sales-orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // Delivery Notes
  deliveryNotes: (p = {}) => apiRequest(`/delivery-notes?${new URLSearchParams(p)}`),
  createDeliveryNote: (input) => apiRequest("/delivery-notes", { method: "POST", body: JSON.stringify(input) }),

  // Invoices
  invoices: (p = {}) => apiRequest(`/invoices?${new URLSearchParams(p)}`),
  getInvoice: (id) => apiRequest(`/invoices/${id}`),
  createInvoice: (input) => apiRequest("/invoices", { method: "POST", body: JSON.stringify(input) }),

  // Receipts
  receipts: () => apiRequest("/payment-receipts"),
  createReceipt: (input) => apiRequest("/payment-receipts", { method: "POST", body: JSON.stringify(input) }),

  // Dashboard & Analytics
  dashboard: () => apiRequest("/sales/dashboard"),
  analytics: () => apiRequest("/sales/analytics"),
  ownerDashboard: () => apiRequest("/sales/owner-dashboard"),

  // Reports
  outstandingReport: () => apiRequest("/sales/outstanding-report"),
  customerLedger: (id) => apiRequest(`/customers/${id}/ledger`),
};

// ─── Purchase ─────────────────────────────────────────────────────────────────

export const purchaseApi = {
  // Purchase Requests
  purchaseRequests: (p = {}) => apiRequest(`/purchase-requests?${new URLSearchParams(p)}`),
  createPurchaseRequest: (input) => apiRequest("/purchase-requests", { method: "POST", body: JSON.stringify(input) }),
  approvePurchaseRequest: (id) => apiRequest(`/purchase-requests/${id}/approve`, { method: "POST" }),

  // RFQs
  rfqs: (p = {}) => apiRequest(`/rfqs?${new URLSearchParams(p)}`),
  createRfq: (input) => apiRequest("/rfqs", { method: "POST", body: JSON.stringify(input) }),

  // Purchase Orders
  purchaseOrders: (p = {}) => apiRequest(`/purchase-orders?${new URLSearchParams(p)}`),
  getPurchaseOrder: (id) => apiRequest(`/purchase-orders/${id}`),
  createPurchaseOrder: (input) => apiRequest("/purchase-orders", { method: "POST", body: JSON.stringify(input) }),
  approvePurchaseOrder: (id) => apiRequest(`/purchase-orders/${id}/approve`, { method: "PATCH" }),

  // GRN
  grns: (p = {}) => apiRequest(`/grns?${new URLSearchParams(p)}`),
  getGrn: (id) => apiRequest(`/grns/${id}`),
  createGrn: (input) => apiRequest("/grns", { method: "POST", body: JSON.stringify(input) }),
  approveGrn: (id) => apiRequest(`/grns/${id}/approve`, { method: "POST" }),

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
  vendorLedger: (id) => apiRequest(`/vendors/${id}/ledger`),
};

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventoryApi = {
  dashboard: (p = {}) => apiRequest(`/inventory/dashboard?${new URLSearchParams(p)}`),
  stockSummary: (p = {}) => apiRequest(`/inventory/stock-summary?${new URLSearchParams(p)}`),
  stockLedger: (itemId, p = {}) => apiRequest(`/inventory/stock-ledger/${itemId}?${new URLSearchParams(p)}`),
  ledger: (p = {}) => apiRequest(`/inventory/ledger?${new URLSearchParams(p)}`),
  batches: (p = {}) => apiRequest(`/inventory/batches?${new URLSearchParams(p)}`),
  locations: (p = {}) => apiRequest(`/inventory/locations?${new URLSearchParams(p)}`),
  createLocation: (input) => apiRequest("/inventory/locations", { method: "POST", body: JSON.stringify(input) }),
  reservations: () => apiRequest("/inventory/reservations"),
  createReservation: (input) => apiRequest("/inventory/reservations", { method: "POST", body: JSON.stringify(input) }),
  releaseReservation: (id) => apiRequest(`/inventory/reservations/${id}/release`, { method: "PATCH" }),
  serials: (p = {}) => apiRequest(`/inventory/serials?${new URLSearchParams(p)}`),
  cycleCounts: () => apiRequest("/inventory/cycle-counts"),
  createCycleCount: (input) => apiRequest("/inventory/cycle-counts", { method: "POST", body: JSON.stringify(input) }),
  completeCycleCount: (id, input) => apiRequest(`/inventory/cycle-counts/${id}/complete`, { method: "PATCH", body: JSON.stringify(input) }),
  stockTransfers: () => apiRequest("/inventory/stock-transfers"),
  createTransfer: (input) => apiRequest("/inventory/stock-transfer", { method: "POST", body: JSON.stringify(input) }),
  createAdjustment: (input) => apiRequest("/inventory/stock-adjustment", { method: "POST", body: JSON.stringify(input) }),
  openingStock: (input) => apiRequest("/inventory/opening-stock", { method: "POST", body: JSON.stringify(input) }),
  lowStockAlerts: () => apiRequest("/inventory/low-stock-alerts"),
  valuationReport: () => apiRequest("/inventory/valuation-report"),
  suppliers: (p = {}) => apiRequest(`/inventory/suppliers?${new URLSearchParams(p)}`),
  supplierDetail: (id) => apiRequest(`/inventory/suppliers/${id}`),
};

// ─── CRM ──────────────────────────────────────────────────────────────────────

export const crmApi = {
  dashboard: () => apiRequest("/crm/dashboard"),
  pipeline: (status) => apiRequest(`/crm/pipeline?status=${status || "ALL"}`),
  customer360: (id) => apiRequest(`/crm/customers/${id}`),
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
  generalLedger: (accountId) => apiRequest(`/accounts/general-ledger/${accountId}`),
  gstr1: () => apiRequest("/accounts/gstr1-report"),
  gstr3b: () => apiRequest("/accounts/gstr3b-summary"),
  debtorAging: () => apiRequest("/accounts/debtor-aging"),
  creditorAging: () => apiRequest("/accounts/creditor-aging"),
  cashBook: () => apiRequest("/accounts/cash-book"),
};

// ─── WMS (Warehouse Management) ───────────────────────────────────────────────

export const wmsApi = {
  dashboard: () => apiRequest("/wms/dashboard"),
  warehouseDetail: (id) => apiRequest(`/wms/warehouses/${id}`),
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
  getBom: (id) => apiRequest(`/manufacturing/boms/${id}`),
  createBom: (input) => apiRequest("/manufacturing/boms", { method: "POST", body: JSON.stringify(input) }),
  deleteBom: (id) => apiRequest(`/manufacturing/boms/${id}`, { method: "DELETE" }),

  // Production Orders
  productionOrders: (p = {}) => apiRequest(`/manufacturing/production-orders?${new URLSearchParams(p)}`),
  getProductionOrder: (id) => apiRequest(`/manufacturing/production-orders/${id}`),
  createProductionOrder: (input) => apiRequest("/manufacturing/production-orders", { method: "POST", body: JSON.stringify(input) }),
  updateProductionOrderStatus: (id, input) => apiRequest(`/manufacturing/production-orders/${id}/status`, { method: "PATCH", body: JSON.stringify(input) }),

  // Work Orders
  workOrders: (p = {}) => apiRequest(`/manufacturing/work-orders?${new URLSearchParams(p)}`),
  createWorkOrder: (input) => apiRequest("/manufacturing/work-orders", { method: "POST", body: JSON.stringify(input) }),
  completeWorkOrder: (id, input) => apiRequest(`/manufacturing/work-orders/${id}/complete`, { method: "PATCH", body: JSON.stringify(input) }),

  // Machines
  machines: (p = {}) => apiRequest(`/manufacturing/machines?${new URLSearchParams(p)}`),
  createMachine: (input) => apiRequest("/manufacturing/machines", { method: "POST", body: JSON.stringify(input) }),
  updateMachineStatus: (id, status) => apiRequest(`/manufacturing/machines/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // Maintenance
  maintenance: (p = {}) => apiRequest(`/manufacturing/maintenance?${new URLSearchParams(p)}`),
  createMaintenance: (input) => apiRequest("/manufacturing/maintenance", { method: "POST", body: JSON.stringify(input) }),
  completeMaintenance: (id, input) => apiRequest(`/manufacturing/maintenance/${id}/complete`, { method: "PATCH", body: JSON.stringify(input) }),

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
  remove: (resource, id) => apiRequest(`/${resource}/records/${id}`, { method: "DELETE" }),
};

// Legacy module access (used by ManufacturingPage)
export const moduleApi = {
  access: (moduleKey) => {
    if (moduleKey === "MANUFACTURING") return manufacturingApi.access();
    return Promise.resolve({ data: { locked: false } });
  },
};
