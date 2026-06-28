import { Navigate, Outlet } from "react-router-dom";

export function ProtectedRoute() {
  const token = localStorage.getItem("velora_access_token");
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
