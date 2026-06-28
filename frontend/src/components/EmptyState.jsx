export function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center sm:p-8">
      <p className="text-base font-semibold leading-6 text-slate-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {action ? (
        <button className="mt-5 min-h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto">
          {action}
        </button>
      ) : null}
    </div>
  );
}
