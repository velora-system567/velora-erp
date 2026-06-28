import type { Status } from "@/lib/types";

const statusStyles: Record<Status, string> = {
  active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  inactive: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  draft: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  archived: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[status]}`}>
      {status}
    </span>
  );
}
