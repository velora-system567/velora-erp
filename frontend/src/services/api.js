const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

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
