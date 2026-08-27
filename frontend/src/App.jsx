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
import GoogleCallback from "./pages/auth/GoogleCallback";
import TwoFactorVerify from "./pages/auth/TwoFactorVerify";
import { AuditLogPage } from "./pages/core/AuditLogPage";
import { CompanyPage } from "./pages/core/CompanyPage";
import { CorePage } from "./pages/core/CorePage";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { SalesPage } from "./pages/sales/SalesPage";
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
import SecuritySettingsPage from "./pages/settings/SecuritySettingsPage";

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
          <Route path="/auth/google/callback" element={<RouteErrorBoundary><GoogleCallback /></RouteErrorBoundary>} />
          <Route path="/verify-2fa" element={<RouteErrorBoundary><TwoFactorVerify /></RouteErrorBoundary>} />
          <Route path="/register" element={<RouteErrorBoundary><Register /></RouteErrorBoundary>} />
          <Route path="/forgot-password" element={<RouteErrorBoundary><ForgotPassword /></RouteErrorBoundary>} />
          <Route path="/reset-password" element={<RouteErrorBoundary><ResetPassword /></RouteErrorBoundary>} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              {/* Every module route is wrapped in a PermissionGuard that mirrors the
                  exact permission key the BACKEND enforces for that module. Without
                  this, direct navigation to a module the user cannot access renders
                  the page and 403s every API call, producing a permanent, non-
                  recoverable "Something went wrong" error state. */}
              <Route element={<PermissionGuard module="dashboard" requiredPermission="dashboard:view" />}>
                <Route path="/" element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="company" requiredPermission="company:view" />}>
                <Route path="/company" element={<RouteErrorBoundary><CompanyPage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="branches" requiredPermission="branches:view" />}>
                <Route path="/branches" element={<RouteErrorBoundary><CorePage resource="branches" /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="users" requiredPermission="users:view" />}>
                <Route path="/users" element={<RouteErrorBoundary><CorePage resource="users" /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="products" requiredPermission="products:view" />}>
                <Route path="/products" element={<RouteErrorBoundary><CorePage resource="products" /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="sales" requiredPermission="sales:view" />}>
                <Route path="/sales" element={<RouteErrorBoundary><SalesPage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="purchase" requiredPermission="purchase:view" />}>
                <Route path="/purchase" element={<RouteErrorBoundary><PurchasePage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="inventory" requiredPermission="inventory:view" />}>
                <Route path="/inventory" element={<RouteErrorBoundary><InventoryPage /></RouteErrorBoundary>} />
                <Route path="/inventory/products" element={<RouteErrorBoundary><ProductsPage /></RouteErrorBoundary>} />
                <Route path="/inventory/reports" element={<RouteErrorBoundary><ReportsPage /></RouteErrorBoundary>} />
                <Route path="/inventory/suppliers" element={<RouteErrorBoundary><SuppliersPage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="accounts" requiredPermission="accounts:view" />}>
                <Route path="/accounts" element={<RouteErrorBoundary><AccountsPage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="manufacturing" requiredPermission="manufacturing:view" />}>
                <Route path="/manufacturing" element={<RouteErrorBoundary><ManufacturingPage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="crm" requiredPermission="crm:view" />}>
                <Route path="/crm" element={<RouteErrorBoundary><CrmPage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="wms" requiredPermission="wms:view" />}>
                <Route path="/wms" element={<RouteErrorBoundary><WmsPage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="reports" requiredPermission="reports:view" />}>
                <Route path="/executive" element={<RouteErrorBoundary><ExecutiveDashboard /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="hrms" requiredPermission="hr:view" />}>
                <Route path="/hrms" element={<RouteErrorBoundary><HrmsPage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="eam" requiredPermission="eam:view" />}>
                <Route path="/eam" element={<RouteErrorBoundary><EamPage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="supplier-portal" requiredPermission="purchase:view" />}>
                <Route path="/supplier-portal" element={<RouteErrorBoundary><SupplierPortalPage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="audit" requiredPermission="audit:view" />}>
                <Route path="/activity" element={<RouteErrorBoundary><AuditLogPage /></RouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionGuard module="settings" requiredPermission="settings:view" />}>
                <Route path="/settings" element={<RouteErrorBoundary><SettingsPage /></RouteErrorBoundary>} />
                <Route path="/settings/security" element={<RouteErrorBoundary><SecuritySettingsPage /></RouteErrorBoundary>} />
              </Route>
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
