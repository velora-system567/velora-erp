/**
 * LiveIndicator — "Updated X ago" status pill + refresh button for dashboards.
 *
 * Reads the React Query query's dataUpdatedAt / isFetching so background
 * refetches (auto-refresh) show a subtle pulse without rebuilding the page.
 */
import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function LiveIndicator({ query, onRefresh, label = "Live" }) {
  const dataUpdatedAt = query?.dataUpdatedAt;
  const isFetching = query?.isFetching;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  const seconds = dataUpdatedAt ? Math.max(0, Math.round((now - dataUpdatedAt) / 1000)) : null;
  const text =
    seconds == null ? "—"
    : seconds < 5 ? "just now"
    : seconds < 60 ? `${seconds}s ago`
    : `${Math.floor(seconds / 60)}m ago`;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
          isFetching
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${isFetching ? "animate-pulse bg-blue-500" : "bg-emerald-500"}`} />
        {isFetching ? "Updating…" : `${label} · Updated ${text}`}
      </span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          title="Refresh now"
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
        </button>
      )}
    </div>
  );
}
