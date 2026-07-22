/**
 * Suppliers Page — Vendor management within Inventory context
 *
 * Features:
 *  - Supplier list with purchase history
 *  - Contact information
 *  - Purchase order history per supplier
 *  - Payment tracking
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, Download, MapPin, Plus, Search, ShoppingBag, X,
} from "lucide-react";
import { coreApi, inventoryApi } from "../../services/api";
import { formatRupees } from "../../utils/money";
import { ErrorBanner, ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { AddButton, PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonPage, SkeletonTable } from "../../components/Skeleton";
import {
  Card, Cell, Head, Pill, SectionHeader, StatusPill,
  TableShell, number, date, exportCsv,
} from "./components/shared";

const emptyForm = {
  name: "", gstin: "", panNumber: "",
  billingAddress: {}, shippingAddress: {},
  creditLimit: "", creditDays: 30, paymentTerms: "", openingBalance: 0,
};

export default function SuppliersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const listQuery = useQuery({
    queryKey: ["inventory-suppliers", search],
    queryFn: () => inventoryApi.suppliers(search ? { q: search } : {}),
    staleTime: 60 * 1000,
  });

  const detailQuery = useQuery({
    queryKey: ["inventory-supplier-detail", selectedId],
    queryFn: () => inventoryApi.supplierDetail(selectedId),
    enabled: !!selectedId,
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => coreApi.create("vendors", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-suppliers"] });
      resetForm();
    },
  });

  function resetForm() {
    setForm(emptyForm);
    setShowForm(false);
  }

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      creditLimit: Number(form.creditLimit) || 0,
      creditDays: Number(form.creditDays) || 0,
      openingBalance: Number(form.openingBalance) || 0,
    });
  };

  const suppliers = listQuery.data?.data || [];

  if (listQuery.isPending) return <SkeletonPage cards={0} tableRows={8} />;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <button onClick={() => navigate("/inventory")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 mb-2">
        <ArrowLeft size={14} /> Back to Inventory
      </button>
      <PageHeader
        title="Suppliers"
        description="Manage vendors, contact information, and purchase history."
        actions={
          <AddButton
            label={showForm ? "Close" : "Add supplier"}
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
          />
        }
      />

      {/* Form */}
      {showForm && (
        <Card>
          <SectionHeader
            title="New supplier"
            icon={Building2}
            actions={<button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>}
          />
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Name *
                <input required value={form.name} onChange={update("name")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                GSTIN
                <input value={form.gstin} onChange={update("gstin")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                PAN
                <input value={form.panNumber} onChange={update("panNumber")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Credit limit (₹)
                <input type="number" min={0} value={form.creditLimit} onChange={update("creditLimit")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Credit days
                <input type="number" min={0} value={form.creditDays} onChange={update("creditDays")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Payment terms
                <input value={form.paymentTerms} onChange={update("paymentTerms")} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
            </div>
            {createMutation.error && <div className="mt-4"><ErrorBanner error={createMutation.error} /></div>}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Saving…" : "Create supplier"}
            </button>
          </form>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers…"
          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Supplier list + Detail */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.5fr]">
        {/* List */}
        <Card padding="p-0">
          <div className="border-b border-slate-200 p-5">
            <SectionHeader title="All suppliers" description={`${suppliers.length} registered`} icon={Building2} />
          </div>
          {suppliers.length ? (
            <div className="divide-y divide-slate-100">
              {suppliers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50 transition ${
                    selectedId === s.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-950">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      {s.purchaseOrderCount || 0} orders · {formatRupees(s.totalPurchaseValue || 0)} total
                    </p>
                    {s.gstin && <p className="font-mono text-xs text-slate-400 mt-0.5">GST: {s.gstin}</p>}
                  </div>
                  <Pill tone={s.isActive !== false ? "emerald" : "slate"}>
                    {s.isActive !== false ? "Active" : "Inactive"}
                  </Pill>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-5"><EmptyState title="No suppliers" description="Add a supplier to get started." /></div>
          )}
        </Card>

        {/* Detail panel */}
        <div>
          {selectedId && detailQuery.data?.data ? (
            <SupplierDetail
              data={detailQuery.data.data}
              onRefresh={() => {
                qc.invalidateQueries({ queryKey: ["inventory-supplier-detail", selectedId] });
                qc.invalidateQueries({ queryKey: ["inventory-suppliers"] });
              }}
            />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <EmptyState title="Select a supplier" description="Choose a supplier from the list to see their details and purchase history." />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SupplierDetail({ data, onRefresh }) {
  const { vendor, purchaseOrders = [], payments = [] } = data;
  if (!vendor) return null;

  return (
    <div className="space-y-4">
      {/* Info card */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">{vendor.name}</h3>
            {vendor.gstin && <p className="font-mono text-sm text-slate-500 mt-1">GST: {vendor.gstin}</p>}
            {vendor.panNumber && <p className="font-mono text-xs text-slate-400">PAN: {vendor.panNumber}</p>}
          </div>
          <SecondaryButton label="Refresh" icon={Download} onClick={onRefresh} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Credit limit</p>
            <p className="mt-1 font-semibold text-slate-950">{vendor.creditLimit ? formatRupees(vendor.creditLimit) : "—"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Credit days</p>
            <p className="mt-1 font-semibold text-slate-950">{vendor.creditDays || "—"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Payment terms</p>
            <p className="mt-1 font-semibold text-slate-950">{vendor.paymentTerms || "—"}</p>
          </div>
        </div>
        {vendor.billingAddress && (
          <div className="mt-3 flex items-start gap-2 text-sm text-slate-600">
            <MapPin size={15} className="mt-0.5 shrink-0" />
            <span>{typeof vendor.billingAddress === "object" ? Object.values(vendor.billingAddress).filter(Boolean).join(", ") : String(vendor.billingAddress)}</span>
          </div>
        )}
      </Card>

      {/* Purchase Orders */}
      <Card padding="p-0">
        <div className="border-b border-slate-200 p-5">
          <SectionHeader title="Purchase orders" description={`${purchaseOrders.length} recent orders`} icon={ShoppingBag} />
        </div>
        {purchaseOrders.length ? (
          <TableShell>
            <Head>
              <th className="px-4 py-3">Order #</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Lines</th>
            </Head>
            <tbody className="divide-y divide-slate-100">
              {purchaseOrders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50">
                  <Cell className="font-mono text-xs text-blue-700">{po.documentNo || "—"}</Cell>
                  <Cell className="text-slate-600">{date(po.documentDate)}</Cell>
                  <Cell><StatusPill status={po.status} /></Cell>
                  <Cell className="text-right tabular-nums font-semibold">{formatRupees(po.totalAmount)}</Cell>
                  <Cell className="text-xs text-slate-500">{po.lines?.length || 0}</Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <div className="p-5"><EmptyState title="No orders yet" description="Purchase orders will appear here." /></div>
        )}
      </Card>

      {/* Payments */}
      {payments.length > 0 && (
        <Card padding="p-0">
          <div className="border-b border-slate-200 p-5">
            <SectionHeader title="Payments" description={`${payments.length} records`} icon={Download} />
          </div>
          <TableShell>
            <Head>
              <th className="px-4 py-3">Payment #</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </Head>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <Cell className="font-mono text-xs">{p.paymentNumber}</Cell>
                  <Cell className="text-slate-600">{date(p.paymentDate)}</Cell>
                  <Cell><Pill tone="blue">{p.mode}</Pill></Cell>
                  <Cell className="text-right tabular-nums font-semibold">{formatRupees(p.amount)}</Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
      )}
    </div>
  );
}
