/**
 * Documents Tab — Velora ERP Sales
 * Handles Quotations, Sales Orders, Delivery Notes, and Invoices
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft, Calendar, Download, Edit, FileText, Filter, Plus,
  Search, Trash2, XCircle, RefreshCw, Truck, CheckCircle2, X,
} from "lucide-react";
import { salesApi, masterApi } from "../../../services/api";
import { formatRupees, formatRupeesCompact } from "../../../utils/money";
import { businessDocumentStatusLabel, documentTypeLabel, documentTypeIcon, formatDate } from "../../../utils/format";
import { ErrorState } from "../../../components/ErrorState";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonTable } from "../../../components/Skeleton";

const STATUS_COLORS = {
  DRAFT: "slate", SUBMITTED: "blue", APPROVED: "emerald",
  REJECTED: "rose", CANCELLED: "rose", CLOSED: "purple",
};

export default function DocumentsTab({ docType, label, customers = [], items = [], openFormSignal = 0, onConvertToOrder }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerId: "", documentDate: new Date().toISOString().slice(0, 10), gstTreatment: "INTRA_STATE", terms: "", lines: [{ itemId: "", description: "", quantity: "1", rate: "0", discount: "0", gstRate: "18" }] });

  // Open the create form when the parent navigates here with a new openFormSignal.
  useEffect(() => {
    if (openFormSignal) setShowForm(true);
  }, [openFormSignal]);

  const apiMap = {
    QUOTATION: { list: "quotations", create: "createQuotation", status: "updateQuotationStatus" },
    SALES_ORDER: { list: "salesOrders", create: "createSalesOrder", status: "updateSalesOrderStatus" },
    DELIVERY_NOTE: { list: "deliveryNotes", create: "createDeliveryNote", status: null },
    INVOICE: { list: "invoices", create: "createInvoice", status: null },
  };

  const api = apiMap[docType];

  const query = useQuery({
    queryKey: [api.list, page, search, statusFilter],
    queryFn: () => salesApi[api.list]({ page, limit: 20, q: search, status: statusFilter || undefined }),
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (input) => salesApi[api.create](input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [api.list] }); setShowForm(false); resetForm(); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => salesApi[api.status]?.(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: [api.list] }),
  });

  const resetForm = () => setForm({ customerId: "", documentDate: new Date().toISOString().slice(0, 10), gstTreatment: "INTRA_STATE", terms: "", lines: [{ itemId: "", description: "", quantity: "1", rate: "0", discount: "0", gstRate: "18" }] });

  const addLine = () => setForm(p => ({...p, lines: [...p.lines, { itemId: "", description: "", quantity: "1", rate: "0", discount: "0", gstRate: "18" }]}));
  const removeLine = (i) => setForm(p => ({...p, lines: p.lines.filter((_, idx) => idx !== i)}));
  const updateLine = (i, field, value) => setForm(p => ({...p, lines: p.lines.map((l, idx) => idx === i ? {...l, [field]: value} : l)}));

  const computeDocTotal = (lines) => {
    let total = 0;
    lines.forEach(l => {
      const qty = Number(l.quantity) || 0;
      const rate = Number(l.rate) || 0;
      const disc = Number(l.discount) || 0;
      const gst = Number(l.gstRate) || 18;
      const taxable = qty * rate - disc;
      total += taxable + (taxable * gst / 100);
    });
    return total;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      customerId: form.customerId || undefined,
      documentDate: new Date(form.documentDate).toISOString(),
      gstTreatment: form.gstTreatment,
      terms: form.terms || undefined,
      lines: form.lines.map(l => ({
        itemId: l.itemId || undefined,
        description: l.description || undefined,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        discount: Number(l.discount) || 0,
        gstRate: Number(l.gstRate) || 18,
      })),
    });
  };

  if (query.isPending) return <SkeletonTable rows={10} cols={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const docs = query.data?.rows || [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-4">
      {showForm && (
        <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">{documentTypeIcon(docType)} New {label}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Customer
              <select value={form.customerId} onChange={e => setForm(p => ({...p, customerId: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Document date
              <input type="date" value={form.documentDate} onChange={e => setForm(p => ({...p, documentDate: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium">GST treatment
              <select value={form.gstTreatment} onChange={e => setForm(p => ({...p, gstTreatment: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="INTRA_STATE">Intra-state (CGST + SGST)</option>
                <option value="INTER_STATE">Inter-state (IGST)</option>
              </select>
            </label>
            <label className="text-sm font-medium">Terms & conditions
              <textarea value={form.terms} onChange={e => setForm(p => ({...p, terms: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={2} placeholder="Payment terms…" />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700">Line items</h4>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Plus size={12} /> Add line
              </button>
            </div>
            {form.lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_80px_80px_80px_80px_32px] gap-2 items-end">
                <label className="text-xs text-slate-500">Item
                  <select value={line.itemId} onChange={e => updateLine(i, "itemId", e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm">
                    <option value="">Manual entry</option>
                    {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-500">Description
                  <input value={line.description} onChange={e => updateLine(i, "description", e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" placeholder="Description" />
                </label>
                <label className="text-xs text-slate-500">Qty
                  <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => updateLine(i, "quantity", e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs text-slate-500">Rate (₹)
                  <input type="number" min="0" step="0.01" value={line.rate} onChange={e => updateLine(i, "rate", e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs text-slate-500">Disc (₹)
                  <input type="number" min="0" step="0.01" value={line.discount} onChange={e => updateLine(i, "discount", e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs text-slate-500">GST %
                  <input type="number" min="0" max="28" value={line.gstRate} onChange={e => updateLine(i, "gstRate", e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
                </label>
                {form.lines.length > 1 && (
                  <button type="button" onClick={() => removeLine(i)} className="mb-1 rounded p-1 text-red-500 hover:bg-red-50"><X size={14} /></button>
                )}
              </div>
            ))}
            <p className="text-right text-sm font-semibold text-slate-900">
              Total: {formatRupees(Math.round(computeDocTotal(form.lines) * 100))}
            </p>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {createMutation.isPending ? "Creating…" : `Create ${label}`}
            </button>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      )}

      {docs.length === 0 ? (
        <EmptyState title={`No ${label.toLowerCase()}s yet`} description={`Create your first ${label.toLowerCase()} to get started.`} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">Document #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">{doc.documentNo}</td>
                    <td className="px-4 py-3 text-slate-700">{doc.party?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(doc.documentDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-${STATUS_COLORS[doc.status] || "slate"}-700 bg-${STATUS_COLORS[doc.status] || "slate"}-50`}>
                        {businessDocumentStatusLabel(doc.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-950">{formatRupees(doc.totalAmount)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {docType === "QUOTATION" && doc.status === "DRAFT" && (
                        <button onClick={() => { if (window.confirm("Convert to sales order?")) salesApi.convertQuotationToOrder(doc.id).then(() => qc.invalidateQueries({ queryKey: [api.list] })); }} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                          <ArrowRightLeft size={12} /> Convert to order
                        </button>
                      )}
                      {api.status && doc.status !== "CLOSED" && doc.status !== "CANCELLED" && (
                        <select onChange={(e) => { if (e.target.value) { updateStatusMutation.mutate({ id: doc.id, status: e.target.value }); e.target.value = ""; } }} className="h-8 max-w-[120px] rounded border border-slate-200 px-2 text-xs" defaultValue="">
                          <option value="">Update status…</option>
                          {["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED", "CLOSED"].map(s => <option key={s} value={s}>{businessDocumentStatusLabel(s)}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <span className="text-xs text-slate-500">Page {meta.page} of {meta.totalPages} ({meta.total} total)</span>
              <div className="flex gap-1">
                {Array.from({length: Math.min(meta.totalPages, 10)}, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 rounded text-xs font-medium ${p === page ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}