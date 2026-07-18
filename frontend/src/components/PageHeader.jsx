import { Plus } from "lucide-react";

/**
 * Standardized page header used across all ERP module pages.
 */
export function PageHeader({ title, description, actions, children }) {
  return (
    <header className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:p-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-tight text-slate-950">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        )}
      </div>
      {(actions || children) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          {children}
        </div>
      )}
    </header>
  );
}

/** Standard "Add" button */
export function AddButton({ label, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Plus size={18} />
      {label}
    </button>
  );
}

/** Secondary / outline button */
export function SecondaryButton({ label, onClick, icon: Icon, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {Icon && <Icon size={16} />}
      {label}
    </button>
  );
}
