/**
 * Consistent status badge across all documents and records.
 */
const STATUS_STYLES = {
  // Document statuses
  DRAFT:     "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-50 text-blue-700",
  APPROVED:  "bg-emerald-50 text-emerald-700",
  REJECTED:  "bg-rose-50 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  CLOSED:    "bg-purple-50 text-purple-700",

  // Lead statuses
  NEW:       "bg-sky-50 text-sky-700",
  QUALIFIED: "bg-amber-50 text-amber-700",
  CONVERTED: "bg-emerald-50 text-emerald-700",
  LOST:      "bg-rose-50 text-rose-700",

  // Payment modes
  CASH:   "bg-green-50 text-green-700",
  UPI:    "bg-violet-50 text-violet-700",
  NEFT:   "bg-blue-50 text-blue-700",
  RTGS:   "bg-indigo-50 text-indigo-700",
  CHEQUE: "bg-orange-50 text-orange-700",
  CARD:   "bg-pink-50 text-pink-700",

  // Machine statuses
  RUNNING:     "bg-emerald-50 text-emerald-700",
  IDLE:        "bg-slate-100 text-slate-600",
  MAINTENANCE: "bg-amber-50 text-amber-700",
  BREAKDOWN:   "bg-rose-50 text-rose-700",

  // Production order
  PLANNED:     "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  COMPLETED:   "bg-emerald-50 text-emerald-700",

  // Quality
  PASS:   "bg-emerald-50 text-emerald-700",
  FAIL:   "bg-rose-50 text-rose-700",
  REWORK: "bg-amber-50 text-amber-700",

  // Priority
  LOW:    "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH:   "bg-amber-50 text-amber-700",
  URGENT: "bg-rose-50 text-rose-700",
};

export function StatusBadge({ status, className = "" }) {
  const style = STATUS_STYLES[status] || "bg-slate-100 text-slate-700";
  const label = status?.replace(/_/g, " ") || "—";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${style} ${className}`}>
      {label}
    </span>
  );
}
