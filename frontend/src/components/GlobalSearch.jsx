/**
 * GlobalSearch — Enterprise-wide search overlay.
 *
 * Features:
 * - Ctrl+K / Cmd+K (via the shortcut manager)
 * - Top-center placement, macOS Settings style
 * - Searches the backend (customers, products, documents, vendors,
 *   users, receipts, leads, branches, machines, work orders, companies)
 * - Static module/page results merged in
 * - Results grouped into labeled sections
 * - Fuzzy subsequence ranking + matched-text highlighting
 * - Click / arrow-key navigation to the target record
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search, X, Loader2, Building2, Package, FileText, Users, Truck,
  UserCircle, ShoppingCart, AlertCircle, LayoutDashboard, Boxes,
  Factory, Wallet, BarChart3, Settings, Shield, Warehouse, Layers,
  Briefcase, Workflow,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";
import {
  useShortcutStore,
  useGlobalShortcut,
  useOverlayStack,
} from "../hooks/useShortcutManager";

// ─── Static module / page results ───────────────────────────────────────────
const MODULE_RESULTS = [
  { id: "module-dashboard", type: "module", label: "Dashboard", keywords: "home overview kpi dashboard", icon: LayoutDashboard, url: "/" },
  { id: "module-sales", type: "module", label: "Sales", keywords: "orders invoices quotations leads sales crm", icon: ShoppingCart, url: "/sales" },
  { id: "module-purchase", type: "module", label: "Procurement", keywords: "purchase po grn rfq vendor supplier purchase", icon: Truck, url: "/purchase" },
  { id: "module-inventory", type: "module", label: "Inventory", keywords: "stock warehouse items products inventory", icon: Boxes, url: "/inventory" },
  { id: "module-manufacturing", type: "module", label: "Manufacturing", keywords: "production bom work orders machines quality manufacturing", icon: Factory, url: "/manufacturing" },
  { id: "module-finance", type: "module", label: "Finance", keywords: "accounts journal trial balance gst receivable payable finance", icon: Wallet, url: "/accounts" },
  { id: "module-crm", type: "module", label: "CRM", keywords: "customers pipeline leads crm", icon: Users, url: "/crm" },
  { id: "module-wms", type: "module", label: "Warehouse (WMS)", keywords: "warehouse wms locations bins", icon: Warehouse, url: "/wms" },
  { id: "module-hr", type: "module", label: "People & HR", keywords: "employees hrms attendance payroll hr", icon: Briefcase, url: "/hrms" },
  { id: "module-eam", type: "module", label: "Assets (EAM)", keywords: "assets maintenance eam equipment", icon: Layers, url: "/eam" },
  { id: "module-reports", type: "module", label: "Reports", keywords: "reports analytics executive bi insights", icon: BarChart3, url: "/executive" },
  { id: "module-settings", type: "module", label: "Settings", keywords: "settings company branches users roles", icon: Settings, url: "/settings" },
  { id: "module-admin", type: "module", label: "Administration", keywords: "admin permissions roles users system", icon: Shield, url: "/admin" },
  { id: "module-workflow", type: "module", label: "Workflows", keywords: "flow automation workflow approvals", icon: Workflow, url: "/flow" },
];

// ─── Result type → section label + icon/color ───────────────────────────────
const TYPE_GROUPS = {
  module: { label: "Modules & Pages", icon: LayoutDashboard, color: "bg-slate-100 text-slate-600 border-slate-200" },
  customer: { label: "Customers", icon: Building2, color: "bg-blue-50 text-blue-700 border-blue-200" },
  product: { label: "Products", icon: Package, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  document: { label: "Invoices & Orders", icon: FileText, color: "bg-purple-50 text-purple-700 border-purple-200" },
  purchaseDoc: { label: "Purchase Orders", icon: Truck, color: "bg-orange-50 text-orange-700 border-orange-200" },
  vendor: { label: "Vendors & Suppliers", icon: Truck, color: "bg-amber-50 text-amber-700 border-amber-200" },
  user: { label: "Employees", icon: Users, color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  receipt: { label: "Receipts", icon: ShoppingCart, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  lead: { label: "Leads", icon: UserCircle, color: "bg-rose-50 text-rose-700 border-rose-200" },
  branch: { label: "Branches", icon: Building2, color: "bg-teal-50 text-teal-700 border-teal-200" },
  machine: { label: "Machines", icon: Factory, color: "bg-violet-50 text-violet-700 border-violet-200" },
  workOrder: { label: "Work Orders", icon: Workflow, color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  company: { label: "Companies", icon: Building2, color: "bg-sky-50 text-sky-700 border-sky-200" },
};

// ─── Fuzzy scoring (substring → subsequence) ────────────────────────────────
/**
 * Score how well `query` matches `text`. Higher is better; 0 = no match.
 * Uses a case-insensitive subsequence scan with a penalty for gaps.
 */
function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = String(text || "").toLowerCase();
  if (!q) return 0;

  // Direct substring — strong match
  const idx = t.indexOf(q);
  if (idx >= 0) return 100 - Math.min(idx, 20);

  // Subsequence match (typo tolerance) — weaker
  let qi = 0;
  let gaps = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
    } else if (qi > 0) {
      gaps++;
    }
  }
  if (qi === q.length) return Math.max(20 - gaps, 1);
  return 0;
}

/** Split text into segments, highlighting substring matches of `query`. */
function highlight(text, query) {
  const safe = String(text || "");
  const q = query.trim();
  if (!q) return safe;
  const idx = safe.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return safe;
  return (
    <>
      {safe.slice(0, idx)}
      <mark className="rounded-sm bg-blue-100 text-blue-900">{safe.slice(idx, idx + q.length)}</mark>
      {safe.slice(idx + q.length)}
    </>
  );
}

export default function GlobalSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  const searchOpen = useShortcutStore((s) => s.searchOpen);
  const setSearchOpen = useShortcutStore((s) => s.setSearchOpen);

  const [query, setQuery] = useState("");

  useGlobalShortcut({
    id: "global-search",
    label: "Open Global Search",
    keys: { ctrl: true, key: "k" },
    category: "Global",
    handler: () => setSearchOpen(!searchOpen),
  });

  useOverlayStack("search", searchOpen);

  useEffect(() => {
    if (searchOpen && inputRef.current) inputRef.current.focus();
    if (!searchOpen) {
      setQuery("");
      setResults([]);
    }
  }, [searchOpen]);

  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 1) {
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
    debounceRef.current = setTimeout(() => doSearch(value), 200);
  }, [doSearch]);

  // ── Build grouped, ranked results ─────────────────────────────────────────
  const groups = useRef(null);
  groups.current = buildGroups(query, results);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      setSearchOpen(false);
      return;
    }
    const flat = flattenGroups(groups.current);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0 && flat[selectedIndex]) {
      navigateTo(flat[selectedIndex]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, selectedIndex, navigate]);

  const navigateTo = useCallback((result) => {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
    if (result.url) navigate(result.url);
  }, [navigate, setSearchOpen]);

  if (!searchOpen) {
    return (
      <div className="px-4 pt-3 lg:px-6">
        <button
          onClick={() => setSearchOpen(true)}
          className="mx-auto flex h-10 w-full max-w-xl items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-400 shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-sm hover:text-slate-500"
          title="Search everything (Ctrl+K)"
        >
          <Search size={15} className="shrink-0" />
          <span className="truncate">Search customers, orders, inventory, modules...</span>
          <kbd className="ml-auto shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 font-mono">⌘K</kbd>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 pt-[8vh] backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
      <div
        className="w-full max-w-2xl animate-scale-in rounded-2xl border border-slate-200/80 bg-white shadow-xl ring-1 ring-slate-900/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search everything — customers, orders, modules..."
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 text-sm outline-none placeholder:text-slate-400"
          />
          {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }} className="rounded-md p-1 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600">
              <X size={15} />
            </button>
          )}
          <kbd className="hidden shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 font-mono sm:inline">ESC</kbd>
        </div>

        {/* Grouped results */}
        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
          {groups.current.length === 0 && query && !loading && (
            <div className="flex flex-col items-center py-8 text-center">
              <AlertCircle size={32} className="text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">No results for "{query}"</p>
              <p className="text-xs text-slate-400">Try a different search term</p>
            </div>
          )}

          {groups.current.length === 0 && !query && !loading && (
            <div className="py-6 text-center text-xs text-slate-400">
              Start typing to search across the entire ERP
            </div>
          )}

          {groups.current.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <h3 className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((result) => {
                  const meta = TYPE_GROUPS[result.type] || TYPE_GROUPS.customer;
                  const Icon = meta.icon || FileText;
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => navigateTo(result)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
                        isSelected(selectedIndex, groups.current, result) ? "bg-blue-50 ring-1 ring-blue-200 shadow-xs" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${meta.color}`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{highlight(result.label, query)}</p>
                        <p className="truncate text-xs text-slate-500">{highlight(result.description, query)}</p>
                      </div>
                      <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                        {group.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Flatten grouped results in render order (for keyboard navigation). */
function flattenGroups(groups) {
  return groups.flatMap((g) => g.items);
}

/** True if `result` is the currently selected item in the flat ordering. */
function isSelected(selectedIndex, groups, result) {
  if (selectedIndex < 0) return false;
  const flat = flattenGroups(groups);
  const cur = flat[selectedIndex];
  return cur && cur.id === result.id && cur.type === result.type;
}

/**
 * Merge backend results with static module results, group by section,
 * rank each group by fuzzy score, drop non-matches.
 */
function buildGroups(query, results) {
  const q = query.trim();

  // Module results — filtered & ranked by fuzzy match against label/keywords
  const modules = MODULE_RESULTS
    .map((m) => ({ ...m, _score: Math.max(fuzzyScore(q, m.label), fuzzyScore(q, m.keywords)) }))
    .filter((m) => (q ? m._score > 0 : false))
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...rest }) => rest);

  // Backend results — ranked by fuzzy score, keep matches only when query present
  const api = results
    .map((r) => ({ ...r, _score: fuzzyScore(q, `${r.label} ${r.description}`) }))
    .filter((r) => (q ? r._score > 0 : true))
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...rest }) => rest);

  const byType = {};
  for (const r of api) {
    const key = TYPE_GROUPS[r.type] ? r.type : "customer";
    (byType[key] = byType[key] || []).push(r);
  }

  const groups = [];
  if (modules.length) groups.push({ label: TYPE_GROUPS.module.label, items: modules });
  for (const [type, items] of Object.entries(byType)) {
    groups.push({ label: TYPE_GROUPS[type].label, items });
  }
  return groups;
}
