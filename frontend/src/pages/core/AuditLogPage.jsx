import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { SkeletonTable } from "../../components/Skeleton";
import { coreApi } from "../../services/api";

export function AuditLogPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["audit-logs"], queryFn: coreApi.auditLogs });

  if (query.isPending) return <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-6 xl:p-8"><SkeletonTable rows={8} cols={4} /></div>;
  if (query.isError) return <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-6 xl:p-8"><ErrorState error={query.error} onRetry={() => qc.invalidateQueries({ queryKey: ["audit-logs"] })} /></div>;

  const rows = query.data?.data || [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:py-6 xl:p-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold text-slate-950">Audit Log</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">Every important create, update, delete, login, and permission action is recorded here.</p>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {rows.length === 0 ? (
          <EmptyState title="No Activity Records" description="Audit logs will appear after users create, update, delete, import, export, or approve records." action="" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr><th className="px-3 py-3">Time</th><th className="px-3 py-3">Module</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Record</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3 text-slate-700">{row.tableName}</td>
                    <td className="px-3 py-3 font-medium text-slate-950">{row.action}</td>
                    <td className="px-3 py-3 text-slate-500">{row.recordId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
