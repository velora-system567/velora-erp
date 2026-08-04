import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { KeyboardShortcutProvider } from "./components/KeyboardShortcutProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
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
          <Route path="/login" element={<RouteErrorBoundary><Login /></RouteErrorBoundary>} />
          <Route path="/register" element={<RouteErrorBoundary><Register /></RouteErrorBoundary>} />
          <Route path="/forgot-password" element={<RouteErrorBoundary><ForgotPassword /></RouteErrorBoundary>} />
          <Route path="/reset-password" element={<RouteErrorBoundary><ResetPassword /></RouteErrorBoundary>} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
              <Route path="/company" element={<RouteErrorBoundary><CompanyPage /></RouteErrorBoundary>} />
              <Route path="/branches" element={<RouteErrorBoundary><CorePage resource="branches" /></RouteErrorBoundary>} />
              <Route path="/users" element={<RouteErrorBoundary><CorePage resource="users" /></RouteErrorBoundary>} />
              <Route path="/products" element={<RouteErrorBoundary><CorePage resource="products" /></RouteErrorBoundary>} />
              <Route path="/sales" element={<RouteErrorBoundary><SalesPage /></RouteErrorBoundary>} />
              <Route path="/sales/dashboard" element={<RouteErrorBoundary><OwnerDashboard /></RouteErrorBoundary>} />
              <Route path="/purchase" element={<RouteErrorBoundary><PurchasePage /></RouteErrorBoundary>} />
              <Route path="/inventory" element={<RouteErrorBoundary><InventoryPage /></RouteErrorBoundary>} />
              <Route path="/inventory/products" element={<RouteErrorBoundary><ProductsPage /></RouteErrorBoundary>} />
              <Route path="/inventory/reports" element={<RouteErrorBoundary><ReportsPage /></RouteErrorBoundary>} />
              <Route path="/inventory/suppliers" element={<RouteErrorBoundary><SuppliersPage /></RouteErrorBoundary>} />
              <Route path="/accounts" element={<RouteErrorBoundary><AccountsPage /></RouteErrorBoundary>} />
              <Route path="/manufacturing" element={<RouteErrorBoundary><ManufacturingPage /></RouteErrorBoundary>} />
              <Route path="/crm" element={<RouteErrorBoundary><CrmPage /></RouteErrorBoundary>} />
              <Route path="/wms" element={<RouteErrorBoundary><WmsPage /></RouteErrorBoundary>} />
              <Route path="/executive" element={<RouteErrorBoundary><ExecutiveDashboard /></RouteErrorBoundary>} />
              <Route path="/hrms" element={<RouteErrorBoundary><HrmsPage /></RouteErrorBoundary>} />
              <Route path="/eam" element={<RouteErrorBoundary><EamPage /></RouteErrorBoundary>} />
              <Route path="/supplier-portal" element={<RouteErrorBoundary><SupplierPortalPage /></RouteErrorBoundary>} />
              <Route path="/activity" element={<RouteErrorBoundary><AuditLogPage /></RouteErrorBoundary>} />
              <Route path="/settings" element={<RouteErrorBoundary><SettingsPage /></RouteErrorBoundary>} />
              <Route element={<PermissionGuard module="admin" requiredPermission="admin:view" />}>
                <Route path="/admin" element={<RouteErrorBoundary><AdminPage /></RouteErrorBoundary>} />
              </Route>
              <Route path="/access-denied" element={<RouteErrorBoundary><AccessDenied /></RouteErrorBoundary>} />
            </Route>
          </Route>
          </Routes>
        </KeyboardShortcutProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
