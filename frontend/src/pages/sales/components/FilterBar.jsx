/**
 * FilterBar — Professional sticky filter bar for the Sales module.
 *
 * Features:
 * - Global search (debounced)
 * - Status dropdown
 * - Date range picker with presets
 * - Customer dropdown
 * - Sales Executive dropdown
 * - Branch dropdown
 * - Amount range
 * - Sort options
 * - Quick reset
 * - Export button
 */
import { useState, useRef, useEffect } from "react";
import { Search, SlidersHorizontal, RotateCcw, Download, ChevronDown, X, Filter } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import DateRangePicker from "./DateRangePicker";
import ExportMenu from "./ExportMenu";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "CLOSED", label: "Closed" },
];

const SORT_OPTIONS = [
  { value: "createdAt-desc", label: "Newest First" },
  { value: "createdAt-asc", label: "Oldest First" },
  { value: "documentDate-desc", label: "Date (Newest)" },
  { value: "documentDate-asc", label: "Date (Oldest)" },
  { value: "totalAmount-desc", label: "Amount (High to Low)" },
  { value: "totalAmount-asc", label: "Amount (Low to High)" },
  { value: "documentNo-asc", label: "Document No (A-Z)" },
  { value: "documentNo-desc", label: "Document No (Z-A)" },
];

export default function FilterBar({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  onReset,
  customers = [],
  users = [],
  branches = [],
  exportData,
  exportLoading,
  activeFilters,
  onRemoveFilter,
  compact = false,
}) {
  const searchRef = useRef(null);

  return (
    <div className="sticky top-0 z-30 -mx-1 rounded-xl border border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
      {/* Main filter row */}
      <div className="flex flex-wrap items-center gap-2 p-3">
        {/* Global Search */}
        <div className="relative min-w-[200px] flex-1 lg:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search orders, customers..." /* Ctrl+K */
            value={searchQuery || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status */}
        <select
          value={filters.status || ""}
          onChange={(e) => onFilterChange("status", e.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-blue-400"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Date Range */}
        <DateRangePicker
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={(from, to) => {
            onFilterChange("dateFrom", from);
            onFilterChange("dateTo", to);
          }}
          onReset={() => {
            onFilterChange("dateFrom", "");
            onFilterChange("dateTo", "");
          }}
        />

        {/* Sort */}
        <select
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split("-");
            onFilterChange("sortBy", sortBy);
            onFilterChange("sortOrder", sortOrder);
          }}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-blue-400"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* More filters toggle */}
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-all
            ${showMore || filters.customerId || filters.branchId || filters.createdBy || filters.amountMin || filters.amountMax
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          <Filter size={15} />
          <span className="hidden sm:inline">Filters</span>
        </button>

        {/* Export */}
        <ExportMenu
          onExport={(format) => exportData?.(format)}
          loading={exportLoading}
        />

        {/* Reset */}
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          title="Reset all filters"
        >
          <RotateCcw size={15} />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Expanded filter row */}
      {showMore && (
        <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-3 pb-3 pt-2">
          {/* Customer */}
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Customer</label>
            <select
              value={filters.customerId || ""}
              onChange={(e) => onFilterChange("customerId", e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none hover:border-slate-300 focus:border-blue-400"
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Sales Executive */}
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Sales Person</label>
            <select
              value={filters.createdBy || ""}
              onChange={(e) => onFilterChange("createdBy", e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none hover:border-slate-300 focus:border-blue-400"
            >
              <option value="">All Persons</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Branch</label>
            <select
              value={filters.branchId || ""}
              onChange={(e) => onFilterChange("branchId", e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none hover:border-slate-300 focus:border-blue-400"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Amount Range */}
          <div className="min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-slate-500">Amount Range (₹)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min"
                value={filters.amountMin || ""}
                onChange={(e) => onFilterChange("amountMin", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none hover:border-slate-300 focus:border-blue-400"
              />
              <span className="text-slate-400">—</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.amountMax || ""}
                onChange={(e) => onFilterChange("amountMax", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none hover:border-slate-300 focus:border-blue-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Active Filters */}
      {activeFilters?.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-3 py-2">
          {activeFilters.map((af) => (
            <span
              key={af.key}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
            >
              {af.isQuick ? (
                <span className="font-semibold">{af.value}</span>
              ) : (
                <>
                  <span className="text-blue-400">{af.label}:</span>
                  <span>{af.value}</span>
                </>
              )}
              <button
                onClick={() => onRemoveFilter(af.key)}
                className="ml-0.5 rounded-full p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-700"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
