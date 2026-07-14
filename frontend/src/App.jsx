import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { AuditLogPage } from "./pages/core/AuditLogPage";
import { CompanyPage } from "./pages/core/CompanyPage";
import { CorePage } from "./pages/core/CorePage";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { OperationsPage } from "./pages/operations/OperationsPage";
import { SalesPage } from "./pages/sales/SalesPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ProcurementDashboard } from "./pages/procurement/ProcurementDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/company" element={<CompanyPage />} />
            <Route path="/branches" element={<CorePage resource="branches" />} />
            <Route path="/users" element={<CorePage resource="users" />} />
            <Route path="/products" element={<CorePage resource="products" />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/purchase" element={<OperationsPage resource="purchase" />} />
            <Route path="/inventory" element={<PlaceholderPage title="Inventory" description="Track stock ledger, stock transfers, adjustments, low-stock alerts, and valuation." action="Add Opening Stock" />} />
            <Route path="/accounts" element={<OperationsPage resource="accounts" />} />
            <Route path="/activity" element={<AuditLogPage />} />
          </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
