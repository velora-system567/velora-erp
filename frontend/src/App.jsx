import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Login } from "./pages/auth/Login";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { PlaceholderPage } from "./pages/PlaceholderPage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="*"
            element={
              <AppShell>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/master" element={<PlaceholderPage title="Master Data" description="Create items, customers, vendors, tax rates, warehouses, and price lists." action="Add Master Record" />} />
                  <Route path="/sales" element={<PlaceholderPage title="Sales" description="Create leads, quotations, sales orders, delivery challans, GST invoices, and payment receipts." action="Create Quotation" />} />
                  <Route path="/purchase" element={<PlaceholderPage title="Purchase" description="Create purchase enquiries, purchase orders, GRNs, vendor bills, and payment records." action="Create Purchase Order" />} />
                  <Route path="/inventory" element={<PlaceholderPage title="Inventory" description="Track stock ledger, stock transfers, adjustments, low-stock alerts, and valuation." action="Add Opening Stock" />} />
                  <Route path="/accounts" element={<PlaceholderPage title="Accounts" description="View trial balance, profit and loss, balance sheet, GST summaries, ledgers, and aging reports." action="Open Reports" />} />
                  <Route path="/activity" element={<PlaceholderPage title="Activity" description="Audit logs will appear after users create, update, delete, import, export, or approve records." action="" />} />
                </Routes>
              </AppShell>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
