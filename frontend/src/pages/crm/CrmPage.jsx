/**
 * Velora CRM — The operating system for customer relationships.
 *
 * Tabs: Dashboard | Pipeline | Customers | Search | Customer360
 *
 * FIX: Previously navigated to `/crm/customer/${id}` which doesn't exist
 * as a route.  Now uses an in-page "customer360" tab to show the customer
 * 360° view, avoiding the need for a new route and preventing the
 * "Invalid UUID" error when navigating with undefined IDs.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Globe, Phone, Mail, MapPin, Building2, Users,
  Search, RefreshCw, ArrowUpRight, Calendar, ArrowLeft,
  WalletCards, FileText, Activity,
} from "lucide-react";
import { crmApi, coreApi } from "../../services/api";
import { isUsableUuid } from "../../utils/uuid.js";
import { formatRupees } from "../../utils/money";
import { ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { Card, Cell, Head, KpiTile, Pill, SectionHeader, StatusPill, TableShell, date, number } from "../inventory/components/shared";

const TABS = [
  ["dashboard", BarChart3, "CRM Dashboard"],
  ["pipeline", Users, "Pipeline"],
  ["customers", Building2, "Customers"],
  ["search", Search, "Search"],
];

export function CrmPage() {
  const [tab, setTab] = useState(localStorage.getItem("crm_tab") || "dashboard");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const switchTab = (t) => { setTab(t); setSelectedCustomerId(null); localStorage.setItem("crm_tab", t); };

  const dashQuery = useQuery({
    queryKey: ["crm-dashboard"],
    queryFn: crmApi.dashboard,
    staleTime: 60 * 1000,
    enabled: tab === "dashboard",
  });

  const customersQuery = useQuery({
    queryKey: ["crm-customers"],
    queryFn: () => coreApi.list("customers", { limit: 100 }),
    staleTime: 60 * 1000,
    enabled: tab === "customers",
  });

  // Guard: only fetch customer 360 if we have a valid UUID
  const viewCustomer = (id) => {
    if (isUsableUuid(id)) {
      setSelectedCustomerId(id);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader title="Customer Relationship Management"
        description="Manage leads, customers, pipeline, and relationships."
        actions={<SecondaryButton label="Refresh" icon={RefreshCw} onClick={() => dashQuery.refetch()} />} />

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map(([key, Icon, label]) => (
          <button key={key} onClick={() => switchTab(key)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${tab === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {selectedCustomerId ? (
        <Customer360View customerId={selectedCustomerId} onBack={() => setSelectedCustomerId(null)} />
      ) : (
        <>
          {tab === "dashboard" && <DashboardTab data={dashQuery} onViewCustomer={viewCustomer} />}
          {tab === "pipeline" && <PipelineTab />}
          {tab === "customers" && <CustomersTab query={customersQuery} onSelect={viewCustomer} />}
          {tab === "search" && <SearchTab onSelect={viewCustomer} />}
        </>
      )}
    </div>
  );
}

// ─── Customer 360° View (in-page) ────────────────────────────────

function Customer360View({ customerId, onBack }) {
  const query = useQuery({
    queryKey: ["crm-customer-360", customerId],
    queryFn: () => crmApi.customer360(customerId),
    staleTime: 60 * 1000,
    enabled: isUsableUuid(customerId),
  });

  if (query.isPending) return <SkeletonTable rows={8} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} />;
  const data = query.data?.data;
  if (!data || !data.customer) return <EmptyState title="Customer not found" />;

  const { customer, recentInvoices, recentPayments, timeline } = data;
  const summary = data.summary || {};

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800">
        <ArrowLeft size={16} /> Back to Customers
      </button>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{customer.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{customer.gstin || "No GSTIN"} · {customer.email || "No email"}</p>
          </div>
          <Building2 size={22} className="text-blue-600" />
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Total Invoiced" value={formatRupees(summary.totalInvoiced)} tone="blue" icon={BarChart3} />
        <KpiTile label="Total Paid" value={formatRupees(summary.totalPaid)} tone="emerald" icon={ArrowUpRight} />
        <KpiTile label="Outstanding" value={formatRupees(summary.outstanding)} tone={summary.outstanding > 0 ? "rose" : "emerald"} icon={WalletCards} />
        <KpiTile label="Invoices" value={summary.invoiceCount} tone="slate" icon={FileText} />
      </section>

      {recentInvoices?.length > 0 && (
        <Card>
          <SectionHeader title="Recent Invoices" icon={FileText} />
          <TableShell>
            <Head><th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th></Head>
            <tbody className="divide-y divide-slate-100">
              {recentInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <Cell className="font-mono text-xs">{inv.documentNo}</Cell>
                  <Cell className="text-sm text-slate-600">{date(inv.documentDate)}</Cell>
                  <Cell className="font-semibold">{formatRupees(inv.totalAmount)}</Cell>
                  <Cell><StatusPill status={inv.status} /></Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
      )}

      {recentPayments?.length > 0 && (
        <Card>
          <SectionHeader title="Recent Payments" icon={ArrowUpRight} />
          {recentPayments.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div>
                <p className="font-medium text-slate-950">{p.paymentNumber}</p>
                <p className="text-xs text-slate-500">{date(p.paymentDate)} · {p.mode}</p>
              </div>
              <p className="font-semibold text-emerald-700">{formatRupees(p.amount)}</p>
            </div>
          ))}
        </Card>
      )}

      {timeline?.length > 0 && (
        <Card>
          <SectionHeader title="Activity Timeline" icon={Activity} />
          {timeline.slice(0, 15).map((t, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div>
                <p className="font-medium text-slate-950">{t.title}</p>
                <p className="text-xs text-slate-500">{date(t.date)} · {t.type}</p>
              </div>
              <div className="text-right">
                {t.amount ? <p className="font-semibold tabular-nums">{formatRupees(t.amount)}</p> : null}
                {t.status ? <StatusPill status={t.status} /> : null}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────

function DashboardTab({ data: query, onViewCustomer }) {
  if (query.isPending) return <div className="space-y-4"><SkeletonCards count={6} /><SkeletonTable rows={5} cols={4} /></div>;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const d = query.data?.data;
  if (!d) return <EmptyState title="No CRM data" />;
  // Defensive: the backend can return a partial/version-skewed payload. Guard
  // nested containers so a missing `pipeline`/`kpis` renders an empty state
  // instead of a deterministic render crash.
  const k = d.kpis || {};
  const pipeline = d.pipeline || [];

  return (
    <div className="space-y-6">
      {/* Pipeline overview */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {pipeline.map((stage) => (
          <Card key={stage.stage} padding="p-4" className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stage.stage}</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{number(stage.count)}</p>
            {stage.value > 0 && <p className="text-xs text-slate-500 mt-1">{formatRupees(stage.value)}</p>}
          </Card>
        ))}
      </section>

      {/* KPI Grid */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Total Leads" value={k.totalLeads} tone="blue" icon={Users} detail={`${k.newLeads} new this month`} />
        <KpiTile label="Qualified" value={k.qualifiedLeads} tone="amber" icon={BarChart3} />
        <KpiTile label="Won" value={k.wonLeads} tone="emerald" icon={ArrowUpRight} />
        <KpiTile label="Customers" value={k.totalCustomers} tone="purple" icon={Building2} />
      </section>

      {/* Today's Follow-ups + Recent Leads */}
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Today's Follow-ups" description="Leads needing attention" icon={Calendar} />
          {d.todayFollowUps?.length ? d.todayFollowUps.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div><p className="font-medium text-slate-950">{f.name}</p><p className="text-xs text-slate-500">{f.contactPerson || f.phone || "—"}</p></div>
              <div className="text-right"><Pill tone={f.status === "QUALIFIED" ? "amber" : "slate"}>{f.status}</Pill></div>
            </div>
          )) : <EmptyState title="No follow-ups today" />}
        </Card>

        <Card>
          <SectionHeader title="Recent Leads" description="Latest additions" icon={Users} />
          {d.recentLeads?.length ? d.recentLeads.slice(0, 8).map((l) => (
            <div key={l.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div><p className="font-medium text-slate-950">{l.name}</p><p className="text-xs text-slate-500">{l.city || l.source || "—"}</p></div>
              <div className="text-right"><StatusPill status={l.status} /><p className="text-xs text-slate-500 mt-0.5">{l.value ? formatRupees(l.value) : ""}</p></div>
            </div>
          )) : <EmptyState title="No leads yet" />}
        </Card>
      </section>
    </div>
  );
}

// ─── Pipeline Tab ─────────────────────────────────────────────────

function PipelineTab() {
  const [stage, setStage] = useState("ALL");
  const query = useQuery({ queryKey: ["crm-pipeline", stage], queryFn: () => crmApi.pipeline(stage), staleTime: 30 * 1000 });
  const stages = ["ALL", "NEW", "QUALIFIED", "LOST", "CONVERTED"];

  if (query.isPending) return <SkeletonTable rows={8} cols={6} />;

  const leads = query.data?.data || [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {stages.map((s) => (
          <button key={s} onClick={() => setStage(s)}
            className={`min-h-9 rounded-lg px-4 text-xs font-semibold ${stage === s ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {s === "ALL" ? "All Stages" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <TableShell>
        <Head>
          <th className="px-4 py-3">Company</th>
          <th className="px-4 py-3">Contact</th>
          <th className="px-4 py-3">Phone</th>
          <th className="px-4 py-3">Value</th>
          <th className="px-4 py-3">Priority</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Source</th>
          <th className="px-4 py-3">Follow-up</th>
        </Head>
        <tbody className="divide-y divide-slate-100">
          {leads.length ? leads.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50">
              <Cell className="font-medium text-slate-950">{l.name}</Cell>
              <Cell className="text-slate-600">{l.contactPerson || "—"}</Cell>
              <Cell className="font-mono text-xs text-slate-600">{l.phone || "—"}</Cell>
              <Cell className="font-semibold tabular-nums">{formatRupees(l.value)}</Cell>
              <Cell><Pill tone={l.priority === "HIGH" ? "rose" : l.priority === "MEDIUM" ? "amber" : "slate"}>{l.priority}</Pill></Cell>
              <Cell><StatusPill status={l.status} /></Cell>
              <Cell className="text-xs text-slate-600">{l.source?.replace(/_/g, " ") || "—"}</Cell>
              <Cell className="text-xs text-slate-600">{l.nextFollowUp ? date(l.nextFollowUp) : "—"}</Cell>
            </tr>
          )) : (
            <tr><Cell colSpan={8} className="py-12 text-center text-slate-500">No leads found for this stage.</Cell></tr>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────

function CustomersTab({ query, onSelect }) {
  if (query.isPending) return <SkeletonTable rows={8} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} />;
  const customers = query.data?.data || [];

  return (
    <TableShell>
      <Head>
        <th className="px-4 py-3">Name</th>
        <th className="px-4 py-3">GST</th>
        <th className="px-4 py-3">Contact</th>
        <th className="px-4 py-3">Credit Limit</th>
        <th className="px-4 py-3">Terms</th>
      </Head>
      <tbody className="divide-y divide-slate-100">
        {customers.length ? customers.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(c.id)}>
            <Cell className="font-medium text-slate-950">{c.name}</Cell>
            <Cell className="font-mono text-xs text-slate-600">{c.gstin || "—"}</Cell>
            <Cell className="text-slate-600">{c.billingAddress?.city || "—"}</Cell>
            <Cell className="tabular-nums">{c.creditLimit ? formatRupees(c.creditLimit) : "—"}</Cell>
            <Cell className="text-slate-600">{c.creditDays ? `${c.creditDays}d` : "—"}</Cell>
          </tr>
        )) : (
          <tr><Cell colSpan={5} className="py-12 text-center text-slate-500">No customers found.</Cell></tr>
        )}
      </tbody>
    </TableShell>
  );
}

// ─── Search Tab ───────────────────────────────────────────────────

function SearchTab({ onSelect }) {
  const [query, setQuery] = useState("");
  const searchQuery = useQuery({
    queryKey: ["crm-search", query],
    queryFn: () => crmApi.search(query),
    enabled: query.length >= 2,
    staleTime: 15 * 1000,
  });

  const results = searchQuery.data?.data;

  return (
    <div className="space-y-4">
      <label className="relative block max-w-lg">
        <Search size={18} className="pointer-events-none absolute left-4 top-4 text-slate-400" />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customers, leads, invoices…"
          className="h-14 w-full rounded-xl border-2 border-slate-200 bg-white pl-12 pr-4 text-lg outline-none transition focus:border-blue-500" />
      </label>

      {query.length >= 2 && searchQuery.isPending && <SkeletonTable rows={4} cols={3} />}

      {results && (
        <div className="space-y-4">
          {results.customers?.length > 0 && (
            <Card>
              <SectionHeader title="Customers" icon={Building2} description={`${results.customers.length} results`} />
              {results.customers.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 cursor-pointer hover:bg-slate-50 px-2 rounded-lg" onClick={() => onSelect(c.id)}>
                  <div><p className="font-medium">{c.name}</p><p className="text-xs text-slate-500">{c.gstin || c.panNumber || ""}</p></div>
                  <ArrowUpRight size={16} className="text-slate-400" />
                </div>
              ))}
            </Card>
          )}
          {results.leads?.length > 0 && (
            <Card>
              <SectionHeader title="Leads" icon={Users} description={`${results.leads.length} results`} />
              {results.leads.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 px-2 rounded-lg">
                  <div><p className="font-medium">{l.name}</p><p className="text-xs text-slate-500">{l.contactPerson || l.phone || ""}</p></div>
                  <StatusPill status={l.status} />
                </div>
              ))}
            </Card>
          )}
          {!results.customers?.length && !results.leads?.length && !results.invoices?.length && (
            <EmptyState title="No results" description={`No matches found for "${query}"`} />
          )}
        </div>
      )}
    </div>
  );
}
