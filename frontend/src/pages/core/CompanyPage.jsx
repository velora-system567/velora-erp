import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Save, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonCards } from "../../components/Skeleton";
import { coreApi } from "../../services/api";
import { Card, SectionHeader } from "../inventory/components/shared";

export function CompanyPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["company"], queryFn: coreApi.company });
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: "", legalName: "", gstin: "", panNumber: "", address: { city: "", state: "", pincode: "" } });

  useEffect(() => {
    if (query.data?.data) setForm({ address: {}, ...query.data.data });
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () => coreApi.updateCompany(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function update(key, value) {
    if (key.startsWith("address.")) {
      const child = key.split(".")[1];
      setForm((current) => ({ ...current, address: { ...(current.address || {}), [child]: value } }));
    } else {
      setForm((current) => ({ ...current, [key]: value }));
    }
  }

  if (query.isPending) return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader title="Company" description="Loading company profile..." />
      <SkeletonCards count={4} />
    </div>
  );

  if (query.isError) return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader title="Company" description="Could not load company" />
      <ErrorState error={query.error} onRetry={() => query.refetch()} />
    </div>
  );

  const fields = [
    ["name", "Company Name", "e.g. Velora Systems Pvt Ltd"],
    ["legalName", "Legal Name", "Registered legal entity name"],
    ["gstin", "GSTIN", "15-digit GST identification number"],
    ["panNumber", "PAN", "10-character PAN number"],
    ["address.city", "City", "e.g. Pune"],
    ["address.state", "State", "e.g. Maharashtra"],
    ["address.pincode", "PIN Code", "e.g. 411026"],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader
        title="Company"
        description="Legal identity and registered address for tax and compliance."
        actions={<SecondaryButton label="Save" icon={Save} onClick={() => mutation.mutate()} disabled={mutation.isPending} />}
      />

      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <Card>
          <SectionHeader title="Legal Identity" icon={Building2} />
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(([key, label, placeholder]) => (
              <label key={key} className="block text-sm font-medium text-slate-700">
                {label}
                <input
                  placeholder={placeholder}
                  value={key.startsWith("address.") ? form.address?.[key.split(".")[1]] || "" : form[key] || ""}
                  onChange={(e) => update(key, e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-xs outline-none transition-all duration-150 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            ))}
          </div>
        </Card>

        {/* Status messages */}
        <div className="mt-4 space-y-3">
          {mutation.error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {mutation.error.message}
            </div>
          )}
          {saved && (
            <div className="animate-fade-in rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <span className="flex items-center gap-2"><CheckCircle size={16} /> Company profile saved successfully.</span>
            </div>
          )}
        </div>

        <button type="submit" disabled={mutation.isPending}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-blue-700 hover:shadow-md disabled:opacity-50">
          <Save size={16} /> {mutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
