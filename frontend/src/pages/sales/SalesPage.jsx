import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, DollarSign, FileText, Package, Plus, RefreshCw,
  ShoppingCart, TrendingUp, Truck, Users, X, CheckCircle2,
} from "lucide-react";
import { salesApi, leadsApi, coreApi } from "../../services/api";
import { formatRupees } from "../../utils/money";
import { ErrorBanner, ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { AddButton, PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { Card, Cell, Head, KpiTile, Pill, SectionHeader, StatusPill, TableShell, date, number, exportCsv } from "../inventory/components/shared";

const TABS = [
  ["dashboard", BarChart3, "KPIs & charts"],
  ["leads", Users, "Lead management"],
  ["quotations", FileText, "Quotations"],
  ["orders", ShoppingCart, "Sales orders"],
  ["invoices", DollarSign, "Invoices"],
  ["receipts", Truck, "Payment receipts"],
];

export function SalesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(localStorage.getItem("sales_tab") || "dashboard");

  const switchTab = (t) => { setTab(t); localStorage.setItem("sales_tab", t); };

  // Masters
  const masters = useQuery({
    queryKey: ["sales-masters"],
    queryFn: async () => {
      const [cRes, iRes] = await Promise.all([
        coreApi.list("customers", { limit: 200 }),
        coreApi.list("items", { limit: 500 }),
      ]);
      return { customers: cRes.data || [], items: iRes.data || [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const dashQuery = useQuery({
    queryKey: ["sales-dashboard"],
    queryFn: () => salesApi.dashboard(),
    staleTime: 60 * 1000,
    enabled: tab === "dashboard",
  });

  const customers = masters.data?.customers || [];
  const items = masters.data?.items || [];
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader title="Sales Management" description="Leads, quotations, orders, invoices, and collections."
        actions={<SecondaryButton label="Refresh" icon={RefreshCw} onClick={() => qc.invalidateQueries({ queryKey: ["sales"] })} />} />

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map(([key, Icon, hint]) => (
          <button key={key} onClick={() => switchTab(key)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${tab === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
            <Icon size={16} /> {key === "dashboard" ? "Dashboard" : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab data={dashQuery} />}
      {tab === "leads" && <LeadsTab />}
      {tab === "quotations" && <QuotationsTab customerMap={customerMap} items={items} />}
      {tab === "orders" && <SalesOrdersTab customerMap={customerMap} />}
      {tab === "invoices" && <InvoicesTab customerMap={customerMap} />}
      {tab === "receipts" && <ReceiptsTab customerMap={customerMap} />}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────

function DashboardTab({ data: query }) {
  const qc = useQueryClient();
  if (query.isPending) return <div className="space-y-4"><SkeletonCards count={6} /><SkeletonTable rows={5} cols={4} /></div>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["sales-dashboard"] })} />;
  const d = query.data?.data;
  if (!d) return <EmptyState title="No sales data" description="Create invoices to see dashboard insights." />;
  const k = d.kpis;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiTile label="Total Revenue" value={k.totalRevenue} tone="blue" icon={TrendingUp} formatter={formatRupees} detail={`${k.totalInvoices} invoices`} />
        <KpiTile label="Monthly Revenue" value={k.monthlyRevenue} tone="emerald" icon={BarChart3} formatter={formatRupees} detail={`${k.monthlyInvoices} invoices this month`} />
        <KpiTile label="Pending Orders" value={k.pendingSOs} tone="amber" icon={ShoppingCart} detail={`${k.totalSOs} total orders`} />
        <KpiTile label="Deliveries" value={k.totalDNs} tone="purple" icon={Truck} detail="Delivery notes" />
        <KpiTile label="Collections" value={k.monthlyCollections} tone="emerald" icon={DollarSign} formatter={formatRupees} detail="This month" />
        <KpiTile label="Total Orders" value={k.totalSOs} tone="slate" icon={ShoppingCart} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Top Customers" description="By invoice value" icon={Users} />
          {d.topCustomers?.length ? d.topCustomers.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 mb-2">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">{i + 1}</span>
                <div><p className="font-medium text-slate-950">{c.name}</p><p className="text-xs text-slate-500">{c.orderCount} orders</p></div>
              </div>
              <p className="font-semibold tabular-nums">{formatRupees(c.totalAmount)}</p>
            </div>
          )) : <EmptyState title="No customer data" description="Invoiced customers appear here." />}
        </Card>
        <Card>
          <SectionHeader title="Recent Orders" description="Latest activity" icon={FileText} />
          {d.recentActivity?.length ? d.recentActivity.slice(0, 8).map((a) => (
            <div key={a.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
              <div className="min-w-0"><p className="truncate font-medium text-slate-950">{a.documentNo}</p><p className="text-xs text-slate-500">{a.customerName}</p></div>
              <div className="text-right"><StatusPill status={a.status} /><p className="mt-0.5 text-xs text-slate-500">{formatRupees(a.totalAmount)}</p></div>
            </div>
          )) : <EmptyState title="No activity" />}
        </Card>
      </section>
    </div>
  );
}

// ─── Leads ────────────────────────────────────────────────────────

const blankLead = { name: "", contactPerson: "", phone: "", email: "", city: "", source: "REFERENCE", priority: "MEDIUM", status: "NEW", value: "", nextFollowUp: "", requirement: "", notes: "" };

function LeadsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState(blankLead);
  const query = useQuery({ queryKey: ["leads"], queryFn: leadsApi.list });
  const leads = query.data?.data || [];

  const create = useMutation({ mutationFn: () => leadsApi.create(form), onSuccess: () => { setForm(blankLead); qc.invalidateQueries({ queryKey: ["leads"] }); } });
  const update = useMutation({ mutationFn: ({ id, input }) => leadsApi.update(id, input), onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }) });
  const remove = useMutation({ mutationFn: leadsApi.remove, onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }) });

  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["leads"] })} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Add Lead</h2>
        <div className="mt-4 space-y-3">
          {[["name", "Company Name", "text"], ["contactPerson", "Contact", "text"], ["phone", "Phone", "text"], ["email", "Email", "email"], ["city", "City", "text"], ["value", "Deal Value (₹)", "number"], ["nextFollowUp", "Follow-up", "date"]].map(([k, label, type]) => (
            <label key={k} className="block text-sm font-medium text-slate-700">{label}<input type={type} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" /></label>
          ))}
          {[["priority", "Priority", ["LOW", "MEDIUM", "HIGH"]], ["status", "Status", ["NEW", "QUALIFIED", "CONVERTED", "LOST"]], ["source", "Source", ["REFERENCE", "COLD_CALL", "WEBSITE", "EXHIBITION", "SOCIAL_MEDIA", "OTHER"]]].map(([k, label, opts]) => (
            <label key={k} className="block text-sm font-medium text-slate-700">{label}<select value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{opts.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select></label>
          ))}
        </div>
        <ErrorBanner error={create.error} />
        <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60" disabled={create.isPending}><Plus size={16} /> {create.isPending ? "Saving..." : "Add Lead"}</button>
      </form>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4"><h2 className="font-semibold">Leads ({leads.length})</h2></div>
        {query.isPending ? <SkeletonTable rows={5} cols={5} /> : !leads.length ? <div className="p-5"><EmptyState title="No Leads" description="Add your first lead." /></div> : (
          <TableShell>
            <Head><th className="px-3 py-3">Company</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Value</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Follow-up</th><th className="px-3 py-3 text-right"></th></Head>
            <tbody className="divide-y divide-slate-100">{leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50">
                <Cell className="font-medium">{lead.name}</Cell>
                <Cell className="text-slate-600">{lead.contactPerson || lead.phone || "—"}</Cell>
                <Cell className="font-semibold tabular-nums">{formatRupees(lead.value)}</Cell>
                <Cell><select value={lead.status} onChange={(e) => update.mutate({ id: lead.id, input: { status: e.target.value } })} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold">{["NEW", "QUALIFIED", "CONVERTED", "LOST"].map((s) => <option key={s}>{s}</option>)}</select></Cell>
                <Cell className={`text-sm ${lead.nextFollowUp && new Date(lead.nextFollowUp) < new Date() ? "text-rose-600 font-medium" : "text-slate-600"}`}>{lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString("en-IN") : "—"}</Cell>
                <Cell className="text-right"><button onClick={() => remove.mutate(lead.id)} className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:bg-rose-50"><X size={14} /></button></Cell>
              </tr>
            ))}</tbody></TableShell>
        )}
      </div>
    </div>
  );
}

// ─── Generic doc list tab ─────────────────────────────────────────

function DocListTab({ queryKey, queryFn, columns, renderRow }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey, queryFn });
  if (query.isPending) return <SkeletonTable rows={6} cols={columns.length} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey })} />;
  const docs = query.data?.data || [];
  return (
    <TableShell>
      <Head>{columns.map((c) => <th key={c.key || c.label} className="px-4 py-3">{c.label}</th>)}</Head>
      <tbody className="divide-y divide-slate-100">{docs.length ? docs.map((doc) => renderRow(doc)) : <tr><td colSpan={columns.length} className="py-12 text-center text-slate-500">No records found.</td></tr>}</tbody>
    </TableShell>
  );
}

// ─── Quotations ───────────────────────────────────────────────────

function QuotationsTab({ customerMap, items }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ customerId: "", lines: [{ itemId: "", quantity: 1, rate: 0, gstRate: 18 }] });

  const createMutation = useMutation({
    mutationFn: (data) => salesApi.createQuotation(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotations"] }); setShowCreate(false); },
  });

  const convert = useMutation({
    mutationFn: (id) => salesApi.convertQuotation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotations"] }); qc.invalidateQueries({ queryKey: ["sales-orders"] }); },
  });

  if (showCreate) {
    return (
      <Card>
        <SectionHeader title="New Quotation" icon={FileText} actions={<button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>} />
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ customerId: form.customerId, lines: form.lines.map((l) => ({ itemId: l.itemId || undefined, quantity: Number(l.quantity), rate: Number(l.rate), gstRate: Number(l.gstRate) })) }); }}>
          <label className="text-sm font-medium">Customer<select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="mt-1 h-11 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Select</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <div className="mt-4 space-y-2">
            {form.lines.map((line, idx) => (
              <div key={idx} className="flex flex-wrap gap-2 rounded-lg bg-slate-50 p-2 border">
                <select value={line.itemId} onChange={(e) => { const updated = [...form.lines]; updated[idx] = { ...updated[idx], itemId: e.target.value }; setForm({ ...form, lines: updated }); }} className="h-10 flex-1 min-w-[120px] rounded border bg-white px-2 text-xs"><option value="">Item</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
                <input type="number" placeholder="Qty" value={line.quantity} onChange={(e) => { const updated = [...form.lines]; updated[idx] = { ...updated[idx], quantity: e.target.value }; setForm({ ...form, lines: updated }); }} className="h-10 w-20 rounded border px-2 text-xs" />
                <input type="number" placeholder="Rate" value={line.rate} onChange={(e) => { const updated = [...form.lines]; updated[idx] = { ...updated[idx], rate: e.target.value }; setForm({ ...form, lines: updated }); }} className="h-10 w-24 rounded border px-2 text-xs" />
                {form.lines.length > 1 && <button type="button" onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })} className="p-2 text-rose-500"><X size={16} /></button>}
              </div>
            ))}
            <button type="button" onClick={() => setForm({ ...form, lines: [...form.lines, { itemId: "", quantity: 1, rate: 0, gstRate: 18 }] })} className="text-xs font-semibold text-blue-600">+ Add item</button>
          </div>
          {createMutation.error && <div className="mt-3"><ErrorBanner error={createMutation.error} /></div>}
          <button type="submit" disabled={createMutation.isPending} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{createMutation.isPending ? "Creating…" : "Create Quotation"}</button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><AddButton label="New Quotation" onClick={() => setShowCreate(true)} /></div>
      <DocListTab queryKey={["quotations"]} queryFn={() => salesApi.quotations()} columns={[{ label: "Date", key: "date" }, { label: "No", key: "no" }, { label: "Customer", key: "customer" }, { label: "Amount", key: "amount" }, { label: "Status", key: "status" }, { label: "", key: "actions" }]}
        renderRow={(doc) => (
          <tr key={doc.id} className="hover:bg-slate-50">
            <Cell className="text-slate-600">{date(doc.documentDate)}</Cell>
            <Cell className="font-mono text-xs text-blue-700">{doc.documentNo}</Cell>
            <Cell className="text-slate-700">{customerMap.get(doc.partyId)?.name || doc.partyId?.slice(0, 8) || "—"}</Cell>
            <Cell className="font-semibold tabular-nums">{formatRupees(doc.totalAmount)}</Cell>
            <Cell><StatusPill status={doc.status} /></Cell>
            <Cell className="text-right">{doc.status === "DRAFT" && <button onClick={() => convert.mutate(doc.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"><CheckCircle2 size={13} /> Convert</button>}</Cell>
          </tr>
        )}
      />
    </div>
  );
}

// ─── Sales Orders ─────────────────────────────────────────────────

function SalesOrdersTab({ customerMap }) {
  return (
    <DocListTab queryKey={["sales-orders"]} queryFn={() => salesApi.salesOrders()}
      columns={[{ label: "Date" }, { label: "Order #" }, { label: "Customer" }, { label: "Amount" }, { label: "Status" }]}
      renderRow={(doc) => (
        <tr key={doc.id} className="hover:bg-slate-50">
          <Cell className="text-slate-600">{date(doc.documentDate)}</Cell>
          <Cell className="font-mono text-xs text-blue-700">{doc.documentNo}</Cell>
          <Cell className="text-slate-700">{customerMap.get(doc.partyId)?.name || doc.partyId?.slice(0, 8) || "—"}</Cell>
          <Cell className="font-semibold tabular-nums">{formatRupees(doc.totalAmount)}</Cell>
          <Cell><StatusPill status={doc.status} /></Cell>
        </tr>
      )}
    />
  );
}

// ─── Invoices ─────────────────────────────────────────────────────

function InvoicesTab({ customerMap }) {
  return (
    <DocListTab queryKey={["invoices"]} queryFn={() => salesApi.invoices()}
      columns={[{ label: "Date" }, { label: "Invoice #" }, { label: "Customer" }, { label: "Amount" }, { label: "Status" }]}
      renderRow={(doc) => (
        <tr key={doc.id} className="hover:bg-slate-50">
          <Cell className="text-slate-600">{date(doc.documentDate)}</Cell>
          <Cell className="font-mono text-xs text-blue-700">{doc.documentNo}</Cell>
          <Cell className="text-slate-700">{customerMap.get(doc.partyId)?.name || doc.partyId?.slice(0, 8) || "—"}</Cell>
          <Cell className="font-semibold tabular-nums">{formatRupees(doc.totalAmount)}</Cell>
          <Cell><StatusPill status={doc.status} /></Cell>
        </tr>
      )}
    />
  );
}

// ─── Receipts ─────────────────────────────────────────────────────

function ReceiptsTab({ customerMap }) {
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
        <h2 className="text-base font-semibold">Record Receipt</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">Amount (₹)<input type="number" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" /></label>
          <label className="block text-sm font-medium">Mode<select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{["CASH", "CHEQUE", "NEFT", "RTGS", "UPI", "CARD"].map((m) => <option key={m}>{m}</option>)}</select></label>
          <label className="block text-sm font-medium">Reference<input value={form.referenceNo} onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
          <label className="block text-sm font-medium">Date<input type="date" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
        </div>
        <ErrorBanner error={create.error} />
        <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60" disabled={create.isPending}><Plus size={16} /> {create.isPending ? "Saving..." : "Record Receipt"}</button>
      </form>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-600">Recent Receipts</h2>
        {query.isPending ? <SkeletonTable rows={4} cols={4} /> : !receipts.length ? <EmptyState title="No Receipts" /> : (
          <TableShell>
            <Head><th className="px-3 py-3">No</th><th className="px-3 py-3">Date</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Mode</th></Head>
            <tbody className="divide-y divide-slate-100">{receipts.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Cell className="font-mono text-xs">{r.paymentNumber}</Cell>
                <Cell className="text-slate-600">{date(r.paymentDate)}</Cell>
                <Cell className="text-right font-semibold tabular-nums">{formatRupees(r.amount)}</Cell>
                <Cell><Pill tone="blue">{r.mode}</Pill></Cell>
              </tr>
            ))}</tbody></TableShell>
        )}
      </div>
    </div>
  );
}
