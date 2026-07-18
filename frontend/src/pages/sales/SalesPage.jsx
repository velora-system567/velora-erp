import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, ChevronRight, FileText, Receipt, TrendingUp, Package } from "lucide-react";
import { salesApi, leadsApi } from "../../services/api";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState, ErrorBanner } from "../../components/ErrorState";
import { SkeletonTable } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { formatRupees } from "../../utils/money";

// ─── Sub-tab navigation ───────────────────────────────────────────────────────
const TABS = ["Leads", "Quotations", "Sales Orders", "Invoices", "Receipts"];

function TabBar({ active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
            active === t ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─── Leads tab ────────────────────────────────────────────────────────────────
const blankLead = { name: "", contactPerson: "", phone: "", email: "", city: "", source: "REFERENCE", priority: "MEDIUM", status: "NEW", value: "", nextFollowUp: "", requirement: "", notes: "" };

function LeadsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState(blankLead);
  const query = useQuery({ queryKey: ["leads"], queryFn: leadsApi.list });
  const leads = query.data?.data || [];

  const create = useMutation({
    mutationFn: () => leadsApi.create(form),
    onSuccess: () => { setForm(blankLead); qc.invalidateQueries({ queryKey: ["leads"] }); },
  });
  const update = useMutation({
    mutationFn: ({ id, input }) => leadsApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
  const remove = useMutation({
    mutationFn: leadsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["leads"] })} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Add Lead</h2>
        <div className="mt-4 space-y-3">
          {[["name", "Company Name", "text"], ["contactPerson", "Contact Person", "text"], ["phone", "Phone", "text"], ["email", "Email", "text"], ["city", "City", "text"], ["value", "Deal Value (₹)", "number"], ["nextFollowUp", "Follow-up Date", "date"]].map(([k, label, type]) => (
            <label key={k} className="block text-sm font-medium text-slate-700">
              {label}
              <input type={type} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
            </label>
          ))}
          {[["priority", "Priority", ["LOW", "MEDIUM", "HIGH"]], ["status", "Status", ["NEW", "QUALIFIED", "CONVERTED", "LOST"]], ["source", "Source", ["REFERENCE", "COLD_CALL", "WEBSITE", "EXHIBITION", "SOCIAL_MEDIA", "OTHER"]]].map(([k, label, opts]) => (
            <label key={k} className="block text-sm font-medium text-slate-700">
              {label}
              <select value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500">
                {opts.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
              </select>
            </label>
          ))}
        </div>
        <ErrorBanner error={create.error} />
        <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={create.isPending}>
          <Plus size={16} /> {create.isPending ? "Saving..." : "Add Lead"}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-950">Leads ({leads.length})</h2>
        {query.isPending ? <SkeletonTable rows={5} cols={5} /> : leads.length === 0 ? (
          <EmptyState title="No Leads" description="Add your first lead to track follow-ups and deal values." action="" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>{["Company", "Contact", "City", "Value", "Stage", "Follow-up", ""].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-medium text-slate-950">{lead.name}</td>
                    <td className="px-3 py-3 text-slate-600">{lead.contactPerson || lead.phone || "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{lead.city || "—"}</td>
                    <td className="px-3 py-3 font-medium text-slate-950">{formatRupees(lead.value)}</td>
                    <td className="px-3 py-3">
                      <select value={lead.status} onChange={(e) => update.mutate({ id: lead.id, input: { status: e.target.value } })}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold">
                        {["NEW", "QUALIFIED", "CONVERTED", "LOST"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className={`px-3 py-3 text-sm ${lead.nextFollowUp && new Date(lead.nextFollowUp) < new Date() ? "text-rose-600 font-medium" : "text-slate-600"}`}>
                      {lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => remove.mutate(lead.id)} className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Generic document list tab ───────────────────────────────────────────────
function DocListTab({ queryKey, queryFn, docLabel, columns, renderRow }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey, queryFn });
  const docs = query.data?.data || [];

  if (query.isPending) return <SkeletonTable rows={6} cols={columns.length} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey })} />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>{columns.map((c) => <th key={c} className="px-4 py-3">{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {docs.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">No {docLabel} found.</td></tr>
            ) : docs.map((doc) => renderRow(doc))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Quotations tab ──────────────────────────────────────────────────────────
function QuotationsTab() {
  const qc = useQueryClient();
  const convert = useMutation({
    mutationFn: (id) => salesApi.convertQuotation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotations"] }); qc.invalidateQueries({ queryKey: ["sales-orders"] }); },
  });

  return (
    <DocListTab
      queryKey={["quotations"]}
      queryFn={() => salesApi.quotations()}
      docLabel="quotations"
      columns={["Date", "No", "Customer", "Amount", "Status", "Actions"]}
      renderRow={(doc) => (
        <tr key={doc.id} className="hover:bg-slate-50">
          <td className="px-4 py-3 text-slate-600">{new Date(doc.documentDate).toLocaleDateString("en-IN")}</td>
          <td className="px-4 py-3 font-mono text-xs text-slate-700">{doc.documentNo}</td>
          <td className="px-4 py-3 text-slate-700">{doc.partyId || "—"}</td>
          <td className="px-4 py-3 font-semibold text-slate-950">{formatRupees(doc.totalAmount)}</td>
          <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
          <td className="px-4 py-3">
            {doc.status === "DRAFT" && (
              <button onClick={() => convert.mutate(doc.id)} disabled={convert.isPending}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                <ChevronRight size={13} /> Convert to Order
              </button>
            )}
          </td>
        </tr>
      )}
    />
  );
}

// ─── Sales Orders tab ────────────────────────────────────────────────────────
function SalesOrdersTab() {
  return (
    <DocListTab
      queryKey={["sales-orders"]}
      queryFn={() => salesApi.salesOrders()}
      docLabel="sales orders"
      columns={["Date", "No", "Amount", "Status"]}
      renderRow={(doc) => (
        <tr key={doc.id} className="hover:bg-slate-50">
          <td className="px-4 py-3 text-slate-600">{new Date(doc.documentDate).toLocaleDateString("en-IN")}</td>
          <td className="px-4 py-3 font-mono text-xs text-slate-700">{doc.documentNo}</td>
          <td className="px-4 py-3 font-semibold text-slate-950">{formatRupees(doc.totalAmount)}</td>
          <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
        </tr>
      )}
    />
  );
}

// ─── Invoices tab ─────────────────────────────────────────────────────────────
function InvoicesTab() {
  return (
    <DocListTab
      queryKey={["invoices"]}
      queryFn={() => salesApi.invoices()}
      docLabel="invoices"
      columns={["Date", "No", "Taxable", "GST", "Total", "Status"]}
      renderRow={(doc) => (
        <tr key={doc.id} className="hover:bg-slate-50">
          <td className="px-4 py-3 text-slate-600">{new Date(doc.documentDate).toLocaleDateString("en-IN")}</td>
          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{doc.documentNo}</td>
          <td className="px-4 py-3 text-slate-700">{formatRupees(doc.taxableAmount)}</td>
          <td className="px-4 py-3 text-slate-700">{formatRupees(doc.cgstAmount + doc.sgstAmount + doc.igstAmount)}</td>
          <td className="px-4 py-3 font-bold text-slate-950">{formatRupees(doc.totalAmount)}</td>
          <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
        </tr>
      )}
    />
  );
}

// ─── Receipts tab ────────────────────────────────────────────────────────────
function ReceiptsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ amount: "", mode: "UPI", referenceNo: "", narration: "", paymentDate: "" });
  const query = useQuery({ queryKey: ["receipts"], queryFn: salesApi.receipts });
  const receipts = query.data?.data || [];

  const create = useMutation({
    mutationFn: () => salesApi.createReceipt(form),
    onSuccess: () => { setForm({ amount: "", mode: "UPI", referenceNo: "", narration: "", paymentDate: "" }); qc.invalidateQueries({ queryKey: ["receipts"] }); },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Record Receipt</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Amount (₹)
            <input type="number" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Payment Mode
            <select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500">
              {["CASH", "CHEQUE", "NEFT", "RTGS", "UPI", "CARD"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Reference No
            <input value={form.referenceNo} onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Payment Date
            <input type="date" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Narration
            <input value={form.narration} onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
          </label>
        </div>
        <ErrorBanner error={create.error} />
        <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={create.isPending}>
          <Receipt size={16} /> {create.isPending ? "Saving..." : "Record Receipt"}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-950">Receipts</h2>
        {query.isPending ? <SkeletonTable rows={4} cols={4} /> : receipts.length === 0 ? (
          <EmptyState title="No Receipts" description="Record your first customer payment receipt." action="" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>{["No", "Date", "Amount", "Mode", "Reference"].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono text-xs text-slate-700">{r.paymentNumber}</td>
                    <td className="px-3 py-3 text-slate-600">{new Date(r.paymentDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-3 py-3 font-bold text-slate-950">{formatRupees(r.amount)}</td>
                    <td className="px-3 py-3"><StatusBadge status={r.mode} /></td>
                    <td className="px-3 py-3 text-slate-600">{r.referenceNo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Sales Page ──────────────────────────────────────────────────────────
export function SalesPage() {
  const [activeTab, setActiveTab] = useState("Leads");

  const tabContent = {
    Leads: <LeadsTab />,
    Quotations: <QuotationsTab />,
    "Sales Orders": <SalesOrdersTab />,
    Invoices: <InvoicesTab />,
    Receipts: <ReceiptsTab />,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Sales</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Manage your entire sales pipeline — leads, quotations, orders, invoices, and collections.
            </p>
          </div>
          <TrendingUp className="hidden shrink-0 text-blue-600 sm:block" size={22} />
        </div>
      </header>

      <TabBar active={activeTab} onChange={setActiveTab} />

      <div className="min-h-[300px]">
        {tabContent[activeTab]}
      </div>
    </div>
  );
}
