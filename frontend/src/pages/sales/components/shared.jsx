/**
 * Sales Module — Shared Components
 */
import { Download } from "lucide-react";
import { formatRupees, formatRupeesCompact, number } from "../../../utils/format";

export { formatRupees, formatRupeesCompact, number };

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

const TONE_MAP = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  purple: "bg-purple-50 text-purple-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-50 text-slate-600",
};

export function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function SectionHeader({ title, description, icon: Icon, actions }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {Icon && <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon size={16} /></div>}
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function KpiTile({ label, value, tone = "blue", icon: Icon, formatter, detail, onClick }) {
  const formatted = formatter ? formatter(value) : value;
  return (
    <button onClick={onClick} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-left transition-all hover:border-blue-200 hover:shadow-md w-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{formatted}</p>
          {detail && <p className="mt-0.5 text-xs text-slate-400">{detail}</p>}
        </div>
        {Icon && (
          <div className={`shrink-0 rounded-lg p-2 ${TONE_MAP[tone] || TONE_MAP.blue}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </button>
  );
}

export function Pill({ children, tone = "blue" }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-${tone}-700 bg-${tone}-50`}>{children}</span>;
}

export function exportCsv(filename, rows, columns) {
  if (!rows?.length) return;
  const header = columns.map((c) => c.label).join(",");
  const body = rows.map((row) => columns.map((c) => {
    const raw = typeof c.value === "function" ? c.value(row) : row[c.value];
    return `"${String(raw ?? "").replace(/"/g, '""')}"`;
  }).join(",")).join("\n");
  const csv = [header, body].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
