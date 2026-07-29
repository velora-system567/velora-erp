/**
 * SavedFilters — Save, load, and delete custom filter presets.
 * Persisted in localStorage.
 */
import { useState, useRef, useEffect } from "react";
import { Bookmark, ChevronDown, Plus, X, Trash2 } from "lucide-react";

export default function SavedFilters({ savedFilters, onSave, onLoad, onDelete }) {
  const [open, setOpen] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setShowSave(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (showSave && inputRef.current) inputRef.current.focus();
  }, [showSave]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      setName("");
      setShowSave(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all
          ${savedFilters.length > 0 ? "border-purple-200 bg-purple-50 text-purple-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
      >
        <Bookmark size={13} />
        <span>{savedFilters.length > 0 ? `Filters (${savedFilters.length})` : "Save Filter"}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute left-0 top-9 z-50 min-w-[220px] origin-top-right animate-fade-in rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {/* Save new filter */}
          {showSave ? (
            <div className="mb-2 flex items-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                placeholder="Filter name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="h-8 flex-1 rounded-lg border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-400"
              />
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="inline-flex h-8 items-center rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setShowSave(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSave(true)}
              className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              <Plus size={14} />
              Save Current Filters
            </button>
          )}

          {/* Saved filters list */}
          {savedFilters.length > 0 && (
            <div className="border-t border-slate-100 pt-1">
              <p className="px-3 py-1 text-xs font-medium text-slate-400">Saved</p>
              {savedFilters.map((sf) => (
                <div key={sf.id} className="group flex items-center rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                  <button
                    type="button"
                    onClick={() => { onLoad(sf.id); setOpen(false); }}
                    className="flex-1 text-left text-slate-700"
                  >
                    {sf.name}
                  </button>
                  <button
                    onClick={() => onDelete(sf.id)}
                    className="hidden p-1 text-slate-400 hover:text-rose-600 group-hover:inline-flex"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {savedFilters.length === 0 && !showSave && (
            <p className="px-3 py-3 text-center text-xs text-slate-400">No saved filters yet</p>
          )}
        </div>
      )}
    </div>
  );
}
