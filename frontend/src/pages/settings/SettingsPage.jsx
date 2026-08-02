import { Activity, Building2, MapPin, Settings, Users, Keyboard } from "lucide-react";
import { Link } from "react-router-dom";
import { useShortcutStore } from "../../hooks/useShortcutManager";

const cards = [
  {
    to: "/company",
    label: "Company Profile",
    description: "Business name, GSTIN, PAN, address, and legal details.",
    icon: Building2,
    color: "blue",
  },
  {
    to: "/branches",
    label: "Branches",
    description: "Manage multiple locations, godowns, and branch operations.",
    icon: MapPin,
    color: "purple",
  },
  {
    to: "/users",
    label: "Users & Roles",
    description: "Add users, assign roles, and manage system access.",
    icon: Users,
    color: "emerald",
  },
  {
    to: "/hrms",
    label: "People & HR",
    description: "Employees, departments, attendance, and payroll records.",
    icon: Users,
    color: "amber",
  },
  {
    to: "/activity",
    label: "Audit Log",
    description: "Track every create, update, delete, and approval action.",
    icon: Activity,
    color: "slate",
  },
];

function SettingsCard({ to, label, description, icon: Icon, color }) {
  const colors = {
    blue: "border-blue-200 hover:border-blue-300 bg-blue-50/30",
    purple: "border-purple-200 hover:border-purple-300 bg-purple-50/30",
    emerald: "border-emerald-200 hover:border-emerald-300 bg-emerald-50/30",
    amber: "border-amber-200 hover:border-amber-300 bg-amber-50/30",
    slate: "border-slate-200 hover:border-slate-300 bg-slate-50/30",
    indigo: "border-indigo-200 hover:border-indigo-300 bg-indigo-50/30",
  };
  const iconColors = {
    blue: "text-blue-600 bg-blue-100",
    purple: "text-purple-600 bg-purple-100",
    emerald: "text-emerald-600 bg-emerald-100",
    amber: "text-amber-600 bg-amber-100",
    slate: "text-slate-600 bg-slate-100",
    indigo: "text-indigo-600 bg-indigo-100",
  };

  return (
    <Link
      to={to}
      className={`group flex items-start gap-4 rounded-2xl border p-5 shadow-sm transition ${colors[color]} hover:shadow-md`}
    >
      <div
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${iconColors[color]}`}
      >
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold text-slate-950 group-hover:text-blue-700 transition">
          {label}
        </p>
        <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
      </div>
    </Link>
  );
}

function KeyboardShortcutsCard() {
  const enabled = useShortcutStore((s) => s.enabled);
  const setEnabled = useShortcutStore((s) => s.setEnabled);
  const setDialogOpen = useShortcutStore((s) => s.setDialogOpen);

  return (
    <div className="group flex items-start gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
        <Keyboard size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-slate-950">
              Keyboard Shortcuts
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Enable keyboard shortcuts, view available keys, and customize
              your workflow.
            </p>
          </div>
          <label
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center"
            title={enabled ? "Disable shortcuts" : "Enable shortcuts"}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />
          </label>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:shadow-sm"
        >
          <Keyboard size={15} />
          View Shortcuts
        </button>
        <span className="ml-3 text-xs text-slate-400">
          Press{" "}
          <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[10px]">
            Ctrl + /
          </kbd>{" "}
          anytime
        </span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-4 sm:px-6 md:py-6 xl:p-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">
              Settings & Administration
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Manage your company profile, branch locations, user accounts,
              employee records, keyboard shortcuts, and audit logs — all in one
              place.
            </p>
          </div>
          <Settings
            className="hidden shrink-0 text-slate-400 sm:block"
            size={24}
          />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <SettingsCard key={card.to} {...card} />
        ))}
        {/* Keyboard Shortcuts takes full width on its row */}
        <div className="sm:col-span-2">
          <KeyboardShortcutsCard />
        </div>
      </div>
    </div>
  );
}
