import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader, SecondaryButton } from "../../components/PageHeader";
import { SkeletonTable } from "../../components/Skeleton";
import { coreApi } from "../../services/api";
import { Cell, Head, Pill, TableShell, dateTime } from "../inventory/components/shared";

const ACTION_STYLES = {
  CREATE: "bg-emerald-50 text-emerald-700",
  UPDATE: "bg-blue-50 text-blue-700",
  DELETE: "bg-rose-50 text-rose-700",
  LOGIN_SUCCESS: "bg-emerald-50 text-emerald-700",
  LOGIN_FAILED: "bg-rose-50 text-rose-700",
  ROLE_ASSIGNED: "bg-purple-50 text-purple-700",
  ROLE_REMOVED: "bg-amber-50 text-amber-700",
  PERMISSION_CHANGED: "bg-indigo-50 text-indigo-700",
};

export function AuditLogPage() {
  const qc = useQueryClient();
  // Wrap to prevent React Query's context object from being passed as params
  const query = useQuery({ queryKey: ["audit-logs"], queryFn: () => coreApi.auditLogs() });
  const [search, setSearch] = useState("");

  if (query.isPending) return <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-6 xl:p-8"><SkeletonTable rows={8} cols={4} /></div>;
  if (query.isError) return <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-6 xl:p-8"><ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["audit-logs"] })} /></div>;

  const rows = query.data?.data || [];
  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.tableName || "").toLowerCase().includes(q) ||
           (r.action || "").toLowerCase().includes(q) ||
           (r.recordId || "").toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader
        title="Audit Log"
        description="Every important create, update, delete, login, and permission action is recorded here."
        actions={<SecondaryButton label="Refresh" icon={RefreshCw} onClick={() => qc.invalidateQueries({ queryKey: ["audit-logs"] })} />}
      />

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter audit logs..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-xs outline-none transition-all duration-150 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <span className="text-xs text-slate-400">{filtered.length} records</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No Activity Records" description="Audit logs will appear after users create, update, delete, import, export, or approve records." />
      ) : (
        <TableShell>
          <Head>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Module</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Record</th>
          </Head>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row) => (
              <tr key={row.id} className="transition-colors duration-150 hover:bg-slate-50">
                <Cell className="whitespace-nowrap text-xs text-slate-500">
                  {dateTime(row.createdAt)}
                </Cell>
                <Cell>
                  <span className="text-sm font-medium text-slate-700">{row.tableName || "—"}</span>
                </Cell>
                <Cell>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${ACTION_STYLES[row.action] || "bg-slate-100 text-slate-600"}`}>
                    {row.action?.replace(/_/g, " ") || "—"}
                  </span>
                </Cell>
                <Cell className="max-w-[200px] truncate text-xs text-slate-400 font-mono">
                  {row.recordId ? row.recordId.slice(0, 8) + "..." : "—"}
                </Cell>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
