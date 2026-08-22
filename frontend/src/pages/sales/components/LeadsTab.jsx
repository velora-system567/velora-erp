/**
 * Leads Tab — Velora ERP Sales
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Calendar, Edit, Filter, Mail, MapPin, Phone, Search, Star, Tag, Trash2, User } from "lucide-react";
import { salesApi } from "../../../services/api";
import { formatRupees, formatRupeesCompact } from "../../../utils/money";
import { ErrorState } from "../../../components/ErrorState";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonTable } from "../../../components/Skeleton";

const PRIORITY_COLORS = { HIGH: "rose", MEDIUM: "amber", LOW: "blue" };
const STATUS_COLORS = { NEW: "blue", QUALIFIED: "emerald", LOST: "rose", CONVERTED: "purple" };

export default function LeadsTab({ customers = [], openFormSignal = 0 }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [form, setForm] = useState({ name: "", contactPerson: "", phone: "", email: "", city: "", source: "", priority: "MEDIUM", status: "NEW", value: "", notes: "", requirement: "", nextFollowUp: "" });

  // Open the create form when the parent "Add lead" button navigates here
  // with a new openFormSignal (unique timestamp per click).
  useEffect(() => {
    if (openFormSignal) setShowForm(true);
  }, [openFormSignal]);

  const query = useQuery({
    queryKey: ["leads", page, search, status],
    queryFn: () => salesApi.leads({ page, limit: 20, q: search, status: status || undefined }),
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (input) => salesApi.createLead(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); setShowForm(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }) => salesApi.updateLead(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); setShowForm(false); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => salesApi.deleteLead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  const resetForm = () => { setForm({ name: "", contactPerson: "", phone: "", email: "", city: "", source: "", priority: "MEDIUM", status: "NEW", value: "", notes: "", requirement: "", nextFollowUp: "" }); setEditLead(null); };

  const onSubmit = (e) => {
    e.preventDefault();
    const input = { ...form, value: Number(form.value) || 0, nextFollowUp: form.nextFollowUp || null };
    if (editLead) updateMutation.mutate({ id: editLead.id, input });
    else createMutation.mutate(input);
  };

  if (query.isPending) return <SkeletonTable rows={10} cols={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const leads = query.data?.rows || [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-4">
      {showForm && (
        <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold">{editLead ? "Edit lead" : "New lead"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Name <span className="text-red-500">*</span>
              <input required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Lead name" />
            </label>
            <label className="text-sm font-medium">Contact person
              <input value={form.contactPerson} onChange={e => setForm(p => ({...p, contactPerson: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Contact person" />
            </label>
            <label className="text-sm font-medium">Phone
              <input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="+91…" />
            </label>
            <label className="text-sm font-medium">Email
              <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="lead@example.com" />
            </label>
            <label className="text-sm font-medium">City
              <input value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="City" />
            </label>
            <label className="text-sm font-medium">Source
              <input value={form.source} onChange={e => setForm(p => ({...p, source: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Referral, Website…" />
            </label>
            <label className="text-sm font-medium">Priority
              <select value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {["HIGH", "MEDIUM", "LOW"].map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Status
              <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {["NEW", "QUALIFIED", "LOST", "CONVERTED"].map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Estimated value (₹)
              <input type="number" min="0" step="0.01" value={form.value} onChange={e => setForm(p => ({...p, value: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0" />
            </label>
            <label className="text-sm font-medium">Next follow-up
              <input type="datetime-local" value={form.nextFollowUp} onChange={e => setForm(p => ({...p, nextFollowUp: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium sm:col-span-2">Requirement
              <textarea value={form.requirement} onChange={e => setForm(p => ({...p, requirement: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={2} placeholder="What does the lead need?" />
            </label>
            <label className="text-sm font-medium sm:col-span-2">Notes
              <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={2} placeholder="Any extra notes…" />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {createMutation.isPending || updateMutation.isPending ? "Saving…" : editLead ? "Update lead" : "Create lead"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      )}

      {leads.length === 0 ? (
        <EmptyState title="No leads yet" description="Create your first lead to start tracking prospects." />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Follow-up</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{lead.name}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex items-center gap-1"><Phone size={12} className="text-slate-400" />{lead.phone || "—"}</div>
                      {lead.email && <div className="flex items-center gap-1"><Mail size={12} className="text-slate-400" />{lead.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{lead.city || "—"}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-${PRIORITY_COLORS[lead.priority] || "slate"}-700 bg-${PRIORITY_COLORS[lead.priority] || "slate"}-50`}>{lead.priority}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-${STATUS_COLORS[lead.status] || "slate"}-700 bg-${STATUS_COLORS[lead.status] || "slate"}-50`}>{lead.status}</span></td>
                    <td className="px-4 py-3 tabular-nums text-slate-900">{formatRupees(lead.value)}</td>
                    <td className="px-4 py-3 text-slate-700">{lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => { setEditLead(lead); setForm({ name: lead.name, contactPerson: lead.contactPerson || "", phone: lead.phone || "", email: lead.email || "", city: lead.city || "", source: lead.source || "", priority: lead.priority, status: lead.status, value: String(lead.value / 100), notes: lead.notes || "", requirement: lead.requirement || "", nextFollowUp: lead.nextFollowUp ? lead.nextFollowUp.slice(0, 16) : "" }); setShowForm(true); }} className="inline-flex items-center rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600"><Edit size={14} /></button>
                      <button onClick={() => { if (window.confirm("Delete this lead?")) deleteMutation.mutate(lead.id); }} className="inline-flex items-center rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-600"><Trash2 size={14} /></button>
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