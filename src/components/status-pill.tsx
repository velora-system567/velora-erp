import type { Status } from "@/lib/types";

const statusStyles: Record<Status, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  archived: "border-rose-200 bg-rose-50 text-rose-700",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[status]}`}>
      {status}
    </span>
  );
}
