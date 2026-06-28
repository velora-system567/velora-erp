import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { coreApi } from "../../services/api";

export function CompanyPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["company"], queryFn: coreApi.company });
  const [form, setForm] = useState({ name: "", legalName: "", gstin: "", panNumber: "", address: { city: "", state: "", pincode: "" } });
  useEffect(() => {
    if (query.data?.data) setForm({ address: {}, ...query.data.data });
  }, [query.data]);
  const mutation = useMutation({
    mutationFn: () => coreApi.updateCompany(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company"] }),
  });

  function update(key, value) {
    if (key.startsWith("address.")) {
      const child = key.split(".")[1];
      setForm((current) => ({ ...current, address: { ...(current.address || {}), [child]: value } }));
    } else {
      setForm((current) => ({ ...current, [key]: value }));
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 sm:px-6 md:py-6 xl:p-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold text-slate-950">Company</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">This is the customer's own company profile used across the ERP.</p>
      </header>
      <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["name", "Company Name"],
            ["legalName", "Legal Name"],
            ["gstin", "GSTIN"],
            ["panNumber", "PAN"],
            ["address.city", "City"],
            ["address.state", "State"],
            ["address.pincode", "Pincode"],
          ].map(([key, label]) => (
            <label key={key} className="block text-sm font-medium text-slate-700">
              {label}
              <input value={key.startsWith("address.") ? form.address?.[key.split(".")[1]] || "" : form[key] || ""} onChange={(event) => update(key, event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" />
            </label>
          ))}
        </div>
        {mutation.error ? <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{mutation.error.message}</p> : null}
        {mutation.isSuccess ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Company saved.</p> : null}
        <button className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
          <Save size={18} /> Save Company
        </button>
      </form>
    </div>
  );
}
