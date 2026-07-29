/**
 * BulkActions — Floating bar with bulk action buttons.
 * Appears when rows are selected.
 */
import { CheckCircle2, X, Download, Printer, Trash2, FileText, DollarSign, User } from "lucide-react";

const ACTIONS = [
  { key: "approve", label: "Approve", icon: CheckCircle2, tone: "emerald" },
  { key: "generateInvoice", label: "Generate Invoice", icon: FileText, tone: "blue" },
  { key: "generateReceipt", label: "Generate Receipt", icon: DollarSign, tone: "blue" },
  { key: "assignSalesperson", label: "Assign Person", icon: User, tone: "purple" },
  { key: "export", label: "Export", icon: Download, tone: "slate" },
  { key: "print", label: "Print", icon: Printer, tone: "slate" },
  { key: "delete", label: "Delete", icon: Trash2, tone: "rose" },
];

export default function BulkActions({ selectedCount, onAction, onClear }) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-4 z-30 mx-auto flex w-fit animate-slide-up items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <span className="mr-1 text-sm font-semibold text-blue-700">{selectedCount} selected</span>
      <div className="flex items-center gap-1">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const toneClasses = {
            emerald: "text-emerald-700 hover:bg-emerald-50 border-emerald-200",
            blue: "text-blue-700 hover:bg-blue-50 border-blue-200",
            purple: "text-purple-700 hover:bg-purple-50 border-purple-200",
            slate: "text-slate-600 hover:bg-slate-50 border-slate-200",
            rose: "text-rose-700 hover:bg-rose-50 border-rose-200",
          };
          return (
            <button
              key={action.key}
              onClick={() => onAction(action.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${toneClasses[action.tone] || toneClasses.slate}`}
              title={action.label}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onClear}
        className="ml-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        title="Clear selection"
      >
        <X size={16} />
      </button>
    </div>
  );
}
