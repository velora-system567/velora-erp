import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, FileText, DollarSign, RefreshCw, Truck, BarChart3, Building2 } from "lucide-react";
import { supplierPortalApi } from "../../services/api";
import { ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { Card, Cell, Head, KpiTile, Pill, SectionHeader, StatusPill, TableShell, date, number, formatRupees } from "../inventory/components/shared";
import { formatRupees as fmtRupees } from "../../utils/money";

const TABS = [
  ["dashboard", BarChart3, "Dashboard"],
  ["orders", ShoppingBag, "Purchase Orders"],
  ["invoices", FileText, "Invoices"],
  ["payments", DollarSign, "Payments"],
];

export function SupplierPortalPage() {
  const [tab, setTab] = useState("dashboard");
  const [vendorId, setVendorId] = useState("");

  const vendorsQuery = useQuery({ queryKey: ["portal-vendors"], queryFn: () => supplierPortalApi.vendors(), staleTime: 5 * 60 * 1000 });
  const dashQuery = useQuery({
    queryKey: ["portal-dashboard", vendorId],
    queryFn: () => supplierPortalApi.dashboard(vendorId ? { vendorId } : {}),
    staleTime: 60 * 1000,
    enabled: tab === "dashboard",
  });
  const poQuery = useQuery({
    queryKey: ["portal-pos", vendorId],
    queryFn: () => supplierPortalApi.purchaseOrders(vendorId ? { vendorId } : {}),
    staleTime: 30 * 1000,
    enabled: tab === "orders",
  });
  const invQuery = useQuery({
    queryKey: ["portal-invoices", vendorId],
    queryFn: () => supplierPortalApi.invoices(vendorId ? { vendorId } : {}),
    staleTime: 30 * 1000,
    enabled: tab === "invoices",
  });
  const payQuery = useQuery({
    queryKey: ["portal-payments", vendorId],
    queryFn: () => supplierPortalApi.payments(vendorId ? { vendorId } : {}),
    staleTime: 30 * 1000,
    enabled: tab === "payments",
  });

  const vendors = vendorsQuery.data?.data || [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader title="Supplier Portal" description="Collaborate with suppliers — orders, invoices, and payments."
        actions={<SecondaryButton label="Refresh" icon={RefreshCw} onClick={() => vendorsQuery.refetch()} />} />

      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm items-center">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map(([key, Icon, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${tab === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={16} />{label}</button>
          ))}
        </div>
        <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="ml-auto h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm max-w-56">
          <option value="">All Suppliers</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {tab === "dashboard" && <DashboardTab data={dashQuery} />}
      {tab === "orders" && <PoTab query={poQuery} />}
      {tab === "invoices" && <InvoiceTab query={invQuery} />}
      {tab === "payments" && <PaymentTab query={payQuery} />}
    </div>
  );
}

function DashboardTab({ data: query }) {
  if (query.isPending) return <div className="space-y-4"><SkeletonCards count={4} /></div>;
  if (query.isError) return <ErrorState error={query.error} />;
  const d = query.data?.data;
  if (!d) return <EmptyState title="No data" />;
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile label="Pending Orders" value={d.kpis.pendingPOs} tone="amber" icon={ShoppingBag} />
      <KpiTile label="Approved Orders" value={d.kpis.approvedPOs} tone="emerald" icon={ShoppingBag} detail={`${d.kpis.completedPOs} completed`} />
      <KpiTile label="Invoices" value={d.kpis.totalInvoices} tone="blue" icon={FileText} />
      <KpiTile label="Payments" value={d.kpis.totalPayments} tone="purple" icon={DollarSign} detail={fmtRupees(d.kpis.pendingAmount)} />
    </section>
  );
}

function PoTab({ query }) {
  if (query.isPending) return <SkeletonTable rows={6} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} />;
  const docs = query.data?.data || [];
  const meta = query.data?.meta;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{meta?.total || docs.length} purchase orders</p>
      {docs.length ? (
        <TableShell>
          <Head><th className="px-4 py-3">PO #</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th></Head>
          <tbody className="divide-y divide-slate-100">{docs.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <Cell className="font-mono text-xs font-semibold text-blue-700">{d.documentNo}</Cell>
              <Cell className="text-slate-600">{date(d.documentDate)}</Cell>
              <Cell className="text-slate-700">{d.vendorName}</Cell>
              <Cell className="text-right font-semibold tabular-nums">{fmtRupees(d.totalAmount)}</Cell>
              <Cell><StatusPill status={d.status} /></Cell>
            </tr>
          ))}</tbody>
        </TableShell>
      ) : <EmptyState title="No purchase orders" />}
    </div>
  );
}

function InvoiceTab({ query }) {
  if (query.isPending) return <SkeletonTable rows={6} cols={5} />;
  if (query.isError) return <ErrorState error={query.error} />;
  const docs = query.data?.data || [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{docs.length} invoices</p>
      {docs.length ? (
        <TableShell>
          <Head><th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Taxable</th><th className="px-4 py-3 text-right">GST</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Status</th></Head>
          <tbody className="divide-y divide-slate-100">{docs.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <Cell className="font-mono text-xs text-blue-700">{d.documentNo}</Cell>
              <Cell className="text-slate-600">{date(d.documentDate)}</Cell>
              <Cell className="text-right tabular-nums">{fmtRupees(d.taxableAmount)}</Cell>
              <Cell className="text-right tabular-nums">{fmtRupees((d.cgstAmount||0)+(d.sgstAmount||0)+(d.igstAmount||0))}</Cell>
              <Cell className="text-right font-semibold tabular-nums">{fmtRupees(d.totalAmount)}</Cell>
              <Cell><StatusPill status={d.status} /></Cell>
            </tr>
          ))}</tbody>
        </TableShell>
      ) : <EmptyState title="No invoices" />}
    </div>
  );
}

function PaymentTab({ query }) {
  if (query.isPending) return <SkeletonTable rows={4} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} />;
  const rows = query.data?.data || [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{rows.length} payments</p>
      {rows.length ? (
        <TableShell>
          <Head><th className="px-4 py-3">Payment #</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Mode</th></Head>
          <tbody className="divide-y divide-slate-100">{rows.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <Cell className="font-mono text-xs">{p.paymentNumber}</Cell>
              <Cell className="text-slate-600">{date(p.paymentDate)}</Cell>
              <Cell className="text-right font-semibold tabular-nums">{fmtRupees(p.amount)}</Cell>
              <Cell><Pill tone="blue">{p.mode}</Pill></Cell>
            </tr>
          ))}</tbody>
        </TableShell>
      ) : <EmptyState title="No payments" />}
    </div>
  );
}