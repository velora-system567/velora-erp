import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { operationsApi } from "../../services/api";

const labels = {
  sales: { title: "Sales", action: "Add Sale", party: "Customer Name" },
  purchase: { title: "Purchase", action: "Add Purchase", party: "Vendor Name" },
  accounts: { title: "Accounts", action: "Add Entry", party: "Account / Party Name" },
};

const blank = { documentNo: "", partyName: "", amount: "", status: "DRAFT", documentDate: "", notes: "" };

export function OperationsPage({ resource }) {
  const config = labels[resource];
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blank);
  const query = useQuery({ queryKey: [resource, "records"], queryFn: () => operationsApi.list(resource) });
  const rows = query.data?.data || [];
  const saveMutation = useMutation({
    mutationFn: () => operationsApi.create(resource, form),
    onSuccess: () => {
      setForm(blank);
      queryClient.invalidateQueries({ queryKey: [resource, "records"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => operationsApi.remove(resource, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [resource, "records"] }),
  });
  const importMutation = useMutation({
    mutationFn: async (records) => {
      for (const record of records) {
        await operationsApi.create(resource, { ...blank, ...record, amount: Number(record.amount || record.Amount || 0), partyName: record.partyName || record.Party || record.Name || "" });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [resource, "records"] }),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-6 md:py-6 xl:p-8">
      <header className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{config.title}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">List-based entries with Excel import and database persistence.</p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Import Excel
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(await file.arrayBuffer());
            importMutation.mutate(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]));
          }} />
        </label>
      </header>
      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-950">{config.action}</h2>
          <div className="mt-4 space-y-3">
            {[
              ["documentNo", "Document No"],
              ["partyName", config.party],
              ["amount", "Amount"],
              ["documentDate", "Date"],
              ["notes", "Notes"],
            ].map(([key, label]) => (
              <label key={key} className="block text-sm font-medium text-slate-700">
                {label}
                <input type={key === "documentDate" ? "date" : key === "amount" ? "number" : "text"} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" />
              </label>
            ))}
          </div>
          {saveMutation.error ? <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{saveMutation.error.message}</p> : null}
          <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={18} /> {config.action}</button>
        </form>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {rows.length === 0 ? (
            <EmptyState title={`No ${config.title} Records`} description="Add a record manually or import an Excel sheet to build this list." action="" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">No</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3 text-slate-700">{new Date(row.documentDate).toLocaleDateString()}</td>
                      <td className="px-3 py-3 text-slate-700">{row.documentNo || "-"}</td>
                      <td className="px-3 py-3 font-medium text-slate-950">₹{(row.totalAmount / 100).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-3 text-slate-700">{row.status}</td>
                      <td className="px-3 py-3 text-right"><button onClick={() => deleteMutation.mutate(row.id)} className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button></td>
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
