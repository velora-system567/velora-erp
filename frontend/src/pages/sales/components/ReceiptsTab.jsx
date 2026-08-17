/**
 * Receipts Tab — Velora ERP Sales
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Calendar, CreditCard, Edit, Filter, Plus, Search, Trash2, X } from "lucide-react";
import { salesApi, masterApi } from "../../../services/api";
import { formatRupees, formatRupeesCompact } from "../../../utils/money";
import { formatDate } from "../../../utils/format";
import { ErrorState } from "../../../components/ErrorState";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonTable } from "../../../components/Skeleton";

const MODES = ["CASH", "CHEQUE", "NEFT", "RTGS", "UPI", "CARD"];
const MODE_LABELS = { CASH: "Cash", CHEQUE: "Cheque", NEFT: "NEFT", RTGS: "RTGS", UPI: "UPI", CARD: "Card" };

export default function ReceiptsTab({ customers = [] }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerId: "", amount: "", mode: "CASH", referenceNo: "", bankName: "",
    narration: "", paymentDate: new Date().toISOString().slice(0, 10),
    allocations: [{ invoiceId: "", amount: "" }],
  });

  const query = useQuery({
    queryKey: ["payment-receipts", page, search],
    queryFn: () => salesApi.paymentReceipts({ page, limit: 20, q: search }),
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (input) => salesApi.createPaymentReceipt(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-receipts"] }); setShowForm(false); resetForm(); },
  });

  const resetForm = () => setForm({
    customerId: "", amount: "", mode: "CASH", referenceNo: "", bankName: "",
    narration: "", paymentDate: new Date().toISOString().slice(0, 10),
    allocations: [{ invoiceId: "", amount: "" }],
  });

  const addAllocation = () => setForm(p => ({...p, allocations: [...p.allocations, { invoiceId: "", amount: "" }]}));
  const removeAllocation = (i) => setForm(p => ({...p, allocations: p.allocations.filter((_, idx) => idx !== i)}));
  const updateAllocation = (i, field, value) => setForm(p => ({...p, allocations: p.allocations.map((a, idx) => idx === i ? {...a, [field]: value} : a)}));

  const onSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      customerId: form.customerId,
      amount: Number(form.amount),
      mode: form.mode,
      referenceNo: form.referenceNo || undefined,
      bankName: form.bankName || undefined,
      narration: form.narration || undefined,
      paymentDate: new Date(form.paymentDate).toISOString(),
      allocations: form.allocations.filter(a => a.invoiceId && a.amount).map(a => ({
        invoiceId: a.invoiceId,
        amount: Number(a.amount),
      })),
    });
  };

  if (query.isPending) return <SkeletonTable rows={10} cols={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const receipts = query.data?.rows || [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-4">
      {showForm && (
        <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2"><CreditCard size={20} className="text-emerald-600" /> Record payment receipt</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Customer <span className="text-red-500">*</span>
              <select required value={form.customerId} onChange={e => setForm(p => ({...p, customerId: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Amount (₹) <span className="text-red-500">*</span>
              <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0.00" />
            </label>
            <label className="text-sm font-medium">Payment mode
              <select value={form.mode} onChange={e => setForm(p => ({...p, mode: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Payment date
              <input type="date" value={form.paymentDate} onChange={e => setForm(p => ({...p, paymentDate: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium">Reference / Cheque #
              <input value={form.referenceNo} onChange={e => setForm(p => ({...p, referenceNo: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Ref #" />
            </label>
            <label className="text-sm font-medium">Bank name
              <input value={form.bankName} onChange={e => setForm(p => ({...p, bankName: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Bank name" />
            </label>
            <label className="text-sm font-medium sm:col-span-2">Narration
              <textarea value={form.narration} onChange={e => setForm(p => ({...p, narration: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={2} placeholder="Description…" />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700">Invoice allocations (optional)</h4>
              <button type="button" onClick={addAllocation} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Plus size={12} /> Add allocation
              </button>
            </div>
            {form.allocations.map((alloc, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_32px] gap-2 items-end">
                <label className="text-xs text-slate-500">Invoice ID
                  <input value={alloc.invoiceId} onChange={e => updateAllocation(i, "invoiceId", e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" placeholder="Invoice UUID" />
                </label>
                <label className="text-xs text-slate-500">Amount (₹)
                  <input type="number" min="0.01" step="0.01" value={alloc.amount} onChange={e => updateAllocation(i, "amount", e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
                </label>
                {form.allocations.length > 1 && (
                  <button type="button" onClick={() => removeAllocation(i)} className="mb-1 rounded p-1 text-red-500 hover:bg-red-50"><X size={14} /></button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isPending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {createMutation.isPending ? "Recording…" : "Record receipt"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      )}

      {receipts.length === 0 ? (
        <EmptyState title="No payment receipts yet" description="Record your first payment receipt to get started." />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">Receipt #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">{r.paymentNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{customers.find(c => c.id === r.partyId)?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(r.paymentDate)}</td>
                    <td className="px-4 py-3 text-slate-700">{MODE_LABELS[r.mode] || r.mode}</td>
                    <td className="px-4 py-3 text-slate-700">{r.referenceNo || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-950">{formatRupees(r.amount)}</td>
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