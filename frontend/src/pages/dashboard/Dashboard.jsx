import { useQuery } from "@tanstack/react-query";
import { Building2, ClipboardCheck, Package, ReceiptText, WalletCards } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { getDashboardKpis } from "../../services/api";

export function Dashboard() {
  const { data } = useQuery({ queryKey: ["dashboard-kpis"], queryFn: getDashboardKpis, retry: false });
  const kpis = data?.data;

  const cards = [
    ["Today's Sales", kpis?.todaysSalesPaise ?? 0, ReceiptText],
    ["Outstanding", kpis?.totalOutstandingPaise ?? 0, WalletCards],
    ["Low Stock Items", kpis?.lowStockItems?.length ?? 0, Package],
    ["Pending POs", kpis?.pendingPurchaseOrders ?? 0, ClipboardCheck],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">Business Overview</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Start with your company data</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              This ERP starts empty. Add company, branches, employees, items, customers, vendors, and opening stock to activate live KPIs.
            </p>
          </div>
          <Building2 className="text-blue-600" size={24} />
        </div>
      </header>
      <section className="grid gap-4 md:grid-cols-4">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Icon className="text-blue-600" size={20} />
            <p className="mt-4 text-2xl font-semibold text-slate-950">{value}</p>
            <p className="mt-1 text-sm text-slate-600">{label}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <EmptyState title="No Sales Yet" description="Raise the first quotation, sales order, or GST invoice to begin tracking revenue." action="Create Quotation" />
        <EmptyState title="No Stock Data" description="Add warehouses, items, and opening stock to start inventory tracking." action="Add Opening Stock" />
      </section>
    </div>
  );
}
