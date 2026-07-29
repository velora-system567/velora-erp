/**
 * DateRangePicker — Professional date range selector with presets.
 *
 * Supports: Today, Yesterday, Last 7 Days, Last 30 Days,
 * This Month, Last Month, and Custom Range.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "custom", label: "Custom Range" },
];

function getPresetRange(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (key) {
    case "today": {
      const s = toDateStr(now);
      return { dateFrom: s, dateTo: s };
    }
    case "yesterday": {
      const yest = new Date(now);
      yest.setDate(d - 1);
      const s = toDateStr(yest);
      return { dateFrom: s, dateTo: s };
    }
    case "last7": {
      const start = new Date(now);
      start.setDate(d - 6);
      return { dateFrom: toDateStr(start), dateTo: toDateStr(now) };
    }
    case "last30": {
      const start = new Date(now);
      start.setDate(d - 29);
      return { dateFrom: toDateStr(start), dateTo: toDateStr(now) };
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
      return { dateFrom: "", dateTo: "" };
  }
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function DateRangePicker({ dateFrom, dateTo, onChange, onReset }) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState(null);
  const [customFrom, setCustomFrom] = useState(dateFrom || "");
  const [customTo, setCustomTo] = useState(dateTo || "");
  const ref = useRef(null);

  // Determine active preset from current dates
  useEffect(() => {
    if (!dateFrom && !dateTo) {
      setActivePreset(null);
      return;
    }
    const match = PRESETS.find((p) => {
      if (p.key === "custom") return false;
      const range = getPresetRange(p.key);
      return range.dateFrom === dateFrom && range.dateTo === dateTo;
    });
    setActivePreset(match?.key || "custom");
    if (!match || match.key === "custom") {
      setCustomFrom(dateFrom || "");
      setCustomTo(dateTo || "");
    }
  }, [dateFrom, dateTo]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const applyPreset = useCallback((key) => {
    if (key === "custom") {
      setActivePreset("custom");
      return;
    }
    const range = getPresetRange(key);
    setActivePreset(key);
    onChange(range.dateFrom, range.dateTo);
    setOpen(false);
  }, [onChange]);

  const applyCustom = useCallback(() => {
    onChange(customFrom, customTo || customFrom);
    setOpen(false);
  }, [customFrom, customTo, onChange]);

  const handleReset = useCallback(() => {
    setActivePreset(null);
    setCustomFrom("");
    setCustomTo("");
    onReset();
    setOpen(false);
  }, [onReset]);

  const displayLabel = activePreset
    ? (PRESETS.find((p) => p.key === activePreset)?.label || `${dateFrom || "?"} — ${dateTo || "?"}`)
    : "Select dates";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-all
          ${activePreset ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
      >
        <Calendar size={15} />
        <span className="max-w-[120px] truncate">{displayLabel}</span>
        {activePreset && (
          <span
            onClick={(e) => { e.stopPropagation(); handleReset(); }}
            className="ml-1 rounded p-0.5 text-slate-400 hover:bg-blue-100 hover:text-slate-600"
          >
            <X size={14} />
          </span>
        )}
        {!activePreset && <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 min-w-[280px] origin-top-right animate-fade-in rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="space-y-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors
                  ${activePreset === p.key ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {activePreset === "custom" && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm"
                  />
                </div>
                <span className="mt-5 text-slate-400">—</span>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={applyCustom}
                  disabled={!customFrom}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
