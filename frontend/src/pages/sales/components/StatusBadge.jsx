/**
 * StatusBadge — Professional status colours for the Sales module.
 *
 * Uses semantic colours that align with ERP standards:
 *   Approved/Completed  → Green (emerald)
 *   Draft               → Grey (slate)
 *   Pending/Submitted   → Blue
 *   Processing          → Cyan
 *   Cancelled/Rejected  → Red (rose)
 *   Closed              → Purple
 *   New                 → Indigo
 *   Qualified           → Teal
 *   Lost                → Red
 *   Converted           → Emerald
 */
const STATUS_STYLES = {
  // Document statuses
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-300",
  SUBMITTED: "bg-blue-50 text-blue-700 ring-blue-300",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-300",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-300",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-300",
  CANCELLED: "bg-red-50 text-red-700 ring-red-300",
  CLOSED: "bg-purple-50 text-purple-700 ring-purple-300",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-300",
  PROCESSING: "bg-cyan-50 text-cyan-700 ring-cyan-300",

  // Lead statuses
  NEW: "bg-indigo-50 text-indigo-700 ring-indigo-300",
  QUALIFIED: "bg-teal-50 text-teal-700 ring-teal-300",
  LOST: "bg-rose-50 text-rose-700 ring-rose-300",
  CONVERTED: "bg-emerald-50 text-emerald-700 ring-emerald-300",

  // Lead priorities
  HIGH: "bg-rose-50 text-rose-700 ring-rose-300",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-300",
  LOW: "bg-slate-100 text-slate-600 ring-slate-200",

  // Lead sources
  REFERENCE: "bg-blue-50 text-blue-700 ring-blue-300",
  COLD_CALL: "bg-orange-50 text-orange-700 ring-orange-300",
  WEBSITE: "bg-cyan-50 text-cyan-700 ring-cyan-300",
  EXHIBITION: "bg-purple-50 text-purple-700 ring-purple-300",
  SOCIAL_MEDIA: "bg-pink-50 text-pink-700 ring-pink-300",
  OTHER: "bg-slate-100 text-slate-600 ring-slate-200",

  // Payment modes
  CASH: "bg-emerald-50 text-emerald-700 ring-emerald-300",
  CHEQUE: "bg-blue-50 text-blue-700 ring-blue-300",
  NEFT: "bg-cyan-50 text-cyan-700 ring-cyan-300",
  RTGS: "bg-purple-50 text-purple-700 ring-purple-300",
  UPI: "bg-indigo-50 text-indigo-700 ring-indigo-300",
  CARD: "bg-amber-50 text-amber-700 ring-amber-300",
};

const DEFAULT_STYLE = "bg-slate-100 text-slate-600 ring-slate-200";

const STATUS_ICONS = {
  DRAFT: "○",
  SUBMITTED: "◷",
  APPROVED: "✓",
  REJECTED: "✕",
  CANCELLED: "✕",
  CLOSED: "●",
  COMPLETED: "✓",
  PENDING: "◷",
  PROCESSING: "⟳",
  NEW: "●",
  QUALIFIED: "◆",
  LOST: "✕",
  CONVERTED: "✓",
  HIGH: "▲",
  MEDIUM: "■",
  LOW: "▼",
};

export function StatusBadge({ status, size = "sm" }) {
  if (!status) return null;

  const style = STATUS_STYLES[status] || DEFAULT_STYLE;
  const icon = STATUS_ICONS[status] || "";
  const sizeClass = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${sizeClass} ${style}`}
    >
      {icon && <span className="text-[0.7em] opacity-70">{icon}</span>}
      {status?.replace(/_/g, " ")}
    </span>
  );
}

/**
 * Lead priority indicator — coloured dot + label
 */
export function PriorityDot({ priority }) {
  const colors = {
    HIGH: "bg-rose-500",
    MEDIUM: "bg-amber-500",
    LOW: "bg-slate-400",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <span className={`inline-block h-2 w-2 rounded-full ${colors[priority] || "bg-slate-400"}`} />
      {priority || "—"}
    </span>
  );
}
