import type { Status } from "@/lib/types";

const statusStyles: Record<Status, string> = {
  active: "border-blue-200 bg-blue-50 text-blue-700",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
  draft: "border-slate-200 bg-white text-slate-700",
  archived: "border-rose-200 bg-rose-50 text-rose-700",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[status]}`}>
      {status}
    </span>
  );
}
