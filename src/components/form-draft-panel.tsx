import { History, Save, ShieldCheck } from "lucide-react";

export function FormDraftPanel() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Simple, safe data entry</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Owners and staff can save work, correct mistakes, and see who changed what without needing technical training.
          </p>
        </div>
        <ShieldCheck className="text-blue-600" size={22} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ["Checks before saving", "GSTIN, HSN, email, required fields, and duplicate records are handled clearly."],
          ["Save as draft", "Incomplete company, branch, user, and item records can be finished later."],
          ["Change history", "Every important update is visible for owners, managers, and auditors."],
        ].map(([title, copy]) => (
          <div key={title} className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              {title === "Save as draft" ? <Save size={15} /> : <History size={15} />}
              {title}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
