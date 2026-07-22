import { Navigate, Outlet } from "react-router-dom";

/**
 * Decodes a JWT payload (not verifying signature — just reading expiry).
 */
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function ProtectedRoute() {
  const token = localStorage.getItem("velora_access_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const expiry = getTokenExpiry(token);
  if (expiry && Date.now() >= expiry) {
    // Token expired — clear and redirect
    localStorage.removeItem("velora_access_token");
    localStorage.removeItem("velora_refresh_token");
    localStorage.removeItem("velora_user");
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
