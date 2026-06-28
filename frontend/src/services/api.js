export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export const hasApiBaseUrl = Boolean(API_BASE_URL);

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("velora_access_token");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const issues = payload.data?.issues;
    const issueText = Array.isArray(issues)
      ? issues.map((issue) => `${issue.path?.slice(1).join(".") || "Field"}: ${issue.message}`).join("\n")
      : "";
    throw new Error(issueText || payload.message || "Request failed");
  }
  return payload;
}

export function login(input) {
  return apiRequest("/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export function registerTenant(input) {
  return apiRequest("/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export function getDashboardKpis() {
  return apiRequest("/dashboard/kpis");
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
