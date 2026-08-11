/**
 * Velora ERP — Sales Management Module
 *
 * A comprehensive sales management interface with Leads, Quotations,
 * Sales Orders, Invoices, and Payment Receipts.
 *
 * Features:
 * - Professional filter bar per tab (sticky)
 * - Quick filter chips (Today, This Week, Pending, etc.)
 * - Enhanced table with sorting, grouping, selection
 * - Bulk actions, export, column filters
 * - Save/load filter presets
 * - Table footer with totals
 * - Responsive design
 * - Skeleton loading, empty states, error states
 */
import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import {
  BarChart3, DollarSign, FileText, Plus, RefreshCw,
  ShoppingCart, TrendingUp, Truck, Users, X, CheckCircle2,
} from "lucide-react";
import { salesApi } from "../../services/api";
import { formatRupees } from "../../utils/money";
import { ErrorBanner, ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import LiveIndicator from "../../components/LiveIndicator";
import { AddButton, PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { Card, SectionHeader, KpiTile, date, exportCsv } from "../inventory/components/shared";
import { StatusBadge } from "./components/StatusBadge";
import FilterBar from "./components/FilterBar";
import SalesTable from "./components/SalesTable";
import QuickFilters from "./components/QuickFilters";
import SavedFilters from "./components/SavedFilters";
import BulkActions from "./components/BulkActions";
import { useSalesFilters } from "./hooks/useSalesFilters";
import {
  useSalesMasters, useSalesDashboard,
  useLeads, useCreateLead, useUpdateLead, useDeleteLead,
  useQuotations, useCreateQuotation, useConvertQuotation,
  useSalesOrders,
  useInvoices,
  useReceipts, useCreateReceipt,
} from "./hooks/useSalesData";

// ─── Tab configuration ───────────────────────────────────────────────────────

const TABS = [
  ["dashboard", BarChart3, "KPIs & charts"],
  ["leads", Users, "Lead management"],
  ["quotations", FileText, "Quotations"],
  ["orders", ShoppingCart, "Sales orders"],
  ["invoices", DollarSign, "Invoices"],
  ["receipts", Truck, "Payment receipts"],
];

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "CLOSED", label: "Closed" },
];

// ─── Main Sales Page ─────────────────────────────────────────────────────────

export function SalesPage() {
  const qc = useQueryClient();
  const location = useLocation();
  // Seed tab from a KPI drill-down (navigate('/sales', { state: { tab } })) if provided.
  const [tab, setTab] = useState(() => location.state?.tab || localStorage.getItem("sales_tab") || "dashboard");
  const switchTab = useCallback((t) => {
    setTab(t);
    localStorage.setItem("sales_tab", t);
  }, []);

  // Masters
  const masters = useSalesMasters();
  const customers = masters.data?.customers || [];
  const items = masters.data?.items || [];
  const users = masters.data?.users || [];
  const branches = masters.data?.branches || [];
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader
        title="Sales Management"
        description="Leads, quotations, orders, invoices, and collections."
        actions={
          <SecondaryButton
            label="Refresh"
            icon={RefreshCw}
            onClick={() => qc.invalidateQueries({ queryKey: ["sales"] })}
          />
        }
      />

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map(([key, Icon, hint]) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all
              ${tab === key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
              }`}
          >
            <Icon size={16} />
            {key === "dashboard" ? "Dashboard" : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {/* Active tab */}
      {tab === "dashboard" && (
        <DashboardTab customers={customers} onJump={switchTab} />
      )}
      {tab === "leads" && (
        <LeadsTab customers={customers} users={users} branches={branches} />
      )}
      {tab === "quotations" && (
        <QuotationsTab customerMap={customerMap} userMap={userMap} branchMap={branchMap} items={items} customers={customers} users={users} branches={branches} />
      )}
      {tab === "orders" && (
        <SalesOrdersTab customerMap={customerMap} userMap={userMap} branchMap={branchMap} customers={customers} users={users} branches={branches} />
      )}
      {tab === "invoices" && (
        <InvoicesTab customerMap={customerMap} userMap={userMap} branchMap={branchMap} customers={customers} users={users} branches={branches} />
      )}
      {tab === "receipts" && (
        <ReceiptsTab customerMap={customerMap} customers={customers} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardTab({ customers, onJump }) {
  const qc = useQueryClient();
  const query = useSalesDashboard(true);

  if (query.isPending) return <div className="space-y-4"><SkeletonCards count={6} /><SkeletonTable rows={5} cols={4} /></div>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["sales-dashboard"] })} />;
  const d = query.data?.data;
  if (!d) return <EmptyState title="No sales data" description="Create invoices to see dashboard insights." />;
  const k = d.kpis || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <LiveIndicator query={query} onRefresh={() => qc.invalidateQueries({ queryKey: ["sales-dashboard"] })} label="Sales" />
        <span className="text-xs text-slate-400">Click a KPI to open its records</span>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiTile label="Total Revenue" value={k.totalRevenue || 0} tone="blue" icon={TrendingUp} formatter={formatRupees} detail={`${k.totalInvoices || 0} invoices · open`} onClick={() => onJump("invoices")} />
        <KpiTile label="Monthly Revenue" value={k.monthlyRevenue || 0} tone="emerald" icon={BarChart3} formatter={formatRupees} detail={`${k.monthlyInvoices || 0} invoices this month`} onClick={() => onJump("invoices")} />
        <KpiTile label="Pending Orders" value={k.pendingSOs || 0} tone="amber" icon={ShoppingCart} detail={`${k.totalSOs || 0} total orders · open`} onClick={() => onJump("orders")} />
        <KpiTile label="Deliveries" value={k.totalDNs || 0} tone="purple" icon={Truck} detail="Delivery notes · open" onClick={() => onJump("orders")} />
        <KpiTile label="Collections" value={k.monthlyCollections || 0} tone="emerald" icon={DollarSign} formatter={formatRupees} detail="This month · open" onClick={() => onJump("receipts")} />
        <KpiTile label="Total Orders" value={k.totalSOs || 0} tone="slate" icon={ShoppingCart} detail="Open orders" onClick={() => onJump("orders")} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Top Customers" description="By invoice value" icon={Users} />
          {d.topCustomers?.length ? d.topCustomers.map((c, i) => (
            <div key={c.id} className="mb-2 flex items-center justify-between rounded-xl border border-slate-100 p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">{i + 1}</span>
                <div>
                  <p className="font-medium text-slate-950">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.orderCount} orders</p>
                </div>
              </div>
              <p className="font-semibold tabular-nums">{formatRupees(c.totalAmount)}</p>
            </div>
          )) : <EmptyState title="No customer data" description="Invoiced customers appear here." />}
        </Card>
        <Card>
          <SectionHeader title="Recent Orders" description="Latest activity" icon={FileText} />
          {d.recentActivity?.length ? d.recentActivity.slice(0, 8).map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-950">{a.documentNo}</p>
                <p className="text-xs text-slate-500">{a.customerName}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={a.status} />
                <p className="mt-0.5 text-xs text-slate-500">{formatRupees(a.totalAmount)}</p>
              </div>
            </div>
          )) : <EmptyState title="No activity" />}
        </Card>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LEADS TAB
// ═══════════════════════════════════════════════════════════════════════════════

const blankLead = {
  name: "", contactPerson: "", phone: "", email: "", city: "",
  source: "REFERENCE", priority: "MEDIUM", status: "NEW",
  value: "", nextFollowUp: "", requirement: "", notes: "",
};

function LeadsTab({ customers, users, branches }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(blankLead);

  const filterHook = useSalesFilters();
  const {
    filters, queryParams, setFilter, resetFilters, activeFilters, removeQuickFilter,
    activeQuickFilter, applyQuickFilter, quickFilters,
    savedFilters, saveFilter, loadFilter, deleteFilter,
    setSearch, searchQuery,
    selectedRows, toggleRow, toggleAll, clearSelection,
    page, setPage, limit, setLimit,
  } = filterHook;

  const query = useLeads(queryParams);
  const leads = query.data?.data || [];
  const meta = query.data?.meta || {};

  const create = useCreateLead();
  const update = useUpdateLead();
  const remove = useDeleteLead();

  const handleBulkAction = useCallback((action) => {
    if (action === "delete") {
      selectedRows.forEach((id) => remove.mutate(id));
      clearSelection();
    }
  }, [selectedRows, remove, clearSelection]);

  const handleExport = useCallback((format) => {
    const rows = leads.map((l) => ({
      "Company": l.name,
      "Contact": l.contactPerson || "",
      "Phone": l.phone || "",
      "Email": l.email || "",
      "Value": formatRupees(l.value),
      "Status": l.status,
      "Priority": l.priority,
      "City": l.city || "",
      "Follow-up": l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleDateString("en-IN") : "",
    }));
    if (format === "csv") {
      exportCsv("leads.csv", rows, Object.keys(rows[0] || {}));
    } else if (format === "print") {
      window.print();
    }
  }, [leads]);

  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["leads"] })} />;

  const leadColumns = [
    { key: "name", label: "Company", sortable: true, sortKey: "name", filterable: true, filterOptions: [...new Set(leads.map((l) => ({ value: l.name, label: l.name })))] },
    { key: "contact", label: "Contact", sortable: false },
    { key: "value", label: "Value", sortable: true, sortKey: "value", className: "text-right", cellClass: "text-right font-semibold tabular-nums" },
    { key: "status", label: "Status", sortable: true, sortKey: "status", filterable: true, filterOptions: [
      { value: "NEW", label: "New" },
      { value: "QUALIFIED", label: "Qualified" },
      { value: "LOST", label: "Lost" },
      { value: "CONVERTED", label: "Converted" },
    ]},
    { key: "priority", label: "Priority", sortable: true, sortKey: "priority" },
    { key: "followup", label: "Follow-up", sortable: true, sortKey: "nextFollowUp" },
    { key: "actions", label: "", className: "text-right w-20", cellClass: "text-right" },
  ];

  const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      {/* Create form */}
      <form
        onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}
        className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Plus size={16} className="text-blue-600" />
          Add Lead
        </h2>
        <div className="mt-4 space-y-3">
          {[
            ["name", "Company Name", "text"],
            ["contactPerson", "Contact Person", "text"],
            ["phone", "Phone", "text"],
            ["email", "Email", "email"],
            ["city", "City", "text"],
            ["value", "Deal Value (₹)", "number"],
            ["nextFollowUp", "Follow-up Date", "date"],
          ].map(([k, label, type]) => (
            <label key={k} className="block text-sm font-medium text-slate-700">
              {label}
              <input
                type={type}
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          ))}
          {[
            ["priority", "Priority", ["LOW", "MEDIUM", "HIGH"]],
            ["status", "Status", ["NEW", "QUALIFIED", "CONVERTED", "LOST"]],
            ["source", "Source", ["REFERENCE", "COLD_CALL", "WEBSITE", "EXHIBITION", "SOCIAL_MEDIA", "OTHER"]],
          ].map(([k, label, opts]) => (
            <label key={k} className="block text-sm font-medium text-slate-700">
              {label}
              <select
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {opts.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
              </select>
            </label>
          ))}
          <label className="block text-sm font-medium text-slate-700">
            Notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>
        </div>
        <ErrorBanner error={create.error} />
        <button
          type="submit"
          disabled={create.isPending}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Plus size={16} />
          {create.isPending ? "Saving..." : "Add Lead"}
        </button>
      </form>

      {/* Leads list */}
      <div className="min-w-0 space-y-3">
        {/* Quick filters */}
        <QuickFilters
          filters={quickFilters}
          activeKey={activeQuickFilter}
          onSelect={applyQuickFilter}
        />

        {/* Filter bar */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearch}
          filters={filters}
          onFilterChange={setFilter}
          onReset={resetFilters}
          customers={customers}
          users={users}
          branches={branches}
          exportData={handleExport}
          activeFilters={activeFilters}
          onRemoveFilter={(key) => {
            if (key === "_quick") removeQuickFilter();
            else setFilter(key, "");
          }}
        />

        {/* Saved filters */}
        <div className="flex items-center justify-between">
          <SavedFilters
            savedFilters={savedFilters}
            onSave={saveFilter}
            onLoad={loadFilter}
            onDelete={deleteFilter}
          />
        </div>

        {/* Table */}
        <SalesTable
          data={leads}
          columns={leadColumns}
          meta={meta}
          loading={query.isPending}
          error={query.error}
          onRetry={() => qc.invalidateQueries({ queryKey: ["leads"] })}
          sortBy={filters.sortBy}
          sortOrder={filters.sortOrder}
          onSort={(sortBy, sortOrder) => {
            setFilter("sortBy", sortBy);
            setFilter("sortOrder", sortOrder);
          }}
          selectedRows={selectedRows}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          showFooter
          totalAmount={totalValue}
          renderRow={(lead) => (
            <>
              <td className="px-4 py-3.5 align-middle font-medium text-slate-950">{lead.name}</td>
              <td className="px-4 py-3.5 align-middle text-sm text-slate-600">
                <div className="flex flex-col">
                  {lead.contactPerson && <span className="font-medium">{lead.contactPerson}</span>}
                  {lead.phone && <span className="text-xs text-slate-400">{lead.phone}</span>}
                </div>
              </td>
              <td className="px-4 py-3.5 align-middle text-right font-semibold tabular-nums">{formatRupees(lead.value)}</td>
              <td className="px-4 py-3.5 align-middle">
                <select
                  value={lead.status}
                  onChange={(e) => update.mutate({ id: lead.id, input: { status: e.target.value } })}
                  className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"
                  onClick={(e) => e.stopPropagation()}
                >
                  {["NEW", "QUALIFIED", "LOST", "CONVERTED"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
              <td className="px-4 py-3.5 align-middle">
                <StatusBadge status={lead.priority} />
              </td>
              <td className="px-4 py-3.5 align-middle text-sm">
                {lead.nextFollowUp ? (
                  <span className={new Date(lead.nextFollowUp) < new Date() ? "font-medium text-rose-600" : "text-slate-600"}>
                    {new Date(lead.nextFollowUp).toLocaleDateString("en-IN")}
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-3.5 align-middle text-right">
                <button
                  onClick={(e) => { e.stopPropagation(); remove.mutate(lead.id); }}
                  className="rounded-lg border border-slate-200 p-2 text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <X size={14} />
                </button>
              </td>
            </>
          )}
          emptyTitle="No leads found"
          emptyDescription="Add your first lead or adjust your filters."
        />

        {/* Bulk actions */}
        <BulkActions
          selectedCount={selectedRows.size}
          onAction={handleBulkAction}
          onClear={clearSelection}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  QUOTATIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function QuotationsTab({ customerMap, userMap, branchMap, items, customers, users, branches }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    lines: [{ itemId: "", description: "", quantity: 1, rate: 0, gstRate: 18 }],
  });

  const filterHook = useSalesFilters();
  const {
    filters, queryParams, setFilter, resetFilters, activeFilters, removeQuickFilter,
    activeQuickFilter, applyQuickFilter, quickFilters,
    savedFilters, saveFilter, loadFilter, deleteFilter,
    setSearch, searchQuery,
    selectedRows, toggleRow, toggleAll, clearSelection,
    groupBy, setGroupBy,
    page, setPage, limit, setLimit,
  } = filterHook;

  const query = useQuotations(queryParams);
  const docs = query.data?.data || [];
  const meta = query.data?.meta || {};

  const createMutation = useCreateQuotation();
  const convert = useConvertQuotation();

  const handleExport = useCallback((format) => {
    const rows = docs.map((d) => ({
      "Date": date(d.documentDate),
      "Quotation #": d.documentNo,
      "Customer": customerMap.get(d.partyId)?.name || "—",
      "Amount": formatRupees(d.totalAmount),
      "Status": d.status,
    }));
    if (format === "csv") {
      exportCsv("quotations.csv", rows, Object.keys(rows[0] || {}));
    } else if (format === "print") {
      window.print();
    }
  }, [docs, customerMap]);

  const handleBulkAction = useCallback((action) => {
    if (action === "approve") {
      selectedRows.forEach((id) => salesApi.updateQuotationStatus(id, "APPROVED"));
      clearSelection();
      setTimeout(() => qc.invalidateQueries({ queryKey: ["quotations"] }), 500);
    }
  }, [selectedRows, clearSelection, qc]);

  if (showCreate) {
    return (
      <Card>
        <SectionHeader
          title="New Quotation"
          icon={FileText}
          actions={
            <button onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <X size={18} />
            </button>
          }
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(
              {
                customerId: form.customerId,
                lines: form.lines.map((l) => ({
                  itemId: l.itemId || undefined,
                  description: l.description || undefined,
                  quantity: Number(l.quantity),
                  rate: Number(l.rate),
                  gstRate: Number(l.gstRate),
                })),
              },
              { onSuccess: () => setShowCreate(false) }
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Customer</label>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">GST Treatment</label>
              <select
                value={form.gstTreatment || "INTRA_STATE"}
                onChange={(e) => setForm({ ...form, gstTreatment: e.target.value })}
                className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="INTRA_STATE">Intra-State (CGST+SGST)</option>
                <option value="INTER_STATE">Inter-State (IGST)</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Line Items</span>
            </div>
            <div className="space-y-2">
              {form.lines.map((line, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2 rounded-lg border bg-slate-50 p-2.5">
                  <div className="min-w-[140px] flex-1">
                    <label className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Item</label>
                    <select
                      value={line.itemId}
                      onChange={(e) => {
                        const updated = [...form.lines];
                        updated[idx] = { ...updated[idx], itemId: e.target.value };
                        setForm({ ...form, lines: updated });
                      }}
                      className="h-10 w-full rounded-lg border bg-white px-2.5 text-sm"
                    >
                      <option value="">Select Item</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Qty</label>
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => {
                        const updated = [...form.lines];
                        updated[idx] = { ...updated[idx], quantity: e.target.value };
                        setForm({ ...form, lines: updated });
                      }}
                      className="h-10 w-full rounded-lg border bg-white px-2.5 text-sm"
                    />
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Rate (₹)</label>
                    <input
                      type="number"
                      value={line.rate}
                      onChange={(e) => {
                        const updated = [...form.lines];
                        updated[idx] = { ...updated[idx], rate: e.target.value };
                        setForm({ ...form, lines: updated });
                      }}
                      className="h-10 w-full rounded-lg border bg-white px-2.5 text-sm"
                    />
                  </div>
                  <div className="w-20">
                    <label className="mb-1 block text-[10px] font-medium uppercase text-slate-400">GST%</label>
                    <select
                      value={line.gstRate}
                      onChange={(e) => {
                        const updated = [...form.lines];
                        updated[idx] = { ...updated[idx], gstRate: e.target.value };
                        setForm({ ...form, lines: updated });
                      }}
                      className="h-10 w-full rounded-lg border bg-white px-2.5 text-sm"
                    >
                      {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  {form.lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}
                      className="mb-0.5 rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm({ ...form, lines: [...form.lines, { itemId: "", description: "", quantity: 1, rate: 0, gstRate: 18 }] })}
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>
          </div>

          {createMutation.error && (
            <div className="mt-3">
              <ErrorBanner error={createMutation.error} />
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending || !form.customerId}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating…" : "Create Quotation"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    );
  }

  const totalAmount = docs.reduce((s, d) => s + (d.totalAmount || 0), 0);

  const quotColumns = [
    { key: "date", label: "Date", sortable: true, sortKey: "documentDate", width: "105px" },
    { key: "docNo", label: "Quotation #", sortable: true, sortKey: "documentNo" },
    { key: "customer", label: "Customer", sortable: true, sortKey: "documentNo", filterable: true, filterOptions: [...new Set(docs.map((d) => ({ value: d.partyId, label: customerMap.get(d.partyId)?.name || "—" })))] },
    { key: "amount", label: "Amount", sortable: true, sortKey: "totalAmount", className: "text-right", cellClass: "text-right font-semibold tabular-nums" },
    { key: "status", label: "Status", sortable: true, sortKey: "status", filterable: true, filterOptions: STATUS_OPTIONS },
    { key: "actions", label: "", className: "text-right w-24", cellClass: "text-right" },
  ];

  // Grouping labels
  const groupLabel = useCallback((doc) => {
    if (groupBy === "customer") return customerMap.get(doc.partyId)?.name || "Unknown";
    if (groupBy === "status") return doc.status?.replace(/_/g, " ") || "Unknown";
    if (groupBy === "month") return doc.documentDate ? new Date(doc.documentDate).toLocaleString("en-IN", { month: "long", year: "numeric" }) : "Unknown";
    return null;
  }, [groupBy, customerMap]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <QuickFilters
          filters={quickFilters}
          activeKey={activeQuickFilter}
          onSelect={applyQuickFilter}
        />
        <div className="flex items-center gap-2">
          {/* Group by */}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 outline-none"
          >
            <option value="">No Grouping</option>
            <option value="customer">Group by Customer</option>
            <option value="status">Group by Status</option>
            <option value="month">Group by Month</option>
          </select>
          <AddButton label="New Quotation" onClick={() => setShowCreate(true)} />
        </div>
      </div>

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilter}
        onReset={resetFilters}
        customers={customers}
        users={users}
        branches={branches}
        exportData={handleExport}
        activeFilters={activeFilters}
        onRemoveFilter={(key) => {
          if (key === "_quick") removeQuickFilter();
          else setFilter(key, "");
        }}
      />

      <SavedFilters
        savedFilters={savedFilters}
        onSave={saveFilter}
        onLoad={loadFilter}
        onDelete={deleteFilter}
      />

      <SalesTable
        data={docs}
        columns={quotColumns}
        meta={meta}
        loading={query.isPending}
        error={query.error}
        onRetry={() => qc.invalidateQueries({ queryKey: ["quotations"] })}
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
        onSort={(sortBy, sortOrder) => {
          setFilter("sortBy", sortBy);
          setFilter("sortOrder", sortOrder);
        }}
        selectedRows={selectedRows}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        groupBy={groupBy ? groupBy : ""}
        groupLabel={groupBy ? groupLabel : undefined}
        showFooter
        totalAmount={totalAmount}
        renderRow={(doc) => (
          <>
            <td className="px-4 py-3.5 align-middle text-sm text-slate-600">{date(doc.documentDate)}</td>
            <td className="px-4 py-3.5 align-middle">
              <span className="font-mono text-xs font-semibold text-blue-700">{doc.documentNo}</span>
            </td>
            <td className="px-4 py-3.5 align-middle text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                  {(customerMap.get(doc.partyId)?.name || "?").charAt(0)}
                </div>
                <span className="truncate">{customerMap.get(doc.partyId)?.name || doc.partyId?.slice(0, 8) || "—"}</span>
              </div>
            </td>
            <td className="px-4 py-3.5 align-middle text-right font-semibold tabular-nums">{formatRupees(doc.totalAmount)}</td>
            <td className="px-4 py-3.5 align-middle"><StatusBadge status={doc.status} /></td>
            <td className="px-4 py-3.5 align-middle text-right">
              {doc.status === "DRAFT" && (
                <button
                  onClick={(e) => { e.stopPropagation(); convert.mutate(doc.id); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
                >
                  <CheckCircle2 size={13} />
                  Convert
                </button>
              )}
            </td>
          </>
        )}
        emptyTitle="No quotations found"
        emptyDescription="Create your first quotation or adjust your filters."
        emptyAction={showCreate ? undefined : "Create New"}
        onEmptyAction={() => setShowCreate(true)}
      />

      <BulkActions
        selectedCount={selectedRows.size}
        onAction={handleBulkAction}
        onClear={clearSelection}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SALES ORDERS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function SalesOrdersTab({ customerMap, userMap, branchMap, customers, users, branches }) {
  const qc = useQueryClient();

  const filterHook = useSalesFilters();
  const {
    filters, queryParams, setFilter, resetFilters, activeFilters, removeQuickFilter,
    activeQuickFilter, applyQuickFilter, quickFilters,
    savedFilters, saveFilter, loadFilter, deleteFilter,
    setSearch, searchQuery,
    selectedRows, toggleRow, toggleAll, clearSelection,
    groupBy, setGroupBy,
    page, setPage, limit, setLimit,
  } = filterHook;

  const query = useSalesOrders(queryParams);
  const docs = query.data?.data || [];
  const meta = query.data?.meta || {};

  const handleExport = useCallback((format) => {
    const rows = docs.map((d) => ({
      "Date": date(d.documentDate),
      "Order #": d.documentNo,
      "Customer": customerMap.get(d.partyId)?.name || "—",
      "Amount": formatRupees(d.totalAmount),
      "Status": d.status,
    }));
    if (format === "csv") {
      exportCsv("sales-orders.csv", rows, Object.keys(rows[0] || {}));
    } else if (format === "print") window.print();
  }, [docs, customerMap]);

  const handleBulkAction = useCallback((action) => {
    if (action === "approve") {
      selectedRows.forEach((id) => salesApi.updateSalesOrderStatus(id, "APPROVED"));
      clearSelection();
      setTimeout(() => qc.invalidateQueries({ queryKey: ["sales-orders"] }), 500);
    }
  }, [selectedRows, clearSelection, qc]);

  const totalAmount = docs.reduce((s, d) => s + (d.totalAmount || 0), 0);

  const groupLabel = useCallback((doc) => {
    if (groupBy === "customer") return customerMap.get(doc.partyId)?.name || "Unknown";
    if (groupBy === "status") return doc.status?.replace(/_/g, " ") || "Unknown";
    if (groupBy === "month") return doc.documentDate ? new Date(doc.documentDate).toLocaleString("en-IN", { month: "long", year: "numeric" }) : "Unknown";
    return null;
  }, [groupBy, customerMap]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <QuickFilters filters={quickFilters} activeKey={activeQuickFilter} onSelect={applyQuickFilter} />
        <div className="flex items-center gap-2">
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 outline-none">
            <option value="">No Grouping</option>
            <option value="customer">Group by Customer</option>
            <option value="status">Group by Status</option>
            <option value="month">Group by Month</option>
          </select>
        </div>
      </div>

      <FilterBar searchQuery={searchQuery} onSearchChange={setSearch}
        filters={filters} onFilterChange={setFilter} onReset={resetFilters}
        customers={customers} users={users} branches={branches}
        exportData={handleExport}
        activeFilters={activeFilters}
        onRemoveFilter={(key) => { if (key === "_quick") removeQuickFilter(); else setFilter(key, ""); }}
      />

      <SavedFilters savedFilters={savedFilters} onSave={saveFilter} onLoad={loadFilter} onDelete={deleteFilter} />

      <SalesTable
        data={docs} columns={[
          { key: "date", label: "Date", sortable: true, sortKey: "documentDate", width: "105px" },
          { key: "docNo", label: "Order #", sortable: true, sortKey: "documentNo" },
          { key: "customer", label: "Customer", sortable: true, sortKey: "partyId", filterable: true, filterOptions: [...new Set(docs.map((d) => ({ value: d.partyId, label: customerMap.get(d.partyId)?.name || "—" })))] },
          { key: "amount", label: "Amount", sortable: true, sortKey: "totalAmount", className: "text-right", cellClass: "text-right font-semibold tabular-nums" },
          { key: "status", label: "Status", sortable: true, sortKey: "status", filterable: true, filterOptions: STATUS_OPTIONS },
        ]}
        meta={meta} loading={query.isPending} error={query.error}
        onRetry={() => qc.invalidateQueries({ queryKey: ["sales-orders"] })}
        sortBy={filters.sortBy} sortOrder={filters.sortOrder}
        onSort={(sortBy, sortOrder) => { setFilter("sortBy", sortBy); setFilter("sortOrder", sortOrder); }}
        selectedRows={selectedRows} onToggleRow={toggleRow} onToggleAll={toggleAll}
        page={page} limit={limit} onPageChange={setPage} onLimitChange={setLimit}
        groupBy={groupBy ? groupBy : ""} groupLabel={groupBy ? groupLabel : undefined}
        showFooter totalAmount={totalAmount}
        renderRow={(doc) => (
          <>
            <td className="px-4 py-3.5 align-middle text-sm text-slate-600">{date(doc.documentDate)}</td>
            <td className="px-4 py-3.5 align-middle font-mono text-xs font-semibold text-blue-700">{doc.documentNo}</td>
            <td className="px-4 py-3.5 align-middle text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                  {(customerMap.get(doc.partyId)?.name || "?").charAt(0)}
                </div>
                <span>{customerMap.get(doc.partyId)?.name || doc.partyId?.slice(0, 8) || "—"}</span>
              </div>
            </td>
            <td className="px-4 py-3.5 align-middle text-right font-semibold tabular-nums">{formatRupees(doc.totalAmount)}</td>
            <td className="px-4 py-3.5 align-middle"><StatusBadge status={doc.status} /></td>
          </>
        )}
        emptyTitle="No orders found"
        emptyDescription="Sales orders will appear here once created."
      />

      <BulkActions selectedCount={selectedRows.size} onAction={handleBulkAction} onClear={clearSelection} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INVOICES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function InvoicesTab({ customerMap, userMap, branchMap, customers, users, branches }) {
  const qc = useQueryClient();

  const filterHook = useSalesFilters();
  const {
    filters, queryParams, setFilter, resetFilters, activeFilters, removeQuickFilter,
    activeQuickFilter, applyQuickFilter, quickFilters,
    savedFilters, saveFilter, loadFilter, deleteFilter,
    setSearch, searchQuery,
    selectedRows, toggleRow, toggleAll, clearSelection,
    groupBy, setGroupBy,
    page, setPage, limit, setLimit,
  } = filterHook;

  const query = useInvoices(queryParams);
  const docs = query.data?.data || [];
  const meta = query.data?.meta || {};

  const handleExport = useCallback((format) => {
    const rows = docs.map((d) => ({
      "Date": date(d.documentDate),
      "Invoice #": d.documentNo,
      "Customer": customerMap.get(d.partyId)?.name || "—",
      "Amount": formatRupees(d.totalAmount),
      "Status": d.status,
    }));
    if (format === "csv") {
      exportCsv("invoices.csv", rows, Object.keys(rows[0] || {}));
    } else if (format === "print") window.print();
  }, [docs, customerMap]);

  const totalAmount = docs.reduce((s, d) => s + (d.totalAmount || 0), 0);

  const groupLabel = useCallback((doc) => {
    if (groupBy === "customer") return customerMap.get(doc.partyId)?.name || "Unknown";
    if (groupBy === "status") return doc.status?.replace(/_/g, " ") || "Unknown";
    if (groupBy === "month") return doc.documentDate ? new Date(doc.documentDate).toLocaleString("en-IN", { month: "long", year: "numeric" }) : "Unknown";
    return null;
  }, [groupBy, customerMap]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <QuickFilters filters={quickFilters} activeKey={activeQuickFilter} onSelect={applyQuickFilter} />
        <div className="flex items-center gap-2">
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 outline-none">
            <option value="">No Grouping</option>
            <option value="customer">Group by Customer</option>
            <option value="status">Group by Status</option>
            <option value="month">Group by Month</option>
          </select>
        </div>
      </div>

      <FilterBar searchQuery={searchQuery} onSearchChange={setSearch}
        filters={filters} onFilterChange={setFilter} onReset={resetFilters}
        customers={customers} users={users} branches={branches}
        exportData={handleExport}
        activeFilters={activeFilters}
        onRemoveFilter={(key) => { if (key === "_quick") removeQuickFilter(); else setFilter(key, ""); }}
      />

      <SavedFilters savedFilters={savedFilters} onSave={saveFilter} onLoad={loadFilter} onDelete={deleteFilter} />

      <SalesTable
        data={docs} columns={[
          { key: "date", label: "Date", sortable: true, sortKey: "documentDate", width: "105px" },
          { key: "docNo", label: "Invoice #", sortable: true, sortKey: "documentNo" },
          { key: "customer", label: "Customer", sortable: true, sortKey: "partyId", filterable: true, filterOptions: [...new Set(docs.map((d) => ({ value: d.partyId, label: customerMap.get(d.partyId)?.name || "—" })))] },
          { key: "amount", label: "Amount", sortable: true, sortKey: "totalAmount", className: "text-right", cellClass: "text-right font-semibold tabular-nums" },
          { key: "status", label: "Status", sortable: true, sortKey: "status", filterable: true, filterOptions: STATUS_OPTIONS },
        ]}
        meta={meta} loading={query.isPending} error={query.error}
        onRetry={() => qc.invalidateQueries({ queryKey: ["invoices"] })}
        sortBy={filters.sortBy} sortOrder={filters.sortOrder}
        onSort={(sortBy, sortOrder) => { setFilter("sortBy", sortBy); setFilter("sortOrder", sortOrder); }}
        selectedRows={selectedRows} onToggleRow={toggleRow} onToggleAll={toggleAll}
        page={page} limit={limit} onPageChange={setPage} onLimitChange={setLimit}
        groupBy={groupBy ? groupBy : ""} groupLabel={groupBy ? groupLabel : undefined}
        showFooter totalAmount={totalAmount}
        renderRow={(doc) => (
          <>
            <td className="px-4 py-3.5 align-middle text-sm text-slate-600">{date(doc.documentDate)}</td>
            <td className="px-4 py-3.5 align-middle font-mono text-xs font-semibold text-blue-700">{doc.documentNo}</td>
            <td className="px-4 py-3.5 align-middle text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                  {(customerMap.get(doc.partyId)?.name || "?").charAt(0)}
                </div>
                <span>{customerMap.get(doc.partyId)?.name || doc.partyId?.slice(0, 8) || "—"}</span>
              </div>
            </td>
            <td className="px-4 py-3.5 align-middle text-right font-semibold tabular-nums">{formatRupees(doc.totalAmount)}</td>
            <td className="px-4 py-3.5 align-middle"><StatusBadge status={doc.status} /></td>
          </>
        )}
        emptyTitle="No invoices found"
        emptyDescription="Invoices will appear here once created."
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RECEIPTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

const blankReceipt = {
  amount: "", mode: "UPI", referenceNo: "", narration: "", paymentDate: "",
};

function ReceiptsTab({ customerMap, customers }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(blankReceipt);

  const filterHook = useSalesFilters();
  const {
    filters, queryParams, setFilter, resetFilters, activeFilters, removeQuickFilter,
    activeQuickFilter, applyQuickFilter, quickFilters,
    setSearch, searchQuery,
    page, setPage, limit, setLimit,
  } = filterHook;

  const query = useReceipts(queryParams);
  const receipts = query.data?.data || [];
  const meta = query.data?.meta || {};

  const create = useCreateReceipt();

  const handleExport = useCallback((format) => {
    const rows = receipts.map((r) => ({
      "Receipt #": r.paymentNumber,
      "Date": date(r.paymentDate),
      "Amount": formatRupees(r.amount),
      "Mode": r.mode,
      "Reference": r.referenceNo || "—",
    }));
    if (format === "csv") {
      exportCsv("receipts.csv", rows, Object.keys(rows[0] || {}));
    } else if (format === "print") window.print();
  }, [receipts]);

  const totalAmount = receipts.reduce((s, r) => s + (r.amount || 0), 0);

  // Filter status for receipts — mode instead of status
  const receiptStatusOptions = [
    { value: "CASH", label: "Cash" },
    { value: "CHEQUE", label: "Cheque" },
    { value: "NEFT", label: "NEFT" },
    { value: "RTGS", label: "RTGS" },
    { value: "UPI", label: "UPI" },
    { value: "CARD", label: "Card" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      {/* Record Receipt form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(form, {
            onSuccess: () => setForm(blankReceipt),
          });
        }}
        className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Plus size={16} className="text-blue-600" />
          Record Receipt
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Customer
            <select
              value={form.customerId || ""}
              onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="">Select Customer (optional)</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Amount (₹)
            <input
              type="number" required
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mode
            <select
              value={form.mode}
              onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {["CASH", "CHEQUE", "NEFT", "RTGS", "UPI", "CARD"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Reference No.
            <input
              value={form.referenceNo}
              onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Payment Date
            <input
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Narration
            <input
              value={form.narration}
              onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
        </div>
        <ErrorBanner error={create.error} />
        <button
          type="submit"
          disabled={create.isPending}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Plus size={16} />
          {create.isPending ? "Saving..." : "Record Receipt"}
        </button>
      </form>

      {/* Receipts list */}
      <div className="min-w-0 space-y-3">
        <QuickFilters
          filters={quickFilters}
          activeKey={activeQuickFilter}
          onSelect={applyQuickFilter}
        />

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearch}
          filters={filters}
          onFilterChange={setFilter}
          onReset={resetFilters}
          customers={customers}
          branches={[]}
          users={[]}
          exportData={handleExport}
          activeFilters={activeFilters}
          onRemoveFilter={(key) => {
            if (key === "_quick") removeQuickFilter();
            else setFilter(key, "");
          }}
        />

        <SalesTable
          data={receipts}
          columns={[
            { key: "paymentNumber", label: "Receipt #", sortable: true, sortKey: "paymentNumber" },
            { key: "date", label: "Date", sortable: true, sortKey: "paymentDate" },
            { key: "customer", label: "Customer", sortable: false },
            { key: "amount", label: "Amount", sortable: true, sortKey: "amount", className: "text-right", cellClass: "text-right font-semibold tabular-nums" },
            { key: "mode", label: "Mode", sortable: true, sortKey: "mode", filterable: true, filterOptions: receiptStatusOptions },
            { key: "reference", label: "Reference", sortable: false },
          ]}
          meta={meta}
          loading={query.isPending}
          error={query.error}
          onRetry={() => qc.invalidateQueries({ queryKey: ["receipts"] })}
          sortBy={filters.sortBy}
          sortOrder={filters.sortOrder}
          onSort={(sortBy, sortOrder) => {
            setFilter("sortBy", sortBy);
            setFilter("sortOrder", sortOrder);
          }}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          showFooter
          totalAmount={totalAmount}
          renderRow={(r) => (
            <>
              <td className="px-4 py-3.5 align-middle font-mono text-xs font-semibold text-blue-700">{r.paymentNumber}</td>
              <td className="px-4 py-3.5 align-middle text-sm text-slate-600">{date(r.paymentDate)}</td>
              <td className="px-4 py-3.5 align-middle text-sm text-slate-700">
                {customerMap.get(r.partyId)?.name || "—"}
              </td>
              <td className="px-4 py-3.5 align-middle text-right font-semibold tabular-nums">{formatRupees(r.amount)}</td>
              <td className="px-4 py-3.5 align-middle"><StatusBadge status={r.mode} /></td>
              <td className="px-4 py-3.5 align-middle text-sm text-slate-500">{r.referenceNo || "—"}</td>
            </>
          )}
          emptyTitle="No receipts found"
          emptyDescription="Record your first payment receipt or adjust your filters."
        />
      </div>
    </div>
  );
}
