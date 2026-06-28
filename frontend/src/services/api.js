export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
export const hasApiBaseUrl = Boolean(API_BASE_URL);

export async function apiRequest(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error("Backend API is not connected for this deployment.");
  }

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
    throw new Error(payload.message || "Request failed");
  }
  return payload;
}

export function login(input) {
  return apiRequest("/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export function getDashboardKpis() {
  return apiRequest("/dashboard/kpis");
}
