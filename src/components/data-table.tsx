import { ArrowDownUp, Download, Filter, Search } from "lucide-react";
import { StatusPill } from "./status-pill";

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

export function DataTable<T extends { id: string; status?: string }>({
  title,
  description,
  rows,
  columns,
}: {
  title: string;
  description: string;
  rows: T[];
  columns: Column<T>[];
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button className="grid size-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-300" title="Search">
            <Search size={16} />
          </button>
          <button className="grid size-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-300" title="Filter">
            <Filter size={16} />
          </button>
          <button className="grid size-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-300" title="Sort">
            <ArrowDownUp size={16} />
          </button>
          <button className="grid size-9 place-items-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-cyan-100" title="Export">
            <Download size={16} />
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-zinc-500">
              {columns.map((column) => (
                <th key={String(column.key)} className="border-b border-white/10 px-3 py-3 font-medium">
                  {column.label}
                </th>
              ))}
              <th className="border-b border-white/10 px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="text-zinc-200">
                {columns.map((column) => (
                  <td key={String(column.key)} className="border-b border-white/5 px-3 py-3">
                    {column.render ? column.render(row) : String(row[column.key as keyof T] ?? "")}
                  </td>
                ))}
                <td className="border-b border-white/5 px-3 py-3">{row.status ? <StatusValue status={row.status} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>Showing {rows.length} of {rows.length} records</span>
        <span>Page 1 / 1</span>
      </div>
    </section>
  );
}

function StatusValue({ status }: { status: string }) {
  if (status === "active" || status === "inactive" || status === "draft" || status === "archived") {
    return <StatusPill status={status} />;
  }

  const styles: Record<string, string> = {
    completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    queued: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    failed: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles[status] ?? "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"}`}>
      {status}
    </span>
  );
}
