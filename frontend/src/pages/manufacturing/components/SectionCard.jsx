export function SectionCard({ id, title, description, icon: Icon, className = "", children }) {
  return (
    <div id={id} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
        </div>
        {Icon && <Icon className="shrink-0 text-blue-600" size={18} />}
      </div>
      {children}
    </div>
  );
}
