/**
 * QuickFilters — Row of chip buttons for instant date/status filtering.
 */
import { useMemo } from "react";

export default function QuickFilters({ filters, activeKey, onSelect }) {
  // Group filters into logical sections
  const { dateFilters, statusFilters, valueFilters } = useMemo(() => {
    const dateFilters = [];
    const statusFilters = [];
    const valueFilters = [];
    for (const f of filters) {
      if (["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth"].includes(f.key)) {
        dateFilters.push(f);
      } else if (["highValue", "lowValue"].includes(f.key)) {
        valueFilters.push(f);
      } else {
        statusFilters.push(f);
      }
    }
    return { dateFilters, statusFilters, valueFilters };
  }, [filters]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onSelect(f.key)}
          className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-all
            ${activeKey === f.key
              ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
