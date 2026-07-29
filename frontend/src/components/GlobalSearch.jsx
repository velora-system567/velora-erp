/**
 * GlobalSearch — Google-like search overlay for the entire ERP.
 *
 * Features:
 * - Ctrl+K / Cmd+K keyboard shortcut
 * - Search across customers, products, invoices, orders, users, vendors, leads
 * - Categorized results with icons
 * - Click to navigate
 * - Quick reset
 * - Debounced input
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2, ArrowUpDown, Building2, Package, FileText, Users, Truck, UserCircle, ShoppingCart, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";

// Icon per result type
const TYPE_ICONS = {
  customer: Building2,
  product: Package,
  document: FileText,
  vendor: Truck,
  user: Users,
  receipt: ShoppingCart,
  lead: UserCircle,
};

const TYPE_COLORS = {
  customer: "bg-blue-50 text-blue-700 border-blue-200",
  product: "bg-emerald-50 text-emerald-700 border-emerald-200",
  document: "bg-purple-50 text-purple-700 border-purple-200",
  vendor: "bg-amber-50 text-amber-700 border-amber-200",
  user: "bg-cyan-50 text-cyan-700 border-cyan-200",
  receipt: "bg-indigo-50 text-indigo-700 border-indigo-200",
  lead: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  // Ctrl+K / Cmd+K to open
  useEffect(() => {
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest(`/search?q=${encodeURIComponent(q)}`);
      setResults(res.data?.results || []);
      setSelectedIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback((value) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 250);
  }, [doSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0 && results[selectedIndex]) {
      navigateTo(results[selectedIndex]);
    }
  }, [results, selectedIndex, navigate]);

  const navigateTo = useCallback((result) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    if (result.url) navigate(result.url);
  }, [navigate]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-500 lg:w-64"
        title="Search (Ctrl+K)"
      >
        <Search size={14} />
        <span className="hidden lg:inline">Search customers, orders...</span>
        <span className="ml-auto hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 lg:inline">⌘K</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search customers, products, invoices, orders, employees..."
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 text-sm outline-none placeholder:text-slate-400"
          />
          {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }} className="rounded p-1 text-slate-400 hover:bg-slate-100">
              <X size={15} />
            </button>
          )}
          <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 && query && !loading && (
            <div className="flex flex-col items-center py-8 text-center">
              <AlertCircle size={32} className="text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">No results for "{query}"</p>
              <p className="text-xs text-slate-400">Try a different search term</p>
            </div>
          )}

          {results.length === 0 && !query && !loading && (
            <div className="py-6 text-center text-xs text-slate-400">
              Start typing to search across the entire ERP
            </div>
          )}

          {results.map((result, idx) => {
            const Icon = TYPE_ICONS[result.type] || FileText;
            const colorClass = TYPE_COLORS[result.type] || "bg-slate-50 text-slate-700 border-slate-200";

            return (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => navigateTo(result)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                  idx === selectedIndex ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"
                }`}
              >
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${colorClass}`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{result.label}</p>
                  <p className="truncate text-xs text-slate-500">{result.description}</p>
                </div>
                <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                  {result.type}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
