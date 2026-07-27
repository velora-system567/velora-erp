/**
 * Purchase Management Module — Enterprise ERP
 *
 * Tabs: Dashboard | Purchase Orders | GRN | Reports
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, CheckCircle2, Clock, DollarSign, FileText, Package,
  Plus, RefreshCw, Search, ShoppingBag, Truck, TrendingDown,
  TrendingUp, X, ArrowLeft, Eye, Send,
} from "lucide-react";
import { purchaseApi, coreApi } from "../../services/api";
import { formatRupees } from "../../utils/money";
import { ErrorBanner, ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { AddButton, PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonCards, SkeletonTable } from "../../components/Skeleton";
import { Card, Cell, Head, KpiTile, Pill, SectionHeader, StatusPill, TableShell, date, number, exportCsv } from "../inventory/components/shared";

const TABS = [
  ["dashboard", BarChart3, "KPIs & charts"],
  ["orders", ShoppingBag, "Purchase orders"],
  ["grn", Package, "Goods receipt notes"],
  ["reports", FileText, "Purchase analysis"],
];

export function PurchasePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState(localStorage.getItem("purchase_tab") || "dashboard");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const switchTab = (t) => { setTab(t); setPage(1); localStorage.setItem("purchase_tab", t); };

  // Masters
  const masters = useQuery({
    queryKey: ["purchase-masters"],
    queryFn: async () => {
      const [vRes, iRes, wRes] = await Promise.all([
        coreApi.list("vendors", { limit: 200 }),
        coreApi.list("items", { limit: 500 }),
        coreApi.list("warehouses", { limit: 100 }),
      ]);
      return { vendors: vRes.data || [], items: iRes.data || [], warehouses: wRes.data || [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Dashboard
  const dashQuery = useQuery({
    queryKey: ["purchase-dashboard"],
    queryFn: () => purchaseApi.dashboard(),
    staleTime: 60 * 1000,
    enabled: tab === "dashboard",
  });

  // Orders
  const ordersQuery = useQuery({
    queryKey: ["purchase-orders", page, search],
    queryFn: () => purchaseApi.purchaseOrders({ page, limit: 20, q: search || undefined }),
    staleTime: 30 * 1000,
    enabled: tab === "orders",
  });

  // GRNs
  const grnsQuery = useQuery({
    queryKey: ["purchase-grns", page],
    queryFn: () => purchaseApi.grns({ page, limit: 20 }),
    staleTime: 30 * 1000,
    enabled: tab === "grn",
  });

  // Vendors
  const vendors = masters.data?.vendors || [];
  const items = masters.data?.items || [];
  const warehouses = masters.data?.warehouses || [];
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  // PO approve mutation
  const approveMutation = useMutation({
    mutationFn: (id) => purchaseApi.approvePurchaseOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });

  // GRN approve mutation
  const grnApproveMutation = useMutation({
    mutationFn: (id) => purchaseApi.approveGrn(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-grns"] }); qc.invalidateQueries({ queryKey: ["purchase-dashboard"] }); },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader
        title="Purchase Management"
        description="Manage purchase orders, goods receipt, vendor bills, and payments."
        actions={
          <SecondaryButton label="Refresh" icon={RefreshCw} onClick={() => qc.invalidateQueries({ queryKey: ["purchase"] })} />
        }
      />

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map(([key, Icon, hint]) => (
          <button key={key} onClick={() => switchTab(key)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${tab === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
            <Icon size={16} /> {key === "dashboard" ? "Dashboard" : key === "orders" ? "Purchase Orders" : key === "grn" ? "Goods Receipt" : "Reports"}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {tab === "orders" && (
            <label className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders…" className="h-10 w-48 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
            </label>
          )}
        </div>
      </div>

      {/* Dashboard Tab */}
      {tab === "dashboard" && <DashboardTab data={dashQuery} />}

      {/* Orders Tab */}
      {tab === "orders" && (
        <OrdersTab
          query={ordersQuery}
          vendors={vendors}
          vendorMap={vendorMap}
          onApprove={(id) => approveMutation.mutate(id)}
          approvePending={approveMutation.isPending}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["purchase-orders"] })}
          onPageChange={setPage}
          page={page}
        />
      )}

      {/* GRN Tab */}
      {tab === "grn" && (
        <GrnTab
          query={grnsQuery}
          vendors={vendors}
          warehouses={warehouses}
          vendorMap={vendorMap}
          warehouseMap={new Map(warehouses.map((w) => [w.id, w]))}
          onApprove={(id) => grnApproveMutation.mutate(id)}
          approvePending={grnApproveMutation.isPending}
          onPageChange={setPage}
          page={page}
        />
      )}

      {/* Reports Tab */}
      {tab === "reports" && <ReportsTab />}
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────

function DashboardTab({ data: query }) {
  const qc = useQueryClient();
  if (query.isPending) return <div className="space-y-4"><SkeletonCards count={6} /><SkeletonTable rows={5} cols={4} /></div>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["purchase-dashboard"] })} />;

  const data = query.data?.data;
  if (!data) return <EmptyState title="No purchase data" description="Create a purchase order to see dashboard insights." />;

  const k = data.kpis;

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiTile label="Monthly Purchase" value={k.monthlyPurchaseValue} tone="blue" icon={TrendingUp} formatter={formatRupees} detail={`${k.monthlyPOCount} orders this month`} />
        <KpiTile label="Total Orders" value={k.totalPOs} tone="slate" icon={ShoppingBag} detail={`${k.vendorCount} active vendors`} />
        <KpiTile label="Pending Orders" value={k.pendingPOs} tone="amber" icon={Clock} detail={`${k.draftPOs} draft · ${k.approvedPOs} approved`} />
        <KpiTile label="Goods Received" value={k.totalGrns} tone="emerald" icon={Package} detail="Total GRNs processed" />
        <KpiTile label="Monthly Payments" value={k.monthlyPaymentValue} tone="purple" icon={DollarSign} formatter={formatRupees} />
        <KpiTile label="Vendors" value={k.vendorCount} tone="blue" icon={Truck} detail="Registered suppliers" />
      </section>

      {/* Top Vendors + Recent Activity */}
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Top Suppliers" description="By total purchase value" icon={Truck} />
          {data.topVendors?.length ? (
            <div className="space-y-2">
              {data.topVendors.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">{i + 1}</span>
                    <div><p className="font-medium text-slate-950">{v.name}</p><p className="text-xs text-slate-500">{v.orderCount} orders</p></div>
                  </div>
                  <p className="font-semibold tabular-nums text-slate-950">{formatRupees(v.totalAmount)}</p>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No supplier data" description="Orders with vendors will appear here." />}
        </Card>

        <Card>
          <SectionHeader title="Recent Activity" description="Latest purchase order updates" icon={FileText} />
          {data.recentActivity?.length ? (
            <div className="divide-y divide-slate-100">
              {data.recentActivity.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0"><p className="truncate font-medium text-slate-950">{a.documentNo || "—"}</p><p className="text-xs text-slate-500">{a.partyName}</p></div>
                  <div className="text-right"><StatusPill status={a.status} /><p className="mt-0.5 text-xs text-slate-500">{formatRupees(a.totalAmount)}</p></div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No activity" description="Purchase order updates appear here." />}
        </Card>
      </section>
    </div>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────

function OrdersTab({ query, vendorMap, onApprove, approvePending, onRefresh, onPageChange, page }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [lines, setLines] = useState([{ itemId: "", description: "", quantity: 1, rate: 0, gstRate: 18 }]);
  const [notice, setNotice] = useState("");

  const createMutation = useMutation({
    mutationFn: (data) => purchaseApi.createPurchaseOrder(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); setShowCreate(false); setNotice("Purchase order created"); setTimeout(() => setNotice(""), 3000); },
  });

  const items = qc.getQueryData(["purchase-masters"])?.items || [];

  if (query?.isPending) return <SkeletonTable rows={8} cols={6} />;
  if (query?.isError) return <ErrorState error={query.error} onRetry={onRefresh} />;

  const orders = query?.data?.data || [];
  const meta = query?.data?.meta;

  const addLine = () => setLines([...lines, { itemId: "", description: "", quantity: 1, rate: 0, gstRate: 18 }]);
  const updateLine = (idx, key, value) => {
    const updated = lines.map((l, i) => i === idx ? { ...l, [key]: value } : l);
    setLines(updated);
  };
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx));
  const total = lines.reduce((s, l) => {
    const lineTotal = Number(l.quantity) * Number(l.rate);
    const gst = lineTotal * Number(l.gstRate || 0) / 100;
    return s + lineTotal + gst;
  }, 0);

  if (showCreate) {
    return (
      <Card>
        <SectionHeader title="New Purchase Order" icon={ShoppingBag}
          actions={<button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>} />
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ vendorId: selectedVendor, lines: lines.map((l) => ({ ...l, rate: Number(l.rate), quantity: Number(l.quantity), gstRate: Number(l.gstRate) })) }); }}>
          <label className="block text-sm font-medium text-slate-700">Vendor</label>
          <select value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)} required className="mt-1 h-11 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="">Select vendor</option>
            {[...vendorMap.values()].map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-slate-700">Items</p>
            {lines.map((line, idx) => (
              <div key={idx} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                <select value={line.itemId} onChange={(e) => updateLine(idx, "itemId", e.target.value)} className="h-10 flex-1 min-w-[140px] rounded border border-slate-200 bg-white px-2 text-xs">
                  <option value="">Select item</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.itemCode} · {i.name}</option>)}
                </select>
                <input type="number" placeholder="Qty" min="1" value={line.quantity} onChange={(e) => updateLine(idx, "quantity", e.target.value)} className="h-10 w-20 rounded border border-slate-200 px-2 text-xs" />
                <input type="number" placeholder="Rate" min="0" value={line.rate} onChange={(e) => updateLine(idx, "rate", e.target.value)} className="h-10 w-24 rounded border border-slate-200 px-2 text-xs" />
                <input type="number" placeholder="GST%" min="0" max="28" value={line.gstRate} onChange={(e) => updateLine(idx, "gstRate", e.target.value)} className="h-10 w-20 rounded border border-slate-200 px-2 text-xs" />
                {lines.length > 1 && <button type="button" onClick={() => removeLine(idx)} className="p-2 text-rose-500 hover:text-rose-700"><X size={16} /></button>}
              </div>
            ))}
            <button type="button" onClick={addLine} className="text-xs font-semibold text-blue-600 hover:text-blue-800">+ Add item</button>
          </div>

          <div className="mt-4 rounded-lg bg-slate-100 p-3 text-right">
            <p className="text-sm text-slate-600">Estimated total incl. GST</p>
            <p className="text-xl font-bold text-slate-950">{formatRupees(Math.round(total * 100))}</p>
          </div>

          {notice && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
          {createMutation.error && <div className="mt-3"><ErrorBanner error={createMutation.error} /></div>}
          <button type="submit" disabled={createMutation.isPending || !selectedVendor}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {createMutation.isPending ? "Creating…" : "Create Purchase Order"}
          </button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{meta ? `${meta.total} orders` : ""}</p>
        <AddButton label="New PO" onClick={() => setShowCreate(true)} />
      </div>
      <TableShell>
        <Head>
          <th className="px-4 py-3">Order #</th>
          <th className="px-4 py-3">Date</th>
          <th className="px-4 py-3">Vendor</th>
          <th className="px-4 py-3 text-right">Amount</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </Head>
        <tbody className="divide-y divide-slate-100">
          {orders.length ? orders.map((doc) => (
            <tr key={doc.id} className="hover:bg-slate-50">
              <Cell className="font-mono text-xs font-semibold text-blue-700">{doc.documentNo}</Cell>
              <Cell className="text-slate-600">{date(doc.documentDate)}</Cell>
              <Cell className="text-slate-700">{vendorMap.get(doc.partyId)?.name || doc.partyId?.slice(0, 8) || "—"}</Cell>
              <Cell className="text-right font-semibold tabular-nums text-slate-950">{formatRupees(doc.totalAmount)}</Cell>
              <Cell><StatusPill status={doc.status} /></Cell>
              <Cell className="text-right">
                {doc.status === "DRAFT" && (
                  <button onClick={() => onApprove(doc.id)} disabled={approvePending}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                    <CheckCircle2 size={13} /> Approve
                  </button>
                )}
              </Cell>
            </tr>
          )) : (
            <tr><Cell colSpan={6} className="py-12 text-center text-slate-500">No purchase orders found.</Cell></tr>
          )}
        </tbody>
      </TableShell>
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => onPageChange((p) => Math.max(1, p - 1))} className="rounded border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30">Previous</button>
            <button disabled={page >= (meta.totalPages || 1)} onClick={() => onPageChange((p) => p + 1)} className="rounded border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GRN Tab ──────────────────────────────────────────────────────

function GrnTab({ query, vendorMap, warehouseMap, onApprove, approvePending, onPageChange, page }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ vendorId: "", warehouseId: "", notes: "", lines: [{ itemId: "", orderedQty: 1, receivedQty: 1, acceptedQty: 1, rate: 0, gstRate: 18 }] });
  const [notice, setNotice] = useState("");

  const createMutation = useMutation({
    mutationFn: (data) => purchaseApi.createGrn(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-grns"] }); setShowCreate(false); setNotice("GRN created"); setTimeout(() => setNotice(""), 3000); },
  });

  const items = qc.getQueryData(["purchase-masters"])?.items || [];

  if (query?.isPending) return <SkeletonTable rows={6} cols={6} />;
  if (query?.isError) return <ErrorState error={query.error} />;

  const grns = query?.data?.data || [];
  const meta = query?.data?.meta;

  const updateLine = (idx, key, value) => {
    const updated = form.lines.map((l, i) => i === idx ? { ...l, [key]: value } : l);
    setForm({ ...form, lines: updated });
  };

  if (showCreate) {
    return (
      <Card>
        <SectionHeader title="New Goods Receipt Note" icon={Package}
          actions={<button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>} />
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ vendorId: form.vendorId, warehouseId: form.warehouseId, notes: form.notes, lines: form.lines.map((l) => ({ ...l, orderedQty: Number(l.orderedQty), receivedQty: Number(l.receivedQty), acceptedQty: Number(l.acceptedQty), rate: Number(l.rate), gstRate: Number(l.gstRate) })) }); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Vendor<select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} required className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Select</option>{[...vendorMap.values()].map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Warehouse<select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} required className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Select</option>{[...warehouseMap.values()].map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-slate-700">Items received</p>
            {form.lines.map((line, idx) => (
              <div key={idx} className="flex flex-wrap gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                <select value={line.itemId} onChange={(e) => updateLine(idx, "itemId", e.target.value)} className="h-10 flex-1 min-w-[120px] rounded border border-slate-200 bg-white px-2 text-xs"><option value="">Item</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
                <input type="number" placeholder="Ordered" value={line.orderedQty} onChange={(e) => updateLine(idx, "orderedQty", e.target.value)} className="h-10 w-20 rounded border px-2 text-xs" />
                <input type="number" placeholder="Received" value={line.receivedQty} onChange={(e) => updateLine(idx, "receivedQty", e.target.value)} className="h-10 w-20 rounded border px-2 text-xs" />
                <input type="number" placeholder="Accepted" value={line.acceptedQty} onChange={(e) => updateLine(idx, "acceptedQty", e.target.value)} className="h-10 w-20 rounded border px-2 text-xs" />
                <input type="number" placeholder="Rate" value={line.rate} onChange={(e) => updateLine(idx, "rate", e.target.value)} className="h-10 w-24 rounded border px-2 text-xs" />
              </div>
            ))}
          </div>
          {notice && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
          {createMutation.error && <div className="mt-3"><ErrorBanner error={createMutation.error} /></div>}
          <button type="submit" disabled={createMutation.isPending} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {createMutation.isPending ? "Creating…" : "Create GRN"}
          </button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{meta ? `${meta.total} GRNs` : ""}</p>
        <AddButton label="New GRN" onClick={() => setShowCreate(true)} />
      </div>
      <TableShell>
        <Head>
          <th className="px-4 py-3">GRN #</th>
          <th className="px-4 py-3">Date</th>
          <th className="px-4 py-3">Vendor</th>
          <th className="px-4 py-3">Warehouse</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </Head>
        <tbody className="divide-y divide-slate-100">
          {grns.length ? grns.map((grn) => (
            <tr key={grn.id} className="hover:bg-slate-50">
              <Cell className="font-mono text-xs font-semibold text-blue-700">{grn.grnNumber}</Cell>
              <Cell className="text-slate-600">{date(grn.receiptDate)}</Cell>
              <Cell className="text-slate-700">{vendorMap.get(grn.vendorId)?.name || grn.vendorId?.slice(0, 8) || "—"}</Cell>
              <Cell className="text-slate-600">{warehouseMap.get(grn.warehouseId)?.name || grn.warehouseId?.slice(0, 8) || "—"}</Cell>
              <Cell><StatusPill status={grn.status} /></Cell>
              <Cell className="text-right">
                {grn.status === "DRAFT" && (
                  <button onClick={() => onApprove(grn.id)} disabled={approvePending}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                    <CheckCircle2 size={13} /> Credit Stock
                  </button>
                )}
              </Cell>
            </tr>
          )) : (
            <tr><Cell colSpan={6} className="py-12 text-center text-slate-500">No GRNs found.</Cell></tr>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────

function ReportsTab() {
  const qc = useQueryClient();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const reportQuery = useQuery({
    queryKey: ["purchase-report", fromDate, toDate],
    queryFn: () => purchaseApi.report({ ...(fromDate ? { fromDate } : {}), ...(toDate ? { toDate } : {}) }),
    staleTime: 60 * 1000,
  });

  // Outstanding report
  const outstandingQuery = useQuery({
    queryKey: ["purchase-outstanding"],
    queryFn: () => purchaseApi.outstandingReport(),
    staleTime: 60 * 1000,
  });

  if (reportQuery.isPending) return <SkeletonTable rows={6} cols={6} />;

  const data = reportQuery.data?.data;
  const rows = data?.rows || [];
  const summary = data?.summary;
  const outstanding = outstandingQuery.data?.data || [];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card padding="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Total Orders</p><p className="mt-2 text-2xl font-bold text-slate-950">{summary.totalOrders}</p></Card>
          <Card padding="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Total Value</p><p className="mt-2 text-2xl font-bold text-slate-950">{formatRupees(summary.totalValue)}</p></Card>
          <Card padding="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Total Tax</p><p className="mt-2 text-2xl font-bold text-slate-950">{formatRupees(summary.totalTax)}</p></Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 text-sm" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 text-sm" />
        <SecondaryButton label="Export CSV" icon={Send} onClick={() => exportCsv("purchase-orders.csv", rows, [
          { label: "Order #", value: (r) => r.documentNo }, { label: "Date", value: (r) => r.documentDate },
          { label: "Vendor", value: (r) => r.vendor?.name }, { label: "Amount", value: (r) => (r.totalAmount / 100).toFixed(2) },
          { label: "Status", value: (r) => r.status }, { label: "Tax", value: (r) => ((r.cgstAmount + r.sgstAmount + r.igstAmount) / 100).toFixed(2) },
        ])} />
      </div>

      {/* Orders table */}
      {rows.length ? (
        <TableShell>
          <Head>
            <th className="px-4 py-3">Order #</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Vendor</th>
            <th className="px-4 py-3 text-right">Subtotal</th>
            <th className="px-4 py-3 text-right">Tax</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3">Status</th>
          </Head>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Cell className="font-mono text-xs text-blue-700">{r.documentNo}</Cell>
                <Cell className="text-slate-600">{date(r.documentDate)}</Cell>
                <Cell className="text-slate-700">{r.vendor?.name}</Cell>
                <Cell className="text-right tabular-nums">{formatRupees(r.subtotal)}</Cell>
                <Cell className="text-right tabular-nums">{formatRupees(r.cgstAmount + r.sgstAmount + r.igstAmount)}</Cell>
                <Cell className="text-right font-semibold tabular-nums">{formatRupees(r.totalAmount)}</Cell>
                <Cell><StatusPill status={r.status} /></Cell>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : <EmptyState title="No orders" description="No purchase orders match the selected filters." />}

      {/* Outstanding */}
      {outstanding.length > 0 && (
        <Card padding="p-0">
          <div className="border-b border-slate-200 p-5">
            <SectionHeader title="Outstanding Invoices" description="Unpaid vendor bills" icon={DollarSign} />
          </div>
          <TableShell>
            <Head><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-right">Age (days)</th></Head>
            <tbody className="divide-y divide-slate-100">
              {outstanding.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <Cell className="font-mono text-xs">{inv.documentNo}</Cell>
                  <Cell className="text-slate-600">{date(inv.documentDate)}</Cell>
                  <Cell className="text-right tabular-nums">{formatRupees(inv.totalAmount)}</Cell>
                  <Cell className="text-right tabular-nums text-emerald-700">{formatRupees(inv.paidAmount)}</Cell>
                  <Cell className="text-right font-semibold tabular-nums text-rose-700">{formatRupees(inv.outstandingAmount)}</Cell>
                  <Cell className="text-right tabular-nums"><Pill tone={inv.agingDays > 30 ? "rose" : "amber"}>{inv.agingDays}d</Pill></Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
      )}
    </div>
  );
}
