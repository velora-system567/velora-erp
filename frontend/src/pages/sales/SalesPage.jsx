/**
 * Sales Module — Velora ERP
 *
 * Tabs:
 *  - Dashboard  : KPI cards + revenue chart + top customers/products
 *  - Leads      : Lead management (create, edit, delete)
 *  - Quotations : Quotation list + create + convert to order
 *  - Orders     : Sales order list + status
 *  - Delivery   : Delivery notes (stock debit)
 *  - Invoices   : Tax invoices (journal posted)
 *  - Receipts   : Payment receipts (journal posted)
 */
import { useState, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, BarChart3, ClipboardList, CreditCard, FileText, Inbox,
  IndianRupee, RefreshCw, ShoppingCart, TrendingUp, Truck, UserPlus, Users,
} from "lucide-react";
import { AddButton, PageHeader, SecondaryButton } from "../../components/PageHeader";
import { ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { coreApi, salesApi } from "../../services/api";
import { formatRupees, formatRupeesCompact } from "../../utils/money";
import { businessDocumentStatusLabel } from "../../utils/format";
import DashboardTab from "./components/DashboardTab";
import LeadsTab from "./components/LeadsTab";
import DocumentsTab from "./components/DocumentsTab";
import ReceiptsTab from "./components/ReceiptsTab";

const TABS = [
  ["Dashboard", ShoppingCart, "KPIs & analytics"],
  ["Leads", UserPlus, "Prospects & follow-ups"],
  ["Quotations", FileText, "Price quotes"],
  ["Orders", ClipboardList, "Sales orders"],
  ["Delivery", Truck, "Delivery notes"],
  ["Invoices", Inbox, "Tax invoices"],
  ["Receipts", CreditCard, "Payment receipts"],
];

const TAB_NAMES = TABS.map(([name]) => name);

export function SalesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Tab state lives in the URL (?tab=Orders) so deep links from the dashboard,
  // direct navigation and browser refresh all land on the same tab.
  const tabParam = searchParams.get("tab");
  const tab = TAB_NAMES.includes(tabParam) ? tabParam : "Dashboard";
  const setTab = (name) => setSearchParams(name === "Dashboard" ? {} : { tab: name }, { replace: true });

  // "Add" buttons navigate to /sales with an intent in location.state.
  // Each click carries a unique ts so a closed form can be re-opened by
  // clicking Add again (the child tabs react to openFormSignal changes).
  const intent = location.state || {};
  const intentTs = Number(intent.ts) || 0;
  const docFormSignal = (docType) => (intent.openDocForm && intent.docType === docType ? intentTs : 0);
  const stayPath = () => {
    const s = searchParams.toString();
    return s ? `/sales?${s}` : "/sales";
  };

  const masters = useQuery({
    queryKey: ["sales-masters"],
    queryFn: async () => {
      const [custRes, itemRes] = await Promise.allSettled([
        coreApi.list("customers", { limit: 100 }),
        coreApi.list("items", { limit: 100 }),
      ]);
      return {
        customers: custRes.status === "fulfilled" ? (custRes.value.data || []) : [],
        items: itemRes.status === "fulfilled" ? (itemRes.value.data || []) : [],
        customersError: custRes.status === "rejected",
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const customers = masters.data?.customers || [];
  const items = masters.data?.items || [];

  const renderTab = () => {
    switch (tab) {
      case "Dashboard":
        return <DashboardTab />;
      case "Leads":
        return <LeadsTab customers={customers} openFormSignal={intent.openLeadForm ? intentTs : 0} />;
      case "Quotations":
        return <DocumentsTab docType="QUOTATION" label="Quotation" customers={customers} items={items} openFormSignal={docFormSignal("QUOTATION")} onConvertToOrder={(id) => salesApi.convertQuotationToOrder(id)} />;
      case "Orders":
        return <DocumentsTab docType="SALES_ORDER" label="Sales Order" customers={customers} items={items} openFormSignal={docFormSignal("SALES_ORDER")} />;
      case "Delivery":
        return <DocumentsTab docType="DELIVERY_NOTE" label="Delivery Note" customers={customers} items={items} openFormSignal={docFormSignal("DELIVERY_NOTE")} />;
      case "Invoices":
        return <DocumentsTab docType="INVOICE" label="Invoice" customers={customers} items={items} openFormSignal={docFormSignal("INVOICE")} />;
      case "Receipts":
        return <ReceiptsTab customers={customers} openFormSignal={intent.openReceiptForm ? intentTs : 0} />;
      default:
        return null;
    }
  };

  const getAddLabel = () => {
    switch (tab) {
      case "Leads": return "Add lead";
      case "Quotations": return "New quotation";
      case "Orders": return "New order";
      case "Delivery": return "New delivery note";
      case "Invoices": return "New invoice";
      case "Receipts": return "Record receipt";
      default: return "Add";
    }
  };

  const onAdd = () => {
    const ts = Date.now();
    if (tab === "Leads") return navigate(stayPath(), { state: { openLeadForm: true, ts } });
    if (tab === "Receipts") return navigate(stayPath(), { state: { openReceiptForm: true, ts } });
    return navigate(stayPath(), { state: { openDocForm: true, docType: tab.toUpperCase(), ts } });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader
        title="Sales"
        description="Manage leads, quotations, orders, deliveries, invoices, and receipts in one workflow."
        actions={
          <>
            <SecondaryButton
              label="Refresh"
              icon={RefreshCw}
              onClick={() => qc.invalidateQueries({ queryKey: ["sales"] })}
            />
            {tab !== "Dashboard" && <AddButton label={getAddLabel()} onClick={onAdd} />}
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Sales workspace" className="flex min-w-0 gap-1 overflow-x-auto">
          {TABS.map(([name, Icon, hint]) => (
            <button
              role="tab"
              aria-selected={tab === name}
              key={name}
              onClick={() => setTab(name)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${
                tab === name ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2 lg:justify-end">
          {tab !== "Dashboard" && (
            <>
              <label className="relative min-w-0 flex-1 lg:max-w-xs">
                <AlertCircle aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
                <input
                  aria-label="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${tab.toLowerCase()}…`}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <select
                aria-label="Filter status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 max-w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">All statuses</option>
                {["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED", "CLOSED"].map((s) => (
                  <option key={s} value={s}>{businessDocumentStatusLabel(s)}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">{TABS.find(([n]) => n === tab)?.[2]}</p>
      {renderTab()}
    </div>
  );
}

export default SalesPage;
