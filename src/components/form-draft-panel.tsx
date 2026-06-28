import { History, Save, ShieldCheck } from "lucide-react";

export function FormDraftPanel() {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Reusable Form Contract</h2>
          <p className="mt-1 text-sm text-zinc-400">Every core form is designed for validation, drafts, edit mode, and audit history.</p>
        </div>
        <ShieldCheck className="text-emerald-200" size={22} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ["Validation", "Schema-ready fields for required data, GSTIN, HSN, email, and permissions."],
          ["Draft saving", "Unsaved edits can be kept as draft records without publishing."],
          ["Audit history", "Field-level activity can attach to the central audit log."],
        ].map(([title, copy]) => (
          <div key={title} className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              {title === "Draft saving" ? <Save size={15} /> : <History size={15} />}
              {title}
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-400">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
