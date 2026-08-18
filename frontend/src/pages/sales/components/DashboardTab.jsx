/**
 * Sales Dashboard Tab
 */
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, ArrowDownUp, ArrowUpRight, BarChart3, ClipboardList, Download,
  FileText, IndianRupee, PackagePlus, TrendingUp, Truck, Users, Zap,
} from "lucide-react";
import { salesApi, coreApi } from "../../../services/api";
import { formatRupees, formatRupeesCompact, number } from "../../../utils/format";
import { ErrorState } from "../../../components/ErrorState";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonCards } from "../../../components/Skeleton";
import { SectionHeader, KpiTile, Pill, Card, SecondaryButton } from "./shared";
import { exportCsv } from "./shared";

export default function DashboardTab() {
  const query = useQuery({
    queryKey: ["sales-dashboard"],
    queryFn: () => salesApi.dashboard(),
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  if (query.isPending) return <SkeletonCards count={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const data = query.data?.data;
  if (!data || !data.kpis) return <EmptyState title="No data available" description="The sales dashboard returned an empty payload." />;

  const k = data.kpis;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">Click a KPI to open its records</span>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiTile label="Total invoiced (all time)" value={k.totalInvoiced} tone="blue" icon={IndianRupee} formatter={formatRupeesCompact} detail={`${data.topCustomers?.length || 0} customers`} onClick={() => window.location.href = "/sales?tab=Invoices"} />
        <KpiTile label="This month invoices" value={k.monthlyInvoices} tone="emerald" icon={FileText} formatter={formatRupeesCompact} detail={`${k.monthlyInvoiceCount || 0} invoices`} onClick={() => window.location.href = "/sales?tab=Invoices"} />
        <KpiTile label="Total sales orders" value={k.totalSalesOrders} tone="purple" icon={ClipboardList} formatter={number} detail={`${k.pendingSalesOrders} pending`} onClick={() => window.location.href = "/sales?tab=Orders"} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiTile label="Pending sales orders" value={k.pendingSalesOrders} tone="amber" icon={AlertCircle} formatter={number} detail="Draft / Submitted / Approved" onClick={() => window.location.href = "/sales?tab=Orders"} />
        <KpiTile label="Delivery notes" value={k.totalDeliveryNotes} tone="blue" icon={Truck} formatter={number} detail="Stock debits" onClick={() => window.location.href = "/sales?tab=Delivery"} />
        <KpiTile label="Monthly receipts" value={k.monthlyReceipts} tone="emerald" icon={ArrowDownUp} formatter={formatRupeesCompact} detail="Collections this month" onClick={() => window.location.href = "/sales?tab=Receipts"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Top customers" description="By total invoiced (all time)." icon={Users}
            actions={data.topCustomers?.length ? <SecondaryButton label="Export CSV" icon={Download} onClick={() => exportCsv("velora-top-customers.csv", data.topCustomers, [
              { label: "Customer", value: (r) => r.name },
              { label: "Total (₹)", value: (r) => (r.totalAmount / 100).toFixed(2) },
              { label: "Invoices", value: (r) => r.invoiceCount },
            ])} /> : null}
          />
          {data.topCustomers?.length ? (
            <div className="divide-y divide-slate-100">
              {data.topCustomers.map((row, i) => (
                <div key={row.customerId} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{row.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-slate-950">{formatRupees(row.totalAmount)}</p>
                    <p className="text-xs text-slate-500">{row.invoiceCount} invoices</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No customers yet" description="Create an invoice to see top customers." />}
        </Card>

        <Card>
          <SectionHeader title="Quick actions" description="Common sales operations." icon={Zap} />
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "New quotation", href: "/sales?tab=Quotations", state: { openDocForm: true, docType: "QUOTATION" }, icon: FileText, tone: "blue" },
              { label: "New sales order", href: "/sales?tab=Orders", state: { openDocForm: true, docType: "SALES_ORDER" }, icon: ClipboardList, tone: "purple" },
              { label: "New delivery note", href: "/sales?tab=Delivery", state: { openDocForm: true, docType: "DELIVERY_NOTE" }, icon: Truck, tone: "blue" },
              { label: "Record payment", href: "/sales?tab=Receipts", state: { openReceiptForm: true }, icon: ArrowDownUp, tone: "emerald" },
            ].map((a) => (
              <button key={a.label} onClick={() => window.location.href = a.href} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                <a.icon size={18} className={`shrink-0 text-${a.tone}-600`} />
                <span className="font-medium text-slate-900">{a.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}