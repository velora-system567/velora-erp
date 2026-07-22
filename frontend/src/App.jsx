import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import { AuditLogPage } from "./pages/core/AuditLogPage";
import { CompanyPage } from "./pages/core/CompanyPage";
import { CorePage } from "./pages/core/CorePage";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { SalesPage } from "./pages/sales/SalesPage";
import { PurchasePage } from "./pages/purchase/PurchasePage";
import { InventoryPage } from "./pages/inventory/InventoryPage";
import ProductsPage from "./pages/inventory/ProductsPage";
import ReportsPage from "./pages/inventory/ReportsPage";
import SuppliersPage from "./pages/inventory/SuppliersPage";
import { AccountsPage } from "./pages/accounts/AccountsPage";
import { ManufacturingPage } from "./pages/manufacturing/ManufacturingPage";

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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/company" element={<CompanyPage />} />
              <Route path="/branches" element={<CorePage resource="branches" />} />
              <Route path="/users" element={<CorePage resource="users" />} />
              <Route path="/products" element={<CorePage resource="products" />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/purchase" element={<PurchasePage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/inventory/products" element={<ProductsPage />} />
              <Route path="/inventory/reports" element={<ReportsPage />} />
              <Route path="/inventory/suppliers" element={<SuppliersPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/manufacturing" element={<ManufacturingPage />} />
              <Route path="/activity" element={<AuditLogPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
