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
import { SalesPage } from "./pages/sales/SalesPage";
import { PurchasePage } from "./pages/purchase/PurchasePage";
import { InventoryPage } from "./pages/inventory/InventoryPage";
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
