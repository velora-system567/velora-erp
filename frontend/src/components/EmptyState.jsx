export function EmptyState({ title, description, action, onClick, buttonLabel }) {
  const label = buttonLabel || action;
  const handleClick = onClick || null;
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center sm:p-8">
      <p className="text-base font-semibold leading-6 text-slate-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {label && label !== "" && (
        handleClick ? (
          <button
            onClick={handleClick}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            {label}
          </button>
        ) : (
          <span className="mt-5 inline-block min-h-11 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400">{label}</span>
        )
      )}
    </div>
  );
}
