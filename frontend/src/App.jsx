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
import { PlaceholderPage } from "./pages/PlaceholderPage";

const queryClient = new QueryClient();

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
            <Route path="/sales" element={<PlaceholderPage title="Sales" description="Create leads, quotations, sales orders, delivery challans, GST invoices, and payment receipts." action="Create Quotation" />} />
            <Route path="/purchase" element={<PlaceholderPage title="Purchase" description="Create purchase enquiries, purchase orders, GRNs, vendor bills, and payment records." action="Create Purchase Order" />} />
            <Route path="/inventory" element={<PlaceholderPage title="Inventory" description="Track stock ledger, stock transfers, adjustments, low-stock alerts, and valuation." action="Add Opening Stock" />} />
            <Route path="/accounts" element={<PlaceholderPage title="Accounts" description="View trial balance, profit and loss, balance sheet, GST summaries, ledgers, and aging reports." action="Open Reports" />} />
            <Route path="/activity" element={<AuditLogPage />} />
          </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
