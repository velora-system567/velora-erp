/**
 * useSalesFilters — Central filter state management for the Sales module.
 *
 * All filter state lives here: quick chips, advanced filters, saved presets,
 * sorting, grouping, pagination, and selection.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";

const QUICK_FILTERS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "thisWeek", label: "This Week" },
  { key: "lastWeek", label: "Last Week" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "draft", label: "Draft" },
  { key: "cancelled", label: "Cancelled" },
  { key: "closed", label: "Closed" },
  { key: "highValue", label: "High Value" },
  { key: "lowValue", label: "Low Value" },
];

function getQuickDateRange(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (key) {
    case "today":
      return { dateFrom: toDateStr(now), dateTo: toDateStr(now) };
    case "yesterday": {
      const yest = new Date(now);
      yest.setDate(d - 1);
      return { dateFrom: toDateStr(yest), dateTo: toDateStr(yest) };
    }
    case "thisWeek": {
      const start = new Date(now);
      start.setDate(d - now.getDay());
      return { dateFrom: toDateStr(start), dateTo: toDateStr(now) };
    }
    case "lastWeek": {
      const start = new Date(now);
      start.setDate(d - now.getDay() - 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { dateFrom: toDateStr(start), dateTo: toDateStr(end) };
    }
    case "thisMonth":
      return { dateFrom: `${y}-${String(m + 1).padStart(2, "0")}-01`, dateTo: toDateStr(now) };
    case "lastMonth": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const lastDay = new Date(ly, lm + 1, 0).getDate();
      return { dateFrom: `${ly}-${String(lm + 1).padStart(2, "0")}-01`, dateTo: `${ly}-${String(lm + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` };
    }
    default:
      return {};
  }
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const SAVED_FILTERS_KEY = "velora_sales_saved_filters";

function loadSavedFilters() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistSavedFilters(list) {
  localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(list));
}

const defaultFilters = {
  q: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  customerId: "",
  branchId: "",
  createdBy: "",
  amountMin: "",
  amountMax: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

export function useSalesFilters() {
  const [filters, setFilters] = useState({ ...defaultFilters });
  const [activeQuickFilter, setActiveQuickFilter] = useState("all");
  const [savedFilters, setSavedFilters] = useState(loadSavedFilters);
  const [groupBy, setGroupBy] = useState("");
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const debounceRef = useRef(null);

  // Set a single filter value, reset to page 1
  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  // Reset all filters to defaults
  const resetFilters = useCallback(() => {
    setFilters({ ...defaultFilters });
    setActiveQuickFilter("all");
    setPage(1);
  }, []);

  // Clear only active date range from a quick filter
  const removeQuickFilter = useCallback(() => {
    setActiveQuickFilter("all");
    setFilters((prev) => ({ ...prev, dateFrom: "", dateTo: "", status: "" }));
    setPage(1);
  }, []);

  // Apply a quick filter chip
  const applyQuickFilter = useCallback((key) => {
    setActiveQuickFilter(key);
    setPage(1);

    if (key === "all") {
      setFilters((prev) => ({ ...prev, dateFrom: "", dateTo: "", status: "" }));
      return;
    }

    const dateRange = getQuickDateRange(key);
    const statusMap = {
      pending: "DRAFT",
      approved: "APPROVED",
      draft: "DRAFT",
      cancelled: "CANCELLED",
      closed: "CLOSED",
    };

    setFilters((prev) => ({
      ...prev,
      ...dateRange,
      status: statusMap[key] || prev.status,
      amountMin: key === "highValue" ? "100000" : key === "lowValue" ? "0" : prev.amountMin,
      amountMax: key === "highValue" ? prev.amountMax : key === "lowValue" ? "99999" : prev.amountMax,
    }));
  }, []);

  // Save current filters
  const saveFilter = useCallback((name) => {
    setSavedFilters((prev) => {
      const updated = [...prev, { id: Date.now().toString(36), name, filters: { ...filters }, quickFilter: activeQuickFilter }];
      persistSavedFilters(updated);
      return updated;
    });
  }, [filters, activeQuickFilter]);

  // Load a saved filter
  const loadFilter = useCallback((id) => {
    const saved = savedFilters.find((f) => f.id === id);
    if (saved) {
      setFilters({ ...defaultFilters, ...saved.filters });
      setActiveQuickFilter(saved.quickFilter || "all");
      setPage(1);
    }
  }, [savedFilters]);

  // Delete a saved filter
  const deleteFilter = useCallback((id) => {
    setSavedFilters((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      persistSavedFilters(updated);
      return updated;
    });
  }, []);

  // Debounced search
  const setSearch = useCallback((value) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilter("q", value);
    }, 300);
  }, [setFilter]);

  // Build active filters list for display
  const activeFilters = useMemo(() => {
    const list = [];
    if (filters.q) list.push({ key: "q", label: "Search", value: `"${filters.q}"` });
    if (filters.status) list.push({ key: "status", label: "Status", value: filters.status.replace(/_/g, " ") });
    if (filters.dateFrom && filters.dateTo) list.push({ key: "date", label: "Date", value: `${filters.dateFrom} to ${filters.dateTo}` });
    else if (filters.dateFrom) list.push({ key: "dateFrom", label: "From", value: filters.dateFrom });
    else if (filters.dateTo) list.push({ key: "dateTo", label: "To", value: filters.dateTo });
    if (filters.customerId) list.push({ key: "customerId", label: "Customer", value: filters.customerId });
    if (filters.branchId) list.push({ key: "branchId", label: "Branch", value: filters.branchId });
    if (filters.createdBy) list.push({ key: "createdBy", label: "Sales Person", value: filters.createdBy });
    if (filters.amountMin) list.push({ key: "amountMin", label: "Min Amount", value: `₹${Number(filters.amountMin).toLocaleString("en-IN")}` });
    if (filters.amountMax) list.push({ key: "amountMax", label: "Max Amount", value: `₹${Number(filters.amountMax).toLocaleString("en-IN")}` });
    if (activeQuickFilter !== "all") {
      const qf = QUICK_FILTERS.find((f) => f.key === activeQuickFilter);
      if (qf) list.push({ key: "_quick", label: "Quick", value: qf.label, isQuick: true });
    }
    return list;
  }, [filters, activeQuickFilter]);

  const hasActiveFilters = activeFilters.length > 0 || filters !== defaultFilters;

  // Toggle row selection
  const toggleRow = useCallback((id) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids) => {
    setSelectedRows((prev) => {
      if (prev.size === ids.length) return new Set();
      return new Set(ids);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedRows(new Set()), []);

  // Build API query params from filters
  const queryParams = useMemo(() => {
    const params = { page, limit };
    if (filters.q) params.q = filters.q;
    if (filters.status) params.status = filters.status;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.customerId) params.customerId = filters.customerId;
    if (filters.branchId) params.branchId = filters.branchId;
    if (filters.createdBy) params.createdBy = filters.createdBy;
    if (filters.amountMin) params.amountMin = filters.amountMin;
    if (filters.amountMax) params.amountMax = filters.amountMax;
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortOrder) params.sortOrder = filters.sortOrder;
    return params;
  }, [filters, page, limit]);

  return {
    filters,
    setFilter,
    setFilters,
    resetFilters,
    activeFilters,
    removeQuickFilter,
    activeQuickFilter,
    applyQuickFilter,
    quickFilters: QUICK_FILTERS,
    savedFilters,
    saveFilter,
    loadFilter,
    deleteFilter,
    searchQuery: filters.q,
    setSearch,
    groupBy,
    setGroupBy,
    selectedRows,
    toggleRow,
    toggleAll,
    clearSelection,
    page,
    setPage,
    limit,
    setLimit,
    queryParams,
  };
}
