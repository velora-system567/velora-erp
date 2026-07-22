/**
 * Products Page — Full CRUD for inventory items
 *
 * Features:
 *  - Product list with search/filter/pagination
 *  - Create/edit product form with SKU auto-generation
 *  - Support for barcodes, categories, units, brands
 *  - Product type, GST, pricing, tracking mode
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Edit3, Plus, Search, Trash2, X, RefreshCw,
  Barcode, Tag, Hash,
} from "lucide-react";
import { coreApi } from "../../services/api";
import { ErrorBanner } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { AddButton, PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonPage, SkeletonTable } from "../../components/Skeleton";
import { formatRupees } from "../../utils/money";
import {
  Card, Cell, Head, Pill, SectionHeader,
  StatusPill, TableShell, date, number, exportCsv,
} from "./components/shared";

const ITEM_TYPES = ["RAW_MATERIAL", "FINISHED_GOOD", "SEMI_FINISHED", "SERVICE", "CONSUMABLE"];
const TRACKING_MODES = ["NONE", "BATCH", "SERIAL", "BATCH_AND_SERIAL"];
const LIFECYCLE_STATUSES = ["DRAFT", "ACTIVE", "DISCONTINUED", "OBSOLETE"];

function generateSku(name, brand, type) {
  const prefix = type === "RAW_MATERIAL" ? "RM" : type === "FINISHED_GOOD" ? "FG" : type === "SEMI_FINISHED" ? "SF" : type === "SERVICE" ? "SR" : "CN";
  const brandPart = brand ? brand.slice(0, 3).toUpperCase() : "GEN";
  const namePart = name ? name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() : "ITEM";
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${brandPart}-${namePart}-${rand}`;
}

const emptyForm = {
  itemCode: "", name: "", description: "", itemType: "FINISHED_GOOD",
  hsnCode: "", gstRate: 18, purchasePrice: 0, sellingPrice: 0,
  barcode: "", qrCode: "", brand: "", imageUrl: "",
  unitOfMeasureId: "", itemCategoryId: "",
  safetyStock: "", eoqQuantity: "", leadTimeDays: 0,
  trackingMode: "NONE", lifecycleStatus: "ACTIVE", notes: "", isActive: true,
};

export default function ProductsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState("");

  // Fetch products
  const productsQuery = useQuery({
    queryKey: ["products", page, search],
    queryFn: () => coreApi.list("products", { page, limit: 20, q: search || undefined }),
    staleTime: 30 * 1000,
  });

  // Fetch categories and units
  const mastersQuery = useQuery({
    queryKey: ["product-masters"],
    queryFn: async () => {
      const [catRes, uomRes] = await Promise.all([
        coreApi.list("item-categories", { limit: 100 }),
        coreApi.list("units-of-measure", { limit: 100 }),
      ]);
      return { categories: catRes.data || [], units: uomRes.data || [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data) =>
      editingId
        ? coreApi.update("products", editingId, data)
        : coreApi.create("products", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory-masters"] });
      setNotice(editingId ? "Product updated successfully." : "Product created successfully.");
      resetForm();
      setTimeout(() => setNotice(""), 4000);
    },
    onError: () => setNotice("Failed to save product. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => coreApi.remove("products", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setNotice("Product deleted successfully.");
      setTimeout(() => setNotice(""), 4000);
    },
    onError: () => setNotice("Failed to delete product."),
  });

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  function editProduct(product) {
    setForm({
      itemCode: product.itemCode || "",
      name: product.name || "",
      description: product.description || "",
      itemType: product.itemType || "FINISHED_GOOD",
      hsnCode: product.hsnCode || "",
      gstRate: product.gstRate || 18,
      purchasePrice: product.purchasePrice || 0,
      sellingPrice: product.sellingPrice || 0,
      barcode: product.barcode || "",
      qrCode: product.qrCode || "",
      brand: product.brand || "",
      imageUrl: product.imageUrl || "",
      unitOfMeasureId: product.unitOfMeasureId || "",
      itemCategoryId: product.itemCategoryId || "",
      safetyStock: product.safetyStock || "",
      eoqQuantity: product.eoqQuantity || "",
      leadTimeDays: product.leadTimeDays || 0,
      trackingMode: product.trackingMode || "NONE",
      lifecycleStatus: product.lifecycleStatus || "ACTIVE",
      notes: product.notes || "",
      isActive: product.isActive !== false,
    });
    setEditingId(product.id);
    setShowForm(true);
  }

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value ?? e.target.checked });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      safetyStock: form.safetyStock ? Number(form.safetyStock) : undefined,
      eoqQuantity: form.eoqQuantity ? Number(form.eoqQuantity) : undefined,
      purchasePrice: Number(form.purchasePrice),
      sellingPrice: Number(form.sellingPrice),
      leadTimeDays: Number(form.leadTimeDays),
      gstRate: Number(form.gstRate),
    };
    createMutation.mutate(payload);
  };

  const categories = mastersQuery.data?.categories || [];
  const units = mastersQuery.data?.units || [];
  const products = productsQuery.data?.data || [];
  const meta = productsQuery.data?.meta;

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const unitMap = new Map(units.map((u) => [u.id, u]));

  const isLoading = productsQuery.isPending || mastersQuery.isPending;

  if (isLoading && !products.length) return <SkeletonPage cards={0} tableRows={10} />;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <button onClick={() => navigate("/inventory")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 mb-2">
        <ArrowLeft size={14} /> Back to Inventory
      </button>
      <PageHeader
        title="Products"
        description="Manage inventory items, SKUs, barcodes, pricing, and categories."
        actions={
          <AddButton
            label={showForm ? "Close form" : "Add product"}
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
          />
        }
      />
      {notice && (
        <p aria-live="polite" className={`rounded-lg p-3 text-sm font-medium ${notice.includes("Failed") ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>
          {notice}
        </p>
      )}

      {/* Product Form */}
      {showForm && (
        <Card>
          <SectionHeader
            title={editingId ? "Edit product" : "New product"}
            icon={Tag}
            actions={
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            }
          />
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm font-medium text-slate-700">
                Item code / SKU *
                <div className="mt-1 flex gap-2">
                  <input
                    required
                    value={form.itemCode}
                    onChange={update("itemCode")}
                    placeholder="Auto or manual"
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        itemCode: generateSku(form.name, form.brand, form.itemType),
                      })
                    }
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    title="Auto-generate SKU"
                  >
                    <Hash size={16} />
                  </button>
                </div>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Name *
                <input
                  required
                  value={form.name}
                  onChange={update("name")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Brand
                <input
                  value={form.brand}
                  onChange={update("brand")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Item type
                <select
                  value={form.itemType}
                  onChange={update("itemType")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Category
                <select
                  value={form.itemCategoryId}
                  onChange={update("itemCategoryId")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Unit of measure
                <select
                  value={form.unitOfMeasureId}
                  onChange={update("unitOfMeasureId")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">None</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Barcode
                <div className="mt-1 flex gap-2">
                  <input
                    value={form.barcode}
                    onChange={update("barcode")}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, barcode: String(Math.floor(1000000000000 + Math.random() * 9000000000000)) })
                    }
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    title="Generate barcode"
                  >
                    <Barcode size={16} />
                  </button>
                </div>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                HSN code
                <input
                  value={form.hsnCode}
                  onChange={update("hsnCode")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                GST rate (%)
                <input
                  type="number"
                  min={0}
                  max={28}
                  value={form.gstRate}
                  onChange={update("gstRate")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Purchase price (₹)
                <input
                  type="number"
                  min={0}
                  value={form.purchasePrice}
                  onChange={update("purchasePrice")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Selling price (₹)
                <input
                  type="number"
                  min={0}
                  value={form.sellingPrice}
                  onChange={update("sellingPrice")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Tracking mode
                <select
                  value={form.trackingMode}
                  onChange={update("trackingMode")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  {TRACKING_MODES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Lifecycle status
                <select
                  value={form.lifecycleStatus}
                  onChange={update("lifecycleStatus")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  {LIFECYCLE_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Safety stock
                <input
                  type="number"
                  min={0}
                  value={form.safetyStock}
                  onChange={update("safetyStock")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                EOQ quantity
                <input
                  type="number"
                  min={0}
                  value={form.eoqQuantity}
                  onChange={update("eoqQuantity")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Lead time (days)
                <input
                  type="number"
                  min={0}
                  value={form.leadTimeDays}
                  onChange={update("leadTimeDays")}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 sm:col-span-3">
                Description / Notes
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={update("description")}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm"
                />
              </label>
            </div>
            {createMutation.error && <div className="mt-4"><ErrorBanner error={createMutation.error} /></div>}
            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Saving…" : editingId ? "Update product" : "Create product"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Search and filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative min-w-0 flex-1 max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
          <input
            aria-label="Search products"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, SKU, barcode…"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <SecondaryButton
          label="Export CSV"
          icon={RefreshCw}
          onClick={() =>
            exportCsv("velora-products.csv", products, [
              { label: "SKU", value: (r) => r.itemCode },
              { label: "Name", value: (r) => r.name },
              { label: "Type", value: (r) => r.itemType },
              { label: "Brand", value: (r) => r.brand },
              { label: "HSN", value: (r) => r.hsnCode },
              { label: "Barcode", value: (r) => r.barcode },
              { label: "Purchase Price", value: (r) => r.purchasePrice / 100 },
              { label: "Selling Price", value: (r) => r.sellingPrice / 100 },
              { label: "GST", value: (r) => `${r.gstRate}%` },
              { label: "Status", value: (r) => r.lifecycleStatus },
            ])
          }
        />
      </div>

      {/* Product table */}
      {products.length ? (
        <TableShell>
          <Head>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Brand</th>
            <th className="px-4 py-3 text-right">Purchase</th>
            <th className="px-4 py-3 text-right">Sell</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </Head>
          <tbody className="divide-y divide-slate-100">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50">
                <Cell>
                  <span className="font-mono text-xs font-semibold text-blue-700">{product.itemCode}</span>
                </Cell>
                <Cell>
                  <p className="font-medium text-slate-950">{product.name}</p>
                  {product.barcode && <p className="font-mono text-xs text-slate-500">📱 {product.barcode}</p>}
                </Cell>
                <Cell><Pill tone="blue">{product.itemType?.replaceAll("_", " ")}</Pill></Cell>
                <Cell className="text-slate-600">{catMap.get(product.itemCategoryId)?.name || "—"}</Cell>
                <Cell className="text-slate-600">{product.brand || "—"}</Cell>
                <Cell className="text-right tabular-nums">{formatRupees(product.purchasePrice)}</Cell>
                <Cell className="text-right tabular-nums">{formatRupees(product.sellingPrice)}</Cell>
                <Cell><StatusPill status={product.lifecycleStatus} /></Cell>
                <Cell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => editProduct(product)}
                      className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                      title="Edit"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => { if (confirm("Delete this product?")) deleteMutation.mutate(product.id); }}
                      className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-rose-600"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </Cell>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : (
        !isLoading && <EmptyState title="No products found" description="Create your first product to start tracking inventory." />
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Page {meta.page} of {meta.totalPages} ({meta.total} products)</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
            >
              Previous
            </button>
            <button
              disabled={page >= (meta.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
