/**
 * SalesTable — Enhanced data table with sorting, selection, grouping,
 * column filtering, pagination, totals, and empty/loading states.
 */
import { useState, useMemo, useCallback } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, GripVertical } from "lucide-react";
import { SkeletonTable } from "../../../components/Skeleton";
import { EmptyState } from "../../../components/EmptyState";
import { formatRupees } from "../../../utils/money";

// ─── Sortable Header ─────────────────────────────────────────────────────────

function SortHeader({ label, sortKey, currentSort, currentOrder, onSort, className = "", width }) {
  const isActive = currentSort === sortKey;

  return (
    <th
      className={`group cursor-pointer select-none px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-slate-100 ${className}`}
      onClick={() => {
        if (isActive) {
          onSort(sortKey, currentOrder === "asc" ? "desc" : "asc");
        } else {
          onSort(sortKey, "desc");
        }
      }}
      style={width ? { width } : undefined}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <span className="inline-flex flex-col text-[0.6rem] text-slate-300 transition-colors group-hover:text-slate-500">
          {isActive ? (
            currentOrder === "asc" ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />
          ) : (
            <ArrowUpDown size={13} className="opacity-0 group-hover:opacity-100" />
          )}
        </span>
      </div>
    </th>
  );
}

// ─── Column Filter Popover ────────────────────────────────────────────────────

function ColumnFilterPopover({ column, options, activeFilter, onFilterChange, onClose }) {
  if (!options || options.length === 0) return null;

  return (
    <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] origin-top-right animate-fade-in rounded-xl border border-slate-200 bg-white p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-1 px-2 py-1 text-xs font-semibold text-slate-500">Filter by {column}</div>
      <div className="max-h-[240px] space-y-0.5 overflow-y-auto">
        <button
          onClick={() => { onFilterChange(""); onClose?.(); }}
          className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${!activeFilter ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}
        >
          All
        </button>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { onFilterChange(opt.value); onClose?.(); }}
            className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${activeFilter === opt.value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main SalesTable ──────────────────────────────────────────────────────────

export default function SalesTable({
  // Data
  data = [],
  columns = [],
  meta = {},
  loading = false,
  error = null,
  onRetry,

  // Sorting
  sortBy,
  sortOrder,
  onSort,

  // Selection
  selectedRows = new Set(),
  onToggleRow,
  onToggleAll,
  rowIdKey = "id",

  // Grouping
  groupBy,
  groupLabel,

  // Pagination
  page,
  limit,
  onPageChange,
  onLimitChange,

  // Column filters
  columnFilters,
  onColumnFilter,

  // Custom renders
  renderRow,
  onRowClick,

  // Empty state
  emptyTitle,
  emptyDescription,
  emptyAction,
  onEmptyAction,

  // Totals footer
  showFooter = false,
  totalAmount,
  footerExtras,

  // Additional className
  className = "",
}) {
  const [openColumnFilter, setOpenColumnFilter] = useState(null);

  const allSelected = data.length > 0 && selectedRows.size === data.length;
  const someSelected = selectedRows.size > 0 && selectedRows.size < data.length;

  const handleSelectAll = useCallback(() => {
    if (onToggleAll) {
      onToggleAll(data.map((r) => r[rowIdKey]));
    }
  }, [data, rowIdKey, onToggleAll]);

  // Group data if groupBy is set
  const grouped = useMemo(() => {
    if (!groupBy || !data.length) return null;
    const groups = {};
    for (const row of data) {
      const key = groupLabel ? groupLabel(row) : row[groupBy] || "Uncategorized";
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return groups;
  }, [data, groupBy, groupLabel]);

  // Loading state
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <SkeletonTable rows={8} cols={columns.length + 1} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <EmptyState
          title="Failed to load data"
          description={error?.message || "Something went wrong. Please try again."}
          action={onRetry ? { label: "Retry", onClick: onRetry } : undefined}
        />
      </div>
    );
  }

  // Empty state
  if (!data.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-12">
          <EmptyState
            title={emptyTitle || "No records found"}
            description={emptyDescription || "Try adjusting your filters or create a new record."}
            action={emptyAction || (onEmptyAction ? { label: "Create New", onClick: onEmptyAction } : undefined)}
          />
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil((meta.total || data.length) / limit);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          {/* Sticky Header */}
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200 bg-slate-50">
              {/* Checkbox */}
              {onToggleAll && (
                <th className="w-10 px-3 py-3.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
              )}
              {/* Column headers */}
              {columns.map((col, idx) => {
                if (col.sortKey !== undefined || col.sortable) {
                  return (
                    <SortHeader
                      key={col.key || idx}
                      label={col.label}
                      sortKey={col.sortKey || col.key}
                      currentSort={sortBy}
                      currentOrder={sortOrder}
                      onSort={onSort}
                      className={col.className}
                      width={col.width}
                    />
                  );
                }
                return (
                  <th
                    key={col.key || idx}
                    className={`relative px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 ${col.className || ""}`}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      {col.filterable && col.filterOptions && (
                        <button
                          onClick={() => setOpenColumnFilter(openColumnFilter === col.key ? null : col.key)}
                          className={`rounded p-0.5 transition-colors ${columnFilters?.[col.key] ? "text-blue-600" : "text-slate-300 hover:text-slate-500"}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
                        </button>
                      )}
                    </div>
                    {col.filterable && openColumnFilter === col.key && (
                      <ColumnFilterPopover
                        column={col.label}
                        options={col.filterOptions}
                        activeFilter={columnFilters?.[col.key]}
                        onFilterChange={(v) => onColumnFilter?.(col.key, v)}
                        onClose={() => setOpenColumnFilter(null)}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-100">
            {grouped ? (
              // Grouped rows
              Object.entries(grouped).map(([group, rows]) => (
                <FragmentGroup key={group} label={group} count={rows.length}>
                  {rows.map((row, idx) => (
                    <TableRow
                      key={row[rowIdKey] || idx}
                      row={row}
                      columns={columns}
                      selected={selectedRows.has(row[rowIdKey])}
                      onToggle={onToggleRow ? () => onToggleRow(row[rowIdKey]) : undefined}
                      onRowClick={onRowClick}
                      renderRow={renderRow}
                      rowIdKey={rowIdKey}
                    />
                  ))}
                </FragmentGroup>
              ))
            ) : (
              // Regular rows
              data.map((row, idx) => (
                <TableRow
                  key={row[rowIdKey] || idx}
                  row={row}
                  columns={columns}
                  selected={selectedRows.has(row[rowIdKey])}
                  onToggle={onToggleRow ? () => onToggleRow(row[rowIdKey]) : undefined}
                  onRowClick={onRowClick}
                  renderRow={renderRow}
                  rowIdKey={rowIdKey}
                  index={idx}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm">
        <div className="flex items-center gap-4 text-slate-500">
          {showFooter && (
            <>
              <span className="font-medium tabular-nums">{meta.total || data.length} total</span>
              {selectedRows.size > 0 && <span className="font-medium text-blue-600">{selectedRows.size} selected</span>}
              {totalAmount !== undefined && (
                <span className="font-medium tabular-nums">
                  Total: {formatRupees(totalAmount)}
                </span>
              )}
              {meta.total > 0 && (
                <span className="hidden text-slate-400 md:inline">
                  Avg: {formatRupees(Math.round(totalAmount / meta.total))}
                </span>
              )}
              {footerExtras}
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Rows per page */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Rows</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange?.(Number(e.target.value))}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 outline-none"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <PageBtn onClick={() => onPageChange(1)} disabled={page <= 1}><ChevronsLeft size={15} /></PageBtn>
              <PageBtn onClick={() => onPageChange(page - 1)} disabled={page <= 1}><ChevronLeft size={15} /></PageBtn>
              <span className="mx-1 min-w-[60px] text-center text-xs font-medium text-slate-600">
                Page {page} of {totalPages}
              </span>
              <PageBtn onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}><ChevronRight size={15} /></PageBtn>
              <PageBtn onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}><ChevronsRight size={15} /></PageBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TableRow({ row, columns, selected, onToggle, onRowClick, renderRow, rowIdKey, index }) {
  if (renderRow) {
    return (
      <tr
        className={`transition-colors ${selected ? "bg-blue-50/50" : index % 2 === 1 ? "bg-slate-50/30" : "bg-white"} hover:bg-blue-50/40`}
      >
        {onToggle && (
          <td className="px-3 py-3 align-middle">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </td>
        )}
        {renderRow(row)}
      </tr>
    );
  }

  return (
    <tr
      onClick={() => onRowClick?.(row)}
      className={`transition-colors ${selected ? "bg-blue-50/50" : index % 2 === 1 ? "bg-slate-50/30" : "bg-white"} ${onRowClick ? "cursor-pointer" : ""} hover:bg-blue-50/40`}
    >
      {onToggle && (
        <td className="px-3 py-3 align-middle">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
        </td>
      )}
      {columns.map((col) => (
        <td key={col.key} className={`px-4 py-3.5 align-middle ${col.cellClass || ""}`}>
          {col.render ? col.render(row) : row[col.key] ?? "—"}
        </td>
      ))}
    </tr>
  );
}

function FragmentGroup({ label, count, children }) {
  return (
    <>
      <tr className="bg-slate-100/70">
        <td colSpan={99} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-slate-400" />
            {label}
            <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">{count}</span>
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}

function PageBtn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
