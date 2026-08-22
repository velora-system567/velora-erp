import { isUsableUuid } from "../utils/uuid.js";
import { useAuthStore } from "../store/auth.js";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export const hasApiBaseUrl = Boolean(API_BASE_URL);

// ─── UUID guard (prevents "Invalid UUID" errors system-wide) ─────────────────
// ROOT CAUSE: API methods were called with undefined/null/"new"/"create"/""
// before the user selected a real record.  Now every method that requires a
// UUID rejects invalid values at the client instead of throwing a Zod 422
// that renders as "id: Invalid UUID".
//
// IMPORTANT: guarded methods resolve a CONSISTENT response shape —
// `{ success: false, data: null, message }` — never `null`.  Resolving `null`
// previously crashed callers that destructured the result (`const { data } =
// await ...`) when no record was selected.  This shape is API-response-like,
// so destructuring, `.success` checks, and truthiness checks all work.

let _lastGuardLabel = "Record";

function _guard(id, label = "Record") {
  if (!isUsableUuid(id)) {
    _lastGuardLabel = label;
    return null;
  }
  return id;
}

/** Resolve a graceful "no record selected" response for guarded methods. */
function _noRecord() {
  return Promise.resolve({
    success: false,
    data: null,
    message: `No ${_lastGuardLabel} selected. Select a valid record to continue.`,
  });
}

// ─── Query-string builder ─────────────────────────────────────────────────────
// ROOT CAUSE FIX (Sales module 500s): `new URLSearchParams({ status: undefined })`
// serializes JS undefined as the literal STRING "undefined". That value passed
// z.string().optional() validation on the backend, reached Prisma enum filters
// (DocumentStatus/LeadStatus), and threw PrismaClientValidationError → HTTP 500
// on /leads, /quotations, /sales-orders, /delivery-notes and /invoices.
// This builder omits null/undefined/empty values so optional filters are truly
// absent from the request instead of becoming garbage strings.
function buildQs(params = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    clean[key] = value;
  }
  return new URLSearchParams(clean).toString();
}

// ─── Session helpers ──────────────────────────────────────────────────────────
// Single source of truth for session state: useAuthStore (Zustand).
// All localStorage writes also sync the in-memory store so React components
// that read from useAuthStore see the fresh state immediately.

function clearStoredSession() {
  localStorage.removeItem("velora_access_token");
  localStorage.removeItem("velora_refresh_token");
  localStorage.removeItem("velora_user");
  // Sync Zustand store — prevents stale user state after session clear
  try { useAuthStore.getState().clearSession(); } catch { /* store not initialized */ }
}

function storeRefreshedSession(payload) {
  if (payload.accessToken) localStorage.setItem("velora_access_token", payload.accessToken);
  if (payload.refreshToken) localStorage.setItem("velora_refresh_token", payload.refreshToken);
  if (payload.user) localStorage.setItem("velora_user", JSON.stringify(payload.user));
  // Sync Zustand store — prevents stale user object after silent token refresh
  try { useAuthStore.getState().syncFromStorage(); } catch { /* store not initialized */ }
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

// ─── Singleton token refresh ─────────────────────────────────────────────────
// Prevents multiple concurrent API calls from all racing to refresh the token.
// When the first 401 arrives, we refresh once; subsequent 401s wait for the
// same in-flight refresh instead of each firing their own request.

let _refreshPromise = null;

async function doTokenRefresh() {
  // If a refresh is already in-flight, wait for it
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
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
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ─── Session expiration signal ───────────────────────────────────────────────
// Instead of hard-navigating with window.location.href (which tears down
// the React tree mid-render and causes white screens), we signal session
// expiration through a callback.  AppShell watches this and redirects
// via React Router.

let _onSessionExpired = null;
let _sessionExpiredSignaled = false;

/**
 * Register a callback that fires when the session expires.
 * Called by AppShell to redirect to /login via React Router.
 */
export function onSessionExpired(cb) {
  _onSessionExpired = cb;
  // Reset flag when a new handler is registered (new session)
  _sessionExpiredSignaled = false;
}

function signalSessionExpired() {
  // Only signal once per session to prevent redirect loops
  if (_sessionExpiredSignaled) return;
  _sessionExpiredSignaled = true;
  if (_onSessionExpired) _onSessionExpired();
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
    // Signal session expiration — AppShell handles the redirect
    // via React Router (soft navigation), avoiding white screens
    // caused by hard window.location.href navigation.
    signalSessionExpired();
    throw new Error("Session expired. Please login again.");
  }

  if (!response.ok || !payload.success) {
    const err = errorFromPayload(payload);
    // Tag503 errors so the error boundary can show a user-friendly
    // "service temporarily unavailable" message instead of generic crash UI.
    if (response.status === 503) {
      err.status = 503;
      err.isServiceUnavailable = true;
    }
    throw err;
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

  // Google OAuth
  googleUrl: () => apiRequest("/auth/google/url"),
  googleLogin: (code) => apiRequest("/auth/google", { method: "POST", body: JSON.stringify({ code }) }),

  // Device Management
  devices: () => apiRequest("/auth/devices"),
  trustDevice: (deviceId) => apiRequest(`/auth/devices/${deviceId}/trust`, { method: "POST" }),
  removeDevice: (deviceId) => apiRequest(`/auth/devices/${deviceId}`, { method: "DELETE" }),
  logoutDevice: (deviceId) => apiRequest(`/auth/devices/${deviceId}/logout`, { method: "POST" }),
  logoutAllDevices: () => apiRequest("/auth/devices/logout-all", { method: "POST" }),

  // QR Login
  qrGenerate: () => apiRequest("/auth/qr/generate", { method: "POST" }),
  qrStatus: (sessionCode) => apiRequest(`/auth/qr/status/${sessionCode}`),
  qrScan: (qrToken) => apiRequest("/auth/qr/scan", { method: "POST", body: JSON.stringify({ qrToken }) }),
  qrApprove: (qrToken) => apiRequest("/auth/qr/approve", { method: "POST", body: JSON.stringify({ qrToken }) }),
  qrReject: (qrToken) => apiRequest("/auth/qr/reject", { method: "POST", body: JSON.stringify({ qrToken }) }),

  // Security
  securitySummary: () => apiRequest("/auth/security/summary"),
  securityEvents: (params = {}) => {
    const qs = buildQs(params);
    return apiRequest(`/auth/security/events${qs ? `?${qs}` : ""}`);
  },
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
    const qs = buildQs(params);
    return apiRequest(`/${resource}${qs ? `?${qs}` : ""}`);
  },
  create: (resource, input) => apiRequest(`/${resource}`, { method: "POST", body: JSON.stringify(input) }),
  update: (resource, id, input) => {
    const safeId = _guard(id, `${resource} id`);
    if (!safeId) return _noRecord();
    return apiRequest(`/${resource}/${safeId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  remove: (resource, id) => {
    const safeId = _guard(id, `${resource} id`);
    if (!safeId) return _noRecord();
    return apiRequest(`/${resource}/${safeId}`, { method: "DELETE" });
  },
  resetPassword: (id, password) => {
    const safeId = _guard(id, "user id");
    if (!safeId) return _noRecord();
    return apiRequest(`/users/${safeId}/reset-password`, { method: "POST", body: JSON.stringify({ password }) });
  },
  disableUser: (id) => {
    const safeId = _guard(id, "user id");
    if (!safeId) return _noRecord();
    return apiRequest(`/users/${safeId}/disable`, { method: "POST" });
  },
  auditLogs: (params = {}) => {
    const qs = buildQs(params);
    return apiRequest(`/audit-logs${qs ? `?${qs}` : ""}`);
  },
};

// ─── Master data (items, customers, vendors, etc.) ────────────────────────────

export const masterApi = {
  list: (resource, params = {}) => {
    const qs = buildQs(params);
    return apiRequest(`/${resource}${qs ? `?${qs}` : ""}`);
  },
  get: (resource, id) => {
    const safeId = _guard(id, `${resource} id`);
    if (!safeId) return _noRecord();
    return apiRequest(`/${resource}/${safeId}`);
  },
  create: (resource, input) => apiRequest(`/${resource}`, { method: "POST", body: JSON.stringify(input) }),
  update: (resource, id, input) => {
    const safeId = _guard(id, `${resource} id`);
    if (!safeId) return _noRecord();
    return apiRequest(`/${resource}/${safeId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  remove: (resource, id) => {
    const safeId = _guard(id, `${resource} id`);
    if (!safeId) return _noRecord();
    return apiRequest(`/${resource}/${safeId}`, { method: "DELETE" });
  },
  searchItems: (q) => apiRequest(`/items/search?q=${encodeURIComponent(q)}`),
  customerOutstanding: (id) => {
    const safeId = _guard(id, "customer id");
    if (!safeId) return _noRecord();
    return apiRequest(`/customers/${safeId}/outstanding`);
  },
};

// ─── Purchase ─────────────────────────────────────────────────────────────────

export const purchaseApi = {
  // Purchase Requests
  purchaseRequests: (p = {}) => apiRequest(`/purchase-requests?${buildQs(p)}`),
  createPurchaseRequest: (input) => apiRequest("/purchase-requests", { method: "POST", body: JSON.stringify(input) }),
  approvePurchaseRequest: (id) => {
    const safeId = _guard(id, "purchase request id");
    if (!safeId) return _noRecord();
    return apiRequest(`/purchase-requests/${safeId}/approve`, { method: "POST" });
  },

  // RFQs
  rfqs: (p = {}) => apiRequest(`/rfqs?${buildQs(p)}`),
  createRfq: (input) => apiRequest("/rfqs", { method: "POST", body: JSON.stringify(input) }),

  // Purchase Orders
  purchaseOrders: (p = {}) => apiRequest(`/purchase-orders?${buildQs(p)}`),
  getPurchaseOrder: (id) => {
    const safeId = _guard(id, "purchase order id");
    if (!safeId) return _noRecord();
    return apiRequest(`/purchase-orders/${safeId}`);
  },
  createPurchaseOrder: (input) => apiRequest("/purchase-orders", { method: "POST", body: JSON.stringify(input) }),
  approvePurchaseOrder: (id) => {
    const safeId = _guard(id, "purchase order id");
    if (!safeId) return _noRecord();
    return apiRequest(`/purchase-orders/${safeId}/approve`, { method: "PATCH" });
  },

  // GRN
  grns: (p = {}) => apiRequest(`/grns?${buildQs(p)}`),
  getGrn: (id) => {
    const safeId = _guard(id, "GRN id");
    if (!safeId) return _noRecord();
    return apiRequest(`/grns/${safeId}`);
  },
  createGrn: (input) => apiRequest("/grns", { method: "POST", body: JSON.stringify(input) }),
  approveGrn: (id) => {
    const safeId = _guard(id, "GRN id");
    if (!safeId) return _noRecord();
    return apiRequest(`/grns/${safeId}/approve`, { method: "POST" });
  },

  // Purchase Invoices
  purchaseInvoices: (p = {}) => apiRequest(`/purchase-invoices?${buildQs(p)}`),
  createPurchaseInvoice: (input) => apiRequest("/purchase-invoices", { method: "POST", body: JSON.stringify(input) }),

  // Vendor Payments
  vendorPayments: () => apiRequest("/vendor-payments"),
  createVendorPayment: (input) => apiRequest("/vendor-payments", { method: "POST", body: JSON.stringify(input) }),

  // Dashboard & Analytics
  dashboard: () => apiRequest("/purchase/dashboard"),
  analytics: () => apiRequest("/purchase/analytics"),
  report: (p = {}) => apiRequest(`/purchase/report?${buildQs(p)}`),

  // Reports
  outstandingReport: () => apiRequest("/purchase/outstanding-report"),
  vendorLedger: (id) => {
    const safeId = _guard(id, "vendor id");
    if (!safeId) return _noRecord();
    return apiRequest(`/vendors/${safeId}/ledger`);
  },
};

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventoryApi = {
  dashboard: (p = {}) => apiRequest(`/inventory/dashboard?${buildQs(p)}`),
  stockSummary: (p = {}) => apiRequest(`/inventory/stock-summary?${buildQs(p)}`),
  stockLedger: (itemId, p = {}) => {
    const safeId = _guard(itemId, "item id");
    if (!safeId) return _noRecord();
    return apiRequest(`/inventory/stock-ledger/${safeId}?${buildQs(p)}`);
  },
  ledger: (p = {}) => apiRequest(`/inventory/ledger?${buildQs(p)}`),
  batches: (p = {}) => apiRequest(`/inventory/batches?${buildQs(p)}`),
  locations: (p = {}) => apiRequest(`/inventory/locations?${buildQs(p)}`),
  createLocation: (input) => apiRequest("/inventory/locations", { method: "POST", body: JSON.stringify(input) }),
  reservations: () => apiRequest("/inventory/reservations"),
  createReservation: (input) => apiRequest("/inventory/reservations", { method: "POST", body: JSON.stringify(input) }),
  releaseReservation: (id) => {
    const safeId = _guard(id, "reservation id");
    if (!safeId) return _noRecord();
    return apiRequest(`/inventory/reservations/${safeId}/release`, { method: "PATCH" });
  },
  serials: (p = {}) => apiRequest(`/inventory/serials?${buildQs(p)}`),
  stockTransfers: () => apiRequest("/inventory/stock-transfers"),
  createTransfer: (input) => apiRequest("/inventory/stock-transfer", { method: "POST", body: JSON.stringify(input) }),
  createAdjustment: (input) => apiRequest("/inventory/stock-adjustment", { method: "POST", body: JSON.stringify(input) }),
  openingStock: (input) => apiRequest("/inventory/opening-stock", { method: "POST", body: JSON.stringify(input) }),
  lowStockAlerts: () => apiRequest("/inventory/low-stock-alerts"),
  valuationReport: () => apiRequest("/inventory/valuation-report"),
  suppliers: (p = {}) => apiRequest(`/inventory/suppliers?${buildQs(p)}`),
  supplierDetail: (id) => {
    const safeId = _guard(id, "supplier id");
    if (!safeId) return _noRecord();
    return apiRequest(`/inventory/suppliers/${safeId}`);
  },
};

// ─── Sales ──────────────────────────────────────────────────────────────────────

export const salesApi = {
  // Leads
  leads: (p = {}) => apiRequest(`/leads?${buildQs(p)}`),
  createLead: (input) => apiRequest("/leads", { method: "POST", body: JSON.stringify(input) }),
  updateLead: (id, input) => {
    const safeId = _guard(id, "lead id");
    if (!safeId) return _noRecord();
    return apiRequest(`/leads/${safeId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  deleteLead: (id) => {
    const safeId = _guard(id, "lead id");
    if (!safeId) return _noRecord();
    return apiRequest(`/leads/${safeId}`, { method: "DELETE" });
  },

  // Quotations
  quotations: (p = {}) => apiRequest(`/quotations?${buildQs(p)}`),
  createQuotation: (input) => apiRequest("/quotations", { method: "POST", body: JSON.stringify(input) }),
  getQuotation: (id) => {
    const safeId = _guard(id, "quotation id");
    if (!safeId) return _noRecord();
    return apiRequest(`/quotations/${safeId}`);
  },
  convertQuotationToOrder: (id) => {
    const safeId = _guard(id, "quotation id");
    if (!safeId) return _noRecord();
    return apiRequest(`/quotations/${safeId}/convert-to-order`, { method: "POST" });
  },
  updateQuotationStatus: (id, status) => {
    const safeId = _guard(id, "quotation id");
    if (!safeId) return _noRecord();
    return apiRequest(`/quotations/${safeId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  },

  // Sales Orders
  salesOrders: (p = {}) => apiRequest(`/sales-orders?${buildQs(p)}`),
  createSalesOrder: (input) => apiRequest("/sales-orders", { method: "POST", body: JSON.stringify(input) }),
  getSalesOrder: (id) => {
    const safeId = _guard(id, "sales order id");
    if (!safeId) return _noRecord();
    return apiRequest(`/sales-orders/${safeId}`);
  },
  updateSalesOrderStatus: (id, status) => {
    const safeId = _guard(id, "sales order id");
    if (!safeId) return _noRecord();
    return apiRequest(`/sales-orders/${safeId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  },

  // Delivery Notes
  deliveryNotes: (p = {}) => apiRequest(`/delivery-notes?${buildQs(p)}`),
  createDeliveryNote: (input) => apiRequest("/delivery-notes", { method: "POST", body: JSON.stringify(input) }),
  getDeliveryNote: (id) => {
    const safeId = _guard(id, "delivery note id");
    if (!safeId) return _noRecord();
    return apiRequest(`/delivery-notes/${safeId}`);
  },

  // Invoices
  invoices: (p = {}) => apiRequest(`/invoices?${buildQs(p)}`),
  createInvoice: (input) => apiRequest("/invoices", { method: "POST", body: JSON.stringify(input) }),
  getInvoice: (id) => {
    const safeId = _guard(id, "invoice id");
    if (!safeId) return _noRecord();
    return apiRequest(`/invoices/${safeId}`);
  },

  // Payment Receipts
  paymentReceipts: (p = {}) => apiRequest(`/payment-receipts?${buildQs(p)}`),
  createPaymentReceipt: (input) => apiRequest("/payment-receipts", { method: "POST", body: JSON.stringify(input) }),

  // Dashboards & Analytics
  dashboard: () => apiRequest("/sales/dashboard"),
  ownerDashboard: () => apiRequest("/sales/owner-dashboard"),
  analytics: () => apiRequest("/sales/analytics"),

  // Customer Outstanding & Ledger
  customerOutstanding: (id) => {
    const safeId = _guard(id, "customer id");
    if (!safeId) return _noRecord();
    return apiRequest(`/customers/${safeId}/outstanding`);
  },
  customerLedger: (id) => {
    const safeId = _guard(id, "customer id");
    if (!safeId) return _noRecord();
    return apiRequest(`/customers/${safeId}/ledger`);
  },

  // Item Search
  itemSearch: (q, limit = 20) => apiRequest(`/items/search?q=${encodeURIComponent(q)}&limit=${limit}`),
};

// ─── CRM ──────────────────────────────────────────────────────────────────────

export const crmApi = {
  dashboard: () => apiRequest("/crm/dashboard"),
  pipeline: (status) => apiRequest(`/crm/pipeline?status=${status || "ALL"}`),
  customer360: (id) => {
    const safeId = _guard(id, "customer id");
    if (!safeId) return _noRecord();
    return apiRequest(`/crm/customers/${safeId}`);
  },
  search: (q) => apiRequest(`/crm/search?q=${encodeURIComponent(q)}`),
};

// ─── Accounts ─────────────────────────────────────────────────────────────────

export const accountsApi = {
  dashboard: () => apiRequest("/accounts/dashboard"),
  chartOfAccounts: () => apiRequest("/accounts/chart-of-accounts"),
  createAccount: (input) => apiRequest("/accounts/chart-of-accounts", { method: "POST", body: JSON.stringify(input) }),
  journalEntries: (p = {}) => apiRequest(`/accounts/journal-entries?${buildQs(p)}`),
  createJournalEntry: (input) => apiRequest("/accounts/journal-entries", { method: "POST", body: JSON.stringify(input) }),
  trialBalance: () => apiRequest("/accounts/trial-balance"),
  profitLoss: (p = {}) => apiRequest(`/accounts/profit-loss?${buildQs(p)}`),
  balanceSheet: () => apiRequest("/accounts/balance-sheet"),
  generalLedger: (accountId) => {
    const safeId = _guard(accountId, "account id");
    if (!safeId) return _noRecord();
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
  assets: (p = {}) => apiRequest(`/eam/assets?${buildQs(p)}`),
  assetDetail: (id) => {
    const safeId = _guard(id, "asset id");
    if (!safeId) return _noRecord();
    return apiRequest(`/eam/assets/${safeId}`);
  },
  createAsset: (input) => apiRequest("/eam/assets", { method: "POST", body: JSON.stringify(input) }),
  updateAsset: (id, input) => {
    const safeId = _guard(id, "asset id");
    if (!safeId) return _noRecord();
    return apiRequest(`/eam/assets/${safeId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  maintenance: (p = {}) => apiRequest(`/eam/maintenance?${buildQs(p)}`),
  createMaintenance: (input) => apiRequest("/eam/maintenance", { method: "POST", body: JSON.stringify(input) }),
  statuses: () => apiRequest("/eam/statuses"),
};

// ─── HRMS ──────────────────────────────────────────────────────────────────────

export const hrmsApi = {
  dashboard: () => apiRequest("/hrms/dashboard"),
  employees: (p = {}) => apiRequest(`/hrms/employees?${buildQs(p)}`),
  employeeDetail: (id) => {
    const safeId = _guard(id, "employee id");
    if (!safeId) return _noRecord();
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
    if (!safeId) return _noRecord();
    return apiRequest("/platform/api-keys/" + safeId, { method: "DELETE" });
  },
  webhooks: () => apiRequest("/platform/webhooks"),
  createWebhook: (input) => apiRequest("/platform/webhooks", { method: "POST", body: JSON.stringify(input) }),
  deleteWebhook: (id) => {
    const safeId = _guard(id, "webhook id");
    if (!safeId) return _noRecord();
    return apiRequest("/platform/webhooks/" + safeId, { method: "DELETE" });
  },
  testWebhook: (input) => apiRequest("/platform/webhooks/test", { method: "POST", body: JSON.stringify(input) }),
  events: () => apiRequest("/platform/events"),
  exportData: (mod, fmt) => apiRequest("/platform/export", { method: "POST", body: JSON.stringify({ module: mod, format: fmt }) }),
};

// ─── Supplier Portal ─────────────────────────────────────────────────────────

export const supplierPortalApi = {
  dashboard: (p) => apiRequest("/supplier-portal/dashboard?" + buildQs(p)),
  purchaseOrders: (p) => apiRequest("/supplier-portal/purchase-orders?" + buildQs(p)),
  invoices: (p) => apiRequest("/supplier-portal/invoices?" + buildQs(p)),
  payments: (p) => apiRequest("/supplier-portal/payments?" + buildQs(p)),
  vendors: () => apiRequest("/supplier-portal/vendors"),
};

// ─── EAM (Enterprise Asset Management) ─────────────────────────────────────────

// ─── HRMS ──────────────────────────────────────────────────────────────────────

// ─── WMS (Warehouse Management) ───────────────────────────────────────────────

export const wmsApi = {
  dashboard: () => apiRequest("/wms/dashboard"),
  warehouseDetail: (id) => {
    const safeId = _guard(id, "warehouse id");
    if (!safeId) return _noRecord();
    return apiRequest(`/wms/warehouses/${safeId}`);
  },
  locations: (p = {}) => apiRequest(`/wms/locations?${buildQs(p)}`),
  createLocation: (input) => apiRequest("/wms/locations", { method: "POST", body: JSON.stringify(input) }),
  movements: (p = {}) => apiRequest(`/wms/movements?${buildQs(p)}`),
};

// ─── Manufacturing ────────────────────────────────────────────────────────────

export const manufacturingApi = {
  access: () => apiRequest("/manufacturing/access"),
  dashboard: () => apiRequest("/manufacturing/dashboard"),
  analytics: () => apiRequest("/manufacturing/analytics"),

  // BOMs
  boms: (p = {}) => apiRequest(`/manufacturing/boms?${buildQs(p)}`),
  getBom: (id) => {
    const safeId = _guard(id, "BOM id");
    if (!safeId) return _noRecord();
    return apiRequest(`/manufacturing/boms/${safeId}`);
  },
  createBom: (input) => apiRequest("/manufacturing/boms", { method: "POST", body: JSON.stringify(input) }),
  deleteBom: (id) => {
    const safeId = _guard(id, "BOM id");
    if (!safeId) return _noRecord();
    return apiRequest(`/manufacturing/boms/${safeId}`, { method: "DELETE" });
  },

  // Production Orders
  productionOrders: (p = {}) => apiRequest(`/manufacturing/production-orders?${buildQs(p)}`),
  getProductionOrder: (id) => {
    const safeId = _guard(id, "production order id");
    if (!safeId) return _noRecord();
    return apiRequest(`/manufacturing/production-orders/${safeId}`);
  },
  createProductionOrder: (input) => apiRequest("/manufacturing/production-orders", { method: "POST", body: JSON.stringify(input) }),
  updateProductionOrderStatus: (id, input) => {
    const safeId = _guard(id, "production order id");
    if (!safeId) return _noRecord();
    return apiRequest(`/manufacturing/production-orders/${safeId}/status`, { method: "PATCH", body: JSON.stringify(input) });
  },

  // Work Orders
  workOrders: (p = {}) => apiRequest(`/manufacturing/work-orders?${buildQs(p)}`),
  createWorkOrder: (input) => apiRequest("/manufacturing/work-orders", { method: "POST", body: JSON.stringify(input) }),
  completeWorkOrder: (id, input) => {
    const safeId = _guard(id, "work order id");
    if (!safeId) return _noRecord();
    return apiRequest(`/manufacturing/work-orders/${safeId}/complete`, { method: "PATCH", body: JSON.stringify(input) });
  },

  // Machines
  machines: (p = {}) => apiRequest(`/manufacturing/machines?${buildQs(p)}`),
  createMachine: (input) => apiRequest("/manufacturing/machines", { method: "POST", body: JSON.stringify(input) }),
  updateMachineStatus: (id, status) => {
    const safeId = _guard(id, "machine id");
    if (!safeId) return _noRecord();
    return apiRequest(`/manufacturing/machines/${safeId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  },

  // Maintenance
  maintenance: (p = {}) => apiRequest(`/manufacturing/maintenance?${buildQs(p)}`),
  createMaintenance: (input) => apiRequest("/manufacturing/maintenance", { method: "POST", body: JSON.stringify(input) }),
  completeMaintenance: (id, input) => {
    const safeId = _guard(id, "maintenance id");
    if (!safeId) return _noRecord();
    return apiRequest(`/manufacturing/maintenance/${safeId}/complete`, { method: "PATCH", body: JSON.stringify(input) });
  },

  // Quality
  qualityChecks: (p = {}) => apiRequest(`/manufacturing/quality-checks?${buildQs(p)}`),
  createQualityCheck: (input) => apiRequest("/manufacturing/quality-checks", { method: "POST", body: JSON.stringify(input) }),
};

// ─── Legacy (kept for backward compat with OperationsPage) ───────────────────

export const operationsApi = {
  list: (resource) => {
    // Map old resource names to new endpoints
    if (resource === "purchase") return purchaseApi.purchaseOrders();
    if (resource === "accounts") return accountsApi.journalEntries();
    return apiRequest(`/${resource}/records`);
  },
  create: (resource, input) => {
    if (resource === "purchase") return purchaseApi.createPurchaseOrder(input);
    return apiRequest(`/${resource}/records`, { method: "POST", body: JSON.stringify(input) });
  },
  remove: (resource, id) => {
    const safeId = _guard(id, "record id");
    if (!safeId) return _noRecord();
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
