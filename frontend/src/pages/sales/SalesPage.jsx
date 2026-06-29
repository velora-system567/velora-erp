import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { leadsApi } from "../../services/api";
import { OperationsPage } from "../operations/OperationsPage";

const blankLead = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  city: "",
  source: "REFERENCE",
  priority: "MEDIUM",
  status: "NEW",
  value: "",
  nextFollowUp: "",
  requirement: "",
  notes: "",
};

const statusLabels = {
  NEW: "New",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  LOST: "Lost",
};

export function SalesPage() {
  const queryClient = useQueryClient();
  const [leadForm, setLeadForm] = useState(blankLead);
  const [cityFilter, setCityFilter] = useState("");
  const leadsQuery = useQuery({ queryKey: ["leads"], queryFn: leadsApi.list });
  const leads = leadsQuery.data?.data || [];
  const filteredLeads = useMemo(() => (cityFilter ? leads.filter((lead) => lead.city === cityFilter) : leads), [cityFilter, leads]);

  const createLead = useMutation({
    mutationFn: () => leadsApi.create(leadForm),
    onSuccess: () => {
      setLeadForm(blankLead);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
  const updateLead = useMutation({
    mutationFn: ({ id, input }) => leadsApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });
  const deleteLead = useMutation({
    mutationFn: leadsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-6 md:py-6 xl:p-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold text-slate-950">Sales</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">Manage leads, follow-ups, and sales records from one clean list.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form onSubmit={(event) => { event.preventDefault(); createLead.mutate(); }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-950">Add Lead</h2>
          <div className="mt-4 space-y-3">
            {[
              ["name", "Company Name"],
              ["contactPerson", "Contact Person"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["city", "City"],
              ["value", "Deal Value"],
              ["nextFollowUp", "Next Follow-up"],
              ["requirement", "Requirement"],
            ].map(([key, label]) => (
              <label key={key} className="block text-sm font-medium text-slate-700">
                {label}
                <input type={key === "nextFollowUp" ? "date" : key === "value" ? "number" : "text"} value={leadForm[key]} onChange={(event) => setLeadForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" />
              </label>
            ))}
            <label className="block text-sm font-medium text-slate-700">
              Source
              <select value={leadForm.source} onChange={(event) => setLeadForm((current) => ({ ...current, source: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-blue-500">
                {["REFERENCE", "COLD_CALL", "WEBSITE", "EXHIBITION", "SOCIAL_MEDIA", "OTHER"].map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
          {createLead.error ? <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{createLead.error.message}</p> : null}
          <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={18} /> Add Lead</button>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-base font-semibold text-slate-950">Lead List</h2>
            <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500">
              <option value="">All Cities</option>
              {[...new Set(leads.map((lead) => lead.city).filter(Boolean))].map((city) => <option key={city}>{city}</option>)}
            </select>
          </div>
          {filteredLeads.length === 0 ? (
            <EmptyState title="No Leads Added" description="Add your first lead to track customer interest, follow-ups, and deal value." action="" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Company</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">City</th><th className="px-3 py-3">Value</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3">Follow-up</th><th className="px-3 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-3 py-3 font-medium text-slate-950">{lead.name}</td>
                      <td className="px-3 py-3 text-slate-700">{lead.contactPerson || lead.phone || "-"}</td>
                      <td className="px-3 py-3 text-slate-700">{lead.city || "-"}</td>
                      <td className="px-3 py-3 text-slate-700">₹{(lead.value / 100).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-3">
                        <select value={lead.status} onChange={(event) => updateLead.mutate({ id: lead.id, input: { status: event.target.value } })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm">
                          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>
                      <td className={`px-3 py-3 ${lead.nextFollowUp && new Date(lead.nextFollowUp) < new Date() ? "text-rose-600" : "text-slate-700"}`}>{lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString("en-IN") : "-"}</td>
                      <td className="px-3 py-3 text-right"><button onClick={() => deleteLead.mutate(lead.id)} className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <OperationsPage resource="sales" embedded />
    </div>
  );
}
