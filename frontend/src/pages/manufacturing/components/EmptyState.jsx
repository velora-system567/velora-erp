export function EmptyState({ title, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-10 text-center">
      <div className="text-sm font-semibold text-slate-900">{title || "No data found"}</div>
      {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
    </div>
  );
}
