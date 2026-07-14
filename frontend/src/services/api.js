export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export const hasApiBaseUrl = Boolean(API_BASE_URL);

function clearStoredSession() {
  localStorage.removeItem("velora_access_token");
  localStorage.removeItem("velora_refresh_token");
  localStorage.removeItem("velora_user");
}

function storeRefreshedSession(payload) {
  if (payload.accessToken) localStorage.setItem("velora_access_token", payload.accessToken);
  if (payload.user) localStorage.setItem("velora_user", JSON.stringify(payload.user));
}

async function parsePayload(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function errorFromPayload(payload, fallback = "Request failed") {
  const issues = payload.data?.issues;
  const issueText = Array.isArray(issues)
    ? issues.map((issue) => `${issue.path?.slice(1).join(".") || "Field"}: ${issue.message}`).join("\n")
    : "";
  return new Error(issueText || payload.message || fallback);
}

async function refreshAccessToken() {
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
    const newToken = await refreshAccessToken();
    if (newToken) return apiRequest(path, options, false);
    clearStoredSession();
    if (!["/login", "/register"].includes(window.location.pathname)) {
      window.location.href = "/login";
    }
    throw new Error("Your session expired. Please login again.");
  }

  if (!response.ok || !payload.success) {
    throw errorFromPayload(payload);
  }
  return payload;
}

export function login(input) {
  return apiRequest("/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export function registerTenant(input) {
  return apiRequest("/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export function requestOtp(input) {
  return apiRequest("/auth/request-otp", { method: "POST", body: JSON.stringify(input) });
}

export function getDashboardKpis() {
  return apiRequest("/dashboard/kpis");
}

export function getSalesChart() {
  return apiRequest("/dashboard/sales-chart");
}

export const coreApi = {
  company: () => apiRequest("/company"),
  updateCompany: (input) => apiRequest("/company", { method: "PATCH", body: JSON.stringify(input) }),
  list: (resource) => apiRequest(`/${resource}`),
  create: (resource, input) => apiRequest(`/${resource}`, { method: "POST", body: JSON.stringify(input) }),
  update: (resource, id, input) => apiRequest(`/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (resource, id) => apiRequest(`/${resource}/${id}`, { method: "DELETE" }),
  resetPassword: (id, password) => apiRequest(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
  disableUser: (id) => apiRequest(`/users/${id}/disable`, { method: "POST" }),
  auditLogs: () => apiRequest("/audit-logs"),
};

export const operationsApi = {
  list: (resource) => apiRequest(`/${resource}/records`),
  create: (resource, input) => apiRequest(`/${resource}/records`, { method: "POST", body: JSON.stringify(input) }),
  remove: (resource, id) => apiRequest(`/${resource}/records/${id}`, { method: "DELETE" }),
};

export const procurementApi = {
  // Purchase Requests
  getRequests: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiRequest(`/purchase/requests?${params}`);
  },
  getRequest: (id) => apiRequest(`/purchase/requests/${id}`),
  createRequest: (input) => apiRequest("/purchase/requests", { method: "POST", body: JSON.stringify(input) }),
  updateRequest: (id, input) => apiRequest(`/purchase/requests/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteRequest: (id) => apiRequest(`/purchase/requests/${id}`, { method: "DELETE" }),
  submitRequest: (id) => apiRequest(`/purchase/requests/${id}/submit`, { method: "POST" }),
  updateRequestStatus: (id, status, remarks) => apiRequest(`/purchase/requests/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, remarks }) }),
  
  // Dashboard KPIs
  getKpis: () => apiRequest("/purchase/dashboard/kpis"),
  
  // Purchase Orders
  getOrders: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiRequest(`/purchase/orders?${params}`);
  },
  getOrder: (id) => apiRequest(`/purchase/orders/${id}`),
  createOrder: (input) => apiRequest("/purchase/orders", { method: "POST", body: JSON.stringify(input) }),
  updateOrder: (id, input) => apiRequest(`/purchase/orders/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteOrder: (id) => apiRequest(`/purchase/orders/${id}`, { method: "DELETE" }),
  
  // Vendors
  getVendors: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiRequest(`/purchase/vendors?${params}`);
  },
  getVendor: (id) => apiRequest(`/purchase/vendors/${id}`),
  createVendor: (input) => apiRequest("/purchase/vendors", { method: "POST", body: JSON.stringify(input) }),
  updateVendor: (id, input) => apiRequest(`/purchase/vendors/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteVendor: (id) => apiRequest(`/purchase/vendors/${id}`, { method: "DELETE" }),
};

export const leadsApi = {
  list: () => apiRequest("/leads"),
  create: (input) => apiRequest("/leads", { method: "POST", body: JSON.stringify(input) }),
  update: (id, input) => apiRequest(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id) => apiRequest(`/leads/${id}`, { method: "DELETE" }),
};
