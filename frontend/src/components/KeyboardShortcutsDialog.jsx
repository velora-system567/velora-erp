/**
 * KeyboardShortcutsDialog — Modal overlay showing all available keyboard shortcuts.
 *
 * Opens via Ctrl+/ or from Settings. Displays shortcuts grouped by category
 * with key-combo badges. Search/filterable.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { X, Search, Keyboard } from "lucide-react";
import {
  useShortcutStore,
  formatKeys,
  useOverlayStack,
} from "../hooks/useShortcutManager";

export default function KeyboardShortcutsDialog() {
  const dialogOpen = useShortcutStore((s) => s.dialogOpen);
  const setDialogOpen = useShortcutStore((s) => s.setDialogOpen);
  const globalShortcuts = useShortcutStore((s) => s.globalShortcuts);
  const moduleShortcuts = useShortcutStore((s) => s.moduleShortcuts);
  const activeModule = useShortcutStore((s) => s.activeModule);
  const enabled = useShortcutStore((s) => s.enabled);
  const setEnabled = useShortcutStore((s) => s.setEnabled);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Register as overlay for ESC close
  useOverlayStack("shortcuts-dialog", dialogOpen);

  // Focus input when opened
  useEffect(() => {
    if (dialogOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!dialogOpen) {
      setQuery("");
    }
  }, [dialogOpen]);

  // Build grouped list of all shortcuts
  const groups = useMemo(() => {
    const collected = [];

    // Global group
    const coreGlobals = [
      { id: "global-search", label: "Open Global Search", keys: { ctrl: true, key: "k" }, category: "Global" },
      { id: "global-shortcuts", label: "Keyboard Shortcuts", keys: { ctrl: true, key: "/" }, category: "Global" },
      { id: "global-sidebar", label: "Toggle Sidebar", keys: { ctrl: true, shift: true, key: "S" }, category: "Global" },
      { id: "global-dashboard", label: "Go to Dashboard", keys: { ctrl: true, shift: true, key: "D" }, category: "Global" },
      { id: "global-new", label: "Create New Record", keys: { ctrl: true, shift: true, key: "N" }, category: "Global" },
      { id: "global-refresh", label: "Refresh Module", keys: { ctrl: true, shift: true, key: "R" }, category: "Global" },
      { id: "global-focus-search", label: "Focus Search", keys: { ctrl: true, shift: true, key: "F" }, category: "Global" },
      { id: "global-esc", label: "Close overlay / drawer", keys: { key: "Escape" }, category: "Global" },
    ];

    // Merge registered globals with core set (registered globals override)
    const globalMap = {};
    for (const sc of [...coreGlobals, ...globalShortcuts]) {
      globalMap[sc.id] = sc;
    }
    collected.push({
      category: "Global",
      shortcuts: Object.values(globalMap),
    });

    // Active module shortcuts
    if (activeModule && moduleShortcuts[activeModule]) {
      const label = activeModule.charAt(0).toUpperCase() + activeModule.slice(1);
      collected.push({
        category: label,
        shortcuts: moduleShortcuts[activeModule],
      });
    }

    // Filter by query
    if (query.trim()) {
      const q = query.toLowerCase();
      return collected
        .map((g) => ({
          ...g,
          shortcuts: g.shortcuts.filter(
            (s) =>
              s.label?.toLowerCase().includes(q) ||
              formatKeys(s.keys).toLowerCase().includes(q)
          ),
        }))
        .filter((g) => g.shortcuts.length > 0);
    }

    return collected;
  }, [globalShortcuts, moduleShortcuts, activeModule, query]);

  // Flatten for keyboard navigation
  const flatShortcuts = useMemo(
    () => groups.flatMap((g) => g.shortcuts),
    [groups]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatShortcuts.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
    },
    [flatShortcuts.length]
  );

  if (!dialogOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[10vh] backdrop-blur-sm"
      onClick={() => setDialogOpen(false)}
    >
      <div
        className="w-full max-w-xl animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-950">
              Keyboard Shortcuts
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Enable/disable toggle */}
            <label
              className="flex cursor-pointer items-center gap-2 text-xs text-slate-500"
              title="Enable or disable all shortcuts"
            >
              <span className="select-none">{enabled ? "On" : "Off"}</span>
              <div
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  enabled ? "bg-blue-600" : "bg-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="peer sr-only"
                />
                <div
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    enabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </label>
            <button
              onClick={() => setDialogOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search shortcuts..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Shortcuts list */}
        <div className="max-h-[55vh] overflow-y-auto p-4">
          {groups.length === 0 && query && (
            <div className="py-8 text-center text-sm text-slate-500">
              No shortcuts match "{query}"
            </div>
          )}

          {groups.length === 0 && !query && (
            <div className="py-8 text-center text-sm text-slate-400">
              No shortcuts registered
            </div>
          )}

          {groups.map((group) => (
            <div key={group.category} className="mb-5 last:mb-0">
              <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.category}
              </h3>
              <div className="space-y-0.5">
                {group.shortcuts.map((sc, idx) => {
                  const flatIdx = flatShortcuts.indexOf(sc);
                  return (
                    <div
                      key={sc.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                        flatIdx === selectedIndex && !query
                          ? "bg-blue-50 ring-1 ring-blue-200"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-sm text-slate-700">
                        {sc.label}
                      </span>
                      <kbd className="ml-4 shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-medium text-slate-600 shadow-sm">
                        {formatKeys(sc.keys)}
                      </kbd>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3 text-center text-xs text-slate-400">
          Press{" "}
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px]">
            Ctrl + /
          </kbd>{" "}
          to toggle this dialog
        </div>
      </div>
    </div>
  );
}
