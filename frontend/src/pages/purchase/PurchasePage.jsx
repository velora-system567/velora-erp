import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import { purchaseApi } from "../../services/api";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { SkeletonTable } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { formatRupees } from "../../utils/money";

const TABS = ["Purchase Orders", "GRNs", "Purchase Invoices", "Vendor Payments"];

function TabBar({ active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
      {TABS.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${active === t ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

function PurchaseOrdersTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["purchase-orders"], queryFn: () => purchaseApi.purchaseOrders() });
  const docs = query.data?.data || [];
  const approve = useMutation({
    mutationFn: (id) => purchaseApi.approvePurchaseOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });

  if (query.isPending) return <SkeletonTable rows={6} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["purchase-orders"] })} />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>{["Date", "No", "Vendor", "Total", "Status", "Actions"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {docs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No purchase orders found.</td></tr>
            ) : docs.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{new Date(doc.documentDate).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{doc.documentNo}</td>
                <td className="px-4 py-3 text-slate-700">{doc.partyId ? doc.partyId.slice(0, 8) + "…" : "—"}</td>
                <td className="px-4 py-3 font-bold text-slate-950">{formatRupees(doc.totalAmount)}</td>
                <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                <td className="px-4 py-3">
                  {doc.status === "DRAFT" && (
                    <button onClick={() => approve.mutate(doc.id)} disabled={approve.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                      <Check size={13} /> Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GrnsTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["grns"], queryFn: () => purchaseApi.grns() });
  const docs = query.data?.data || [];
  const approve = useMutation({
    mutationFn: (id) => purchaseApi.approveGrn(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grns"] }),
  });

  if (query.isPending) return <SkeletonTable rows={5} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["grns"] })} />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>{["Date", "GRN No", "Vendor", "Warehouse", "Status", "Actions"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {docs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No GRNs found. Create one after receiving goods.</td></tr>
            ) : docs.map((grn) => (
              <tr key={grn.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{new Date(grn.receiptDate).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{grn.grnNumber}</td>
                <td className="px-4 py-3 text-slate-700">{grn.vendorId ? grn.vendorId.slice(0, 8) + "…" : "—"}</td>
                <td className="px-4 py-3 text-slate-600">{grn.warehouseId ? grn.warehouseId.slice(0, 8) + "…" : "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={grn.status} /></td>
                <td className="px-4 py-3">
                  {grn.status === "DRAFT" && (
                    <button onClick={() => approve.mutate(grn.id)} disabled={approve.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                      <Check size={13} /> Approve & Credit Stock
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseInvoicesTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["purchase-invoices"], queryFn: () => purchaseApi.purchaseInvoices() });
  const docs = query.data?.data || [];

  if (query.isPending) return <SkeletonTable rows={5} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["purchase-invoices"] })} />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>{["Date", "No", "Taxable", "GST", "Total", "Status"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {docs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No purchase invoices found.</td></tr>
            ) : docs.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{new Date(doc.documentDate).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{doc.documentNo}</td>
                <td className="px-4 py-3 text-slate-700">{formatRupees(doc.taxableAmount)}</td>
                <td className="px-4 py-3 text-slate-700">{formatRupees(doc.cgstAmount + doc.sgstAmount + doc.igstAmount)}</td>
                <td className="px-4 py-3 font-bold text-slate-950">{formatRupees(doc.totalAmount)}</td>
                <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorPaymentsTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["vendor-payments"], queryFn: purchaseApi.vendorPayments });
  const payments = query.data?.data || [];

  if (query.isPending) return <SkeletonTable rows={4} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["vendor-payments"] })} />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>{["No", "Date", "Amount", "Mode", "Reference"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No vendor payments recorded.</td></tr>
            ) : payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.paymentNumber}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(p.paymentDate).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 font-bold text-slate-950">{formatRupees(p.amount)}</td>
                <td className="px-4 py-3"><StatusBadge status={p.mode} /></td>
                <td className="px-4 py-3 text-slate-600">{p.referenceNo || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PurchasePage() {
  const [activeTab, setActiveTab] = useState("Purchase Orders");

  const tabContent = {
    "Purchase Orders": <PurchaseOrdersTab />,
    "GRNs": <GrnsTab />,
    "Purchase Invoices": <PurchaseInvoicesTab />,
    "Vendor Payments": <VendorPaymentsTab />,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Purchase</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Manage purchase orders, goods receipts, vendor bills, and payments.
            </p>
          </div>
          <ShoppingBag className="hidden shrink-0 text-blue-600 sm:block" size={22} />
        </div>
      </header>
      <TabBar active={activeTab} onChange={setActiveTab} />
      <div className="min-h-[300px]">{tabContent[activeTab]}</div>
    </div>
  );
}
