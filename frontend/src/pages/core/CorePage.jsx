import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { coreApi } from "../../services/api";

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
    ],
    columns: ["itemCode", "name", "itemType", "hsnCode", "gstRate"],
    blank: { itemCode: "", name: "", itemType: "FINISHED_GOOD", hsnCode: "", gstRate: 18, purchasePrice: 0, sellingPrice: 0, isActive: true },
  },
};

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
    mutationFn: () => (isEditing ? coreApi.update(resource, editing.id, form) : coreApi.create(resource, form)),
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

  const formValues = useMemo(() => form, [form]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-6 md:py-6 xl:p-8">
      <header className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{config.title}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Create and maintain records used by your company operations.</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(config.blank); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus size={18} /> {config.action}
        </button>
      </header>

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-950">{isEditing ? "Edit Record" : config.action}</h2>
          <div className="mt-4 space-y-3">
            {config.fields.map(([key, label]) => (
              <label key={key} className="block text-sm font-medium text-slate-700">
                {label}
                <input value={key.includes(".") ? formValues[key.split(".")[0]]?.[key.split(".")[1]] || "" : formValues[key] || ""} onChange={(event) => setForm((current) => setNested(current, key, event.target.value))} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" />
              </label>
            ))}
          </div>
          {saveMutation.error ? <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{saveMutation.error.message}</p> : null}
          <button className="mt-5 h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={saveMutation.isPending}>
            {isEditing ? "Save Changes" : config.action}
          </button>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {rows.length === 0 ? (
            <EmptyState title={config.empty} description="Records created here will be saved permanently and shown to authorized users only." action="" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    {config.columns.map((column) => <th key={column} className="px-3 py-3 font-semibold">{column}</th>)}
                    <th className="px-3 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id}>
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
