import { Activity, Building2, MapPin, Settings, Users, Keyboard, Shield, Warehouse } from "lucide-react";
import { Link } from "react-router-dom";
import { useShortcutStore } from "../../hooks/useShortcutManager";
import { PageHeader } from "../../components/PageHeader";

const cards = [
  { to: "/company", label: "Company Profile", description: "Business name, GSTIN, PAN, address, and legal details.", icon: Building2, color: "blue" },
  { to: "/branches", label: "Branches", description: "Manage multiple locations, godowns, and branch operations.", icon: MapPin, color: "purple" },
  { to: "/users", label: "Users & Roles", description: "Add users, assign roles, and manage system access.", icon: Users, color: "emerald" },
  { to: "/hrms", label: "People & HR", description: "Employees, departments, attendance, and payroll records.", icon: Users, color: "amber" },
  { to: "/activity", label: "Audit Log", description: "Track every create, update, delete, and approval action.", icon: Activity, color: "slate" },
  { to: "/wms", label: "Warehouses", description: "Manage warehouse locations, bins, and stock movements.", icon: Warehouse, color: "indigo" },
  { to: "/settings/security", label: "Security & Sign-in", description: "Two-factor authentication, Google sign-in, sessions, and security settings.", icon: Shield, color: "rose" },
];

const COLORS = {
  blue: "border-blue-200/80 hover:border-blue-300 hover:bg-blue-50/40",
  purple: "border-purple-200/80 hover:border-purple-300 hover:bg-purple-50/40",
  emerald: "border-emerald-200/80 hover:border-emerald-300 hover:bg-emerald-50/40",
  amber: "border-amber-200/80 hover:border-amber-300 hover:bg-amber-50/40",
  slate: "border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/40",
  indigo: "border-indigo-200/80 hover:border-indigo-300 hover:bg-indigo-50/40",
  rose: "border-rose-200/80 hover:border-rose-300 hover:bg-rose-50/40",
};

const ICON_COLORS = {
  blue: "text-blue-600 bg-blue-100",
  purple: "text-purple-600 bg-purple-100",
  emerald: "text-emerald-600 bg-emerald-100",
  amber: "text-amber-600 bg-amber-100",
  slate: "text-slate-600 bg-slate-100",
  indigo: "text-indigo-600 bg-indigo-100",
  rose: "text-rose-600 bg-rose-100",
};

function SettingsCard({ to, label, description, icon: Icon, color }) {
  return (
    <Link to={to}
      className={`group flex items-start gap-4 rounded-2xl border bg-white p-5 shadow-xs transition-all duration-200 hover:shadow-md ${COLORS[color]}`}>
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${ICON_COLORS[color]} transition-transform duration-150 group-hover:scale-105`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-slate-900 group-hover:text-blue-700 transition-colors duration-150">{label}</p>
        <p className="mt-0.5 text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </Link>
  );
}

function KeyboardShortcutsCard() {
  const enabled = useShortcutStore((s) => s.enabled);
  const setEnabled = useShortcutStore((s) => s.setEnabled);
  const setDialogOpen = useShortcutStore((s) => s.setDialogOpen);

  return (
    <div className="rounded-2xl border border-indigo-200/80 bg-white p-5 shadow-xs">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
          <Keyboard size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold text-slate-900">Keyboard Shortcuts</p>
              <p className="mt-0.5 text-sm leading-5 text-slate-500">Enable keyboard shortcuts for faster navigation and actions.</p>
            </div>
            <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center" title={enabled ? "Disable shortcuts" : "Enable shortcuts"}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="peer sr-only" />
              <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors duration-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => setDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 hover:shadow-sm">
              <Keyboard size={15} /> View Shortcuts
            </button>
            <span className="text-xs text-slate-400">
              Press <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium">Ctrl+/</kbd> anytime
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 sm:px-6 md:space-y-5 md:py-6 xl:p-8">
      <PageHeader
        title="Settings & Administration"
        description="Manage your company profile, branches, users, HR, warehouses, and audit logs."
        actions={<Settings size={20} className="text-slate-400" />}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <SettingsCard key={card.to} {...card} />
        ))}
      </div>

      <KeyboardShortcutsCard />
    </div>
  );
}
