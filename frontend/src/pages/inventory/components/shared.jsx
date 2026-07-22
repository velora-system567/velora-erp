/**
 * Shared UI primitives for the Inventory module.
 */
import { Download } from "lucide-react";

// ─── Formatters ─────────────────────────────────────────────────────
export const number = (value, digits = 0) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(value || 0));

export const date = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

export const pct = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

export function exportCsv(filename, rows, columns) {
  const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [
    columns.map((c) => escape(c.label)).join(","),
    ...rows.map((r) => columns.map((c) => escape(c.value(r))).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── UI Components ───────────────────────────────────────────────────

export function Card({ children, className = "", padding = "p-5" }) {
  return <article className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${padding} ${className}`}>{children}</article>;
}

export function SectionHeader({ title, description, icon: Icon, actions }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
          {Icon ? <Icon size={18} className="text-blue-600" /> : null}
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>{children}</span>;
}

export function StatusPill({ status }) {
  const map = {
    DRAFT: "slate",
    SUBMITTED: "blue",
    APPROVED: "emerald",
    REJECTED: "rose",
    CANCELLED: "slate",
    CLOSED: "purple",
    COMPLETED: "emerald",
    ACTIVE: "emerald",
    INACTIVE: "slate",
    LOW: "amber",
    OUT_OF_STOCK: "rose",
    OK: "emerald",
    HIGH: "rose",
    MEDIUM: "amber",
  };
  return <Pill tone={map[status] || "slate"}>{status?.replaceAll("_", " ")}</Pill>;
}

export function TableShell({ children }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Head({ children }) {
  return (
    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
      <tr>{children}</tr>
    </thead>
  );
}

export function Cell({ children, className = "" }) {
  return <td className={`px-4 py-3.5 align-middle ${className}`}>{children}</td>;
}

export function KpiTile({ label, value, detail, tone = "slate", icon: Icon, formatter }) {
  const tones = {
    slate: "border-slate-200 text-slate-900",
    blue: "border-blue-200 text-blue-900",
    amber: "border-amber-200 text-amber-900",
    rose: "border-rose-200 text-rose-900",
    emerald: "border-emerald-200 text-emerald-900",
    purple: "border-purple-200 text-purple-900",
  };
  const iconTones = {
    slate: "text-slate-500 bg-slate-100",
    blue: "text-blue-600 bg-blue-50",
    amber: "text-amber-600 bg-amber-50",
    rose: "text-rose-600 bg-rose-50",
    emerald: "text-emerald-600 bg-emerald-50",
    purple: "text-purple-600 bg-purple-50",
  };
  const display = formatter ? formatter(value) : value;
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {Icon ? <div className={`grid h-8 w-8 place-items-center rounded-lg ${iconTones[tone]}`}><Icon size={15} /></div> : null}
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{display}</p>
      {detail ? <p className="mt-1 text-xs text-slate-600">{detail}</p> : null}
    </article>
  );
}

export function CountBadge({ count }) {
  return (
    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-700">
      {count}
    </span>
  );
}
