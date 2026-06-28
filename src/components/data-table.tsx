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
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50" title="Search" aria-label="Search">
            <Search size={16} />
          </button>
          <button className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50" title="Filter" aria-label="Filter">
            <Filter size={16} />
          </button>
          <button className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50" title="Sort" aria-label="Sort">
            <ArrowDownUp size={16} />
          </button>
          <button className="grid size-10 place-items-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:bg-emerald-100" title="Export" aria-label="Export">
            <Download size={16} />
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              {columns.map((column) => (
                <th key={String(column.key)} className="border-b border-slate-200 bg-slate-50 px-3 py-3 font-semibold">
                  {column.label}
                </th>
              ))}
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="text-slate-700">
                {columns.map((column) => (
                  <td key={String(column.key)} className="border-b border-slate-100 px-3 py-3">
                    {column.render ? column.render(row) : String(row[column.key as keyof T] ?? "")}
                  </td>
                ))}
                <td className="border-b border-slate-100 px-3 py-3">{row.status ? <StatusValue status={row.status} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{rows.length} records</span>
        <span>Ready for Excel and CSV</span>
      </div>
    </section>
  );
}

function StatusValue({ status }: { status: string }) {
  if (status === "active" || status === "inactive" || status === "draft" || status === "archived") {
    return <StatusPill status={status} />;
  }

  const styles: Record<string, string> = {
    completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    queued: "border-blue-200 bg-blue-50 text-blue-700",
    failed: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles[status] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>
      {status}
    </span>
  );
}
