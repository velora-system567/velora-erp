import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { KeyboardShortcutProvider } from "./components/KeyboardShortcutProvider";
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
import OwnerDashboard from "./pages/sales/OwnerDashboard";
import { AdminPage } from "./pages/admin/AdminPage";
import { PermissionGuard } from "./components/PermissionGuard";
import { AccessDenied } from "./components/AccessDenied";
import { PurchasePage } from "./pages/purchase/PurchasePage";
import { InventoryPage } from "./pages/inventory/InventoryPage";
import ProductsPage from "./pages/inventory/ProductsPage";
import ReportsPage from "./pages/inventory/ReportsPage";
import SuppliersPage from "./pages/inventory/SuppliersPage";
import { AccountsPage } from "./pages/accounts/AccountsPage";
import { ManufacturingPage } from "./pages/manufacturing/ManufacturingPage";
import { CrmPage } from "./pages/crm/CrmPage";
import { WmsPage } from "./pages/wms/WmsPage";
import ExecutiveDashboard from "./pages/bi/ExecutiveDashboard";
import { HrmsPage } from "./pages/hrms/HrmsPage";
import { SupplierPortalPage } from "./pages/supplier-portal/SupplierPortalPage";
import { EamPage } from "./pages/eam/EamPage";
import SettingsPage from "./pages/settings/SettingsPage";

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
        <KeyboardShortcutProvider>
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
              <Route path="/sales/dashboard" element={<OwnerDashboard />} />
              <Route path="/purchase" element={<PurchasePage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/inventory/products" element={<ProductsPage />} />
              <Route path="/inventory/reports" element={<ReportsPage />} />
              <Route path="/inventory/suppliers" element={<SuppliersPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/manufacturing" element={<ManufacturingPage />} />
              <Route path="/crm" element={<CrmPage />} />
              <Route path="/wms" element={<WmsPage />} />
              <Route path="/executive" element={<ExecutiveDashboard />} />
              <Route path="/hrms" element={<HrmsPage />} />
              <Route path="/eam" element={<EamPage />} />
              <Route path="/supplier-portal" element={<SupplierPortalPage />} />
              <Route path="/activity" element={<AuditLogPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route element={<PermissionGuard module="admin" requiredPermission="admin:view" />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
              <Route path="/access-denied" element={<AccessDenied />} />
            </Route>
          </Route>
          </Routes>
        </KeyboardShortcutProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
