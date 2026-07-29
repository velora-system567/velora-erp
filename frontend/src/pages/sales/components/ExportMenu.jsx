/**
 * ExportMenu — Dropdown with Excel/CSV/PDF/Print export options.
 */
import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, Printer, FileJson } from "lucide-react";

export default function ExportMenu({ onExport, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const options = [
    { key: "excel", label: "Excel (.xlsx)", icon: FileSpreadsheet, desc: "Full data with formatting" },
    { key: "csv", label: "CSV (.csv)", icon: FileText, desc: "Comma-separated values" },
    { key: "pdf", label: "PDF", icon: FileJson, desc: "Print-ready report" },
    { key: "print", label: "Print", icon: Printer, desc: "Send to printer" },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        <Download size={15} />
        <span className="hidden sm:inline">Export</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 min-w-[200px] origin-top-right animate-fade-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => { onExport(opt.key); setOpen(false); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50"
              >
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon size={15} />
                </div>
                <div>
                  <p className="font-medium text-slate-700">{opt.label}</p>
                  <p className="text-xs text-slate-400">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
