import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RotateCcw, Trash2, Search } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader, AddButton } from "../../components/PageHeader";
import { SkeletonTable } from "../../components/Skeleton";
import { coreApi } from "../../services/api";
import { Cell, Head, TableShell } from "../inventory/components/shared";

const configs = {
  branches: {
    title: "Branches",
    empty: "No Branches Created",
    action: "Create Branch",
    fields: [
      ["name", "Branch Name"],
      ["code", "Code"],
      ["address.city", "City"],
      ["address.state", "State"],
      ["address.pincode", "Pincode"],
    ],
    columns: ["name", "code", "city", "state", "status"],
    blank: { name: "", code: "", address: { city: "", state: "", pincode: "" }, isActive: true },
  },
  users: {
    title: "Users",
    empty: "No Users Added",
    action: "Add User",
    fields: [
      ["name", "Name"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["password", "Password"],
      ["role", "Role"],
    ],
    columns: ["name", "email", "phone", "status"],
    blank: { name: "", email: "", phone: "", password: "", role: "ADMIN", branchIds: [], isActive: true },
  },
  products: {
    title: "Product Master",
    empty: "No Products Found",
    action: "Add Product",
    fields: [
      ["itemCode", "Product Code"],
      ["name", "Product Name"],
      ["itemType", "Type"],
      ["hsnCode", "HSN"],
      ["gstRate", "GST %"],
      ["purchasePrice", "Purchase Price"],
      ["sellingPrice", "Selling Price"],
      ["barcode", "Barcode"],
      ["brand", "Brand"],
      ["trackingMode", "Traceability"],
      ["lifecycleStatus", "Lifecycle Status"],
      ["safetyStock", "Safety Stock"],
      ["eoqQuantity", "EOQ Quantity"],
      ["leadTimeDays", "Lead Time (days)"],
    ],
    columns: ["itemCode", "name", "itemType", "hsnCode", "gstRate"],
    blank: { itemCode: "", name: "", itemType: "FINISHED_GOOD", hsnCode: "", gstRate: 18, purchasePrice: 0, sellingPrice: 0, barcode: "", brand: "", trackingMode: "NONE", lifecycleStatus: "ACTIVE", safetyStock: "", eoqQuantity: "", leadTimeDays: 0, isActive: true },
  },
};

const selectOptions = {
  role: [
    ["OWNER", "Owner"],
    ["ADMIN", "Admin"],
    ["ACCOUNTANT", "Accountant"],
    ["SALES_MANAGER", "Sales Manager"],
    ["SALESMAN", "Salesman"],
    ["STORE_KEEPER", "Store Keeper"],
    ["PURCHASE_MANAGER", "Purchase Manager"],
    ["PRODUCTION_OPERATOR", "Production Operator"],
    ["HR_MANAGER", "HR Manager"],
  ],
  itemType: [
    ["RAW_MATERIAL", "Raw Material"],
    ["FINISHED_GOOD", "Finished Good"],
    ["SEMI_FINISHED", "Semi Finished"],
    ["SERVICE", "Service"],
    ["CONSUMABLE", "Consumable"],
  ],
  trackingMode: [["NONE", "No tracking"], ["BATCH", "Batch / lot"], ["SERIAL", "Serial number"], ["BATCH_AND_SERIAL", "Batch and serial"]],
  lifecycleStatus: [["DRAFT", "Draft"], ["ACTIVE", "Active"], ["DISCONTINUED", "Discontinued"], ["OBSOLETE", "Obsolete"]],
};

const placeholders = {
  name: "Rajesh Patil",
  code: "CUST-0018",
  "address.city": "Pune",
  "address.state": "Maharashtra",
  "address.pincode": "411026",
  email: "rajesh@mahindra.com",
  phone: "9823456710",
  password: "Rajesh@123",
  role: "ADMIN",
  itemCode: "ITEM-0042",
  hsnCode: "8708",
  gstRate: "18",
  purchasePrice: "12500",
  sellingPrice: "12500",
};

function placeholderFor(resource, key) {
  if (resource === "branches" && key === "name") return "Mahindra Auto Parts Pvt Ltd";
  if (resource === "products" && key === "name") return "Brake Disc Assembly";
  return placeholders[key] || "Search...";
}

function getValue(row, key) {
  if (key === "city") return row.address?.city || "-";
  if (key === "state") return row.address?.state || "-";
  if (key === "status") return row.isActive === false ? "Inactive" : "Active";
  return row[key] ?? "-";
}

function setNested(form, key, value) {
  if (!key.includes(".")) return { ...form, [key]: value };
  const [parent, child] = key.split(".");
  return { ...form, [parent]: { ...(form[parent] || {}), [child]: value } };
}

export function CorePage({ resource }) {
  const config = configs[resource];
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(config.blank);
  const query = useQuery({ queryKey: [resource], queryFn: () => coreApi.list(resource) });
  const rows = query.data?.data || [];
  const isEditing = Boolean(editing);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form };
      if (resource === "users" && isEditing && !payload.password) delete payload.password;
      return isEditing ? coreApi.update(resource, editing.id, payload) : coreApi.create(resource, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [resource] });
      setEditing(null);
      setForm(config.blank);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => coreApi.remove(resource, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [resource] }),
  });
  const resetMutation = useMutation({ mutationFn: (id) => coreApi.resetPassword(id, "ChangeMe@123") });
  const importMutation = useMutation({
    mutationFn: async (records) => {
      for (const record of records) {
        await coreApi.create(resource, { ...config.blank, ...record });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [resource] }),
  });

  if (query.isPending) return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-6 md:py-6 xl:p-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
  if (query.isError) return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-6 md:py-6 xl:p-8">
      <ErrorState error={query.error} title={`Could not load ${resource}`} onRetry={() => queryClient.invalidateQueries({ queryKey: [resource] })} />
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-6 md:py-6 xl:p-8">
      <PageHeader
        title={config.title}
        description="Create and maintain records used by your company operations."
        actions={
          <>
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-all duration-150 hover:bg-slate-50 hover:shadow-sm">
              Import Excel
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const XLSX = await import("xlsx");
                const workbook = XLSX.read(await file.arrayBuffer());
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                importMutation.mutate(rows);
              }} />
            </label>
            <AddButton label={config.action} onClick={() => { setEditing(null); setForm(config.blank); }} />
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-950">{isEditing ? "Edit Record" : config.action}</h2>
          <div className="mt-4 space-y-3">
            {config.fields.map(([key, label]) => (
              <label key={key} className="block text-sm font-medium text-slate-700">
                {label}
                {selectOptions[key] ? (
                  <select value={form[key] || ""} onChange={(event) => setForm((current) => setNested(current, key, event.target.value))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-xs outline-none transition-all duration-150 focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    {selectOptions[key].map(([value, optionLabel]) => (
                      <option key={value} value={value}>{optionLabel}</option>
                    ))}
                  </select>
                ) : (
                  <input placeholder={placeholderFor(resource, key)} value={key.includes(".") ? form[key.split(".")[0]]?.[key.split(".")[1]] || "" : form[key] || ""} onChange={(event) => setForm((current) => setNested(current, key, event.target.value))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-xs outline-none transition-all duration-150 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                )}
              </label>
            ))}
          </div>
          {saveMutation.error ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{saveMutation.error.message}</div> : null}
          <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-blue-700 hover:shadow-md disabled:opacity-50" disabled={saveMutation.isPending}>
            {isEditing ? "Save Changes" : config.action}
          </button>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {rows.length === 0 ? (
            <EmptyState title={config.empty} description="Records created here will be saved permanently and shown to authorized users only." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    {config.columns.map((column) => <th key={column} className="px-3 py-3">{column}</th>)}
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="transition-colors duration-150 hover:bg-slate-50">
                      {config.columns.map((column) => <td key={column} className="whitespace-nowrap px-3 py-3 text-slate-700">{getValue(row, column)}</td>)}
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          {resource === "users" ? <button title="Reset password" onClick={() => resetMutation.mutate(row.id)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><RotateCcw size={16} /></button> : null}
                          <button title="Edit" onClick={() => { setEditing(row); setForm({ ...config.blank, ...row, password: "" }); }} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><Pencil size={16} /></button>
                          <button title="Delete" onClick={() => deleteMutation.mutate(row.id)} className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
