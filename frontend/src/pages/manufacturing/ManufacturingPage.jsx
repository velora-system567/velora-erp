import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ClipboardList, Layers, Cpu, Package, CheckSquare, Wrench, BarChart3, Sparkles, Home, Search, ChevronRight, Terminal, X } from "lucide-react";
import { manufacturingApi } from "../../services/api";
import { useManufacturingDashboard } from "./hooks/useManufacturingApi";
import { formatRupees } from "../../utils/money";
import { useModuleShortcuts } from "../../hooks/useShortcutManager";

// Tab Imports
import { DashboardTab } from "./components/DashboardTab";
import { ProductionOrdersTab } from "./components/ProductionOrdersTab";
import { BomTab } from "./components/BomTab";
import { WorkOrdersTab } from "./components/WorkOrdersTab";
import { MachinesTab } from "./components/MachinesTab";
import { InventoryTab } from "./components/InventoryTab";
import { QualityTab } from "./components/QualityTab";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { AnalyticsTab } from "./components/AnalyticsTab";

const TABS = [
  { id: "Dashboard", label: "Dashboard", icon: Home, component: DashboardTab },
  { id: "Orders", label: "Production Orders", icon: ClipboardList, component: ProductionOrdersTab },
  { id: "BOM", label: "Bill of Materials (BOM)", icon: Layers, component: BomTab },
  { id: "WorkOrders", label: "Work Orders", icon: CheckSquare, component: WorkOrdersTab },
  { id: "Machines", label: "Machines", icon: Cpu, component: MachinesTab },
  { id: "Inventory", label: "Inventory Consumption", icon: Package, component: InventoryTab },
  { id: "Quality", label: "Quality Control", icon: Activity, component: QualityTab },
  { id: "Maintenance", label: "Maintenance", icon: Wrench, component: MaintenanceTab },
  { id: "Analytics", label: "Analytics Reports", icon: BarChart3, component: AnalyticsTab },
];

function ManufacturingSkeleton() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-4 sm:px-6 md:py-6 xl:p-8">
      <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200 xl:col-span-2" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

export function ManufacturingPage() {
  // Real API access check — replaces mock module gate
  const accessQuery = useQuery({
    queryKey: ["module-access", "MANUFACTURING"],
    queryFn: () => manufacturingApi.access(),
    retry: 1,
  });

  // Live dashboard KPIs from backend
  const dashboardQuery = useManufacturingDashboard();

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  // Register module shortcuts for manufacturing command palette
  useModuleShortcuts("manufacturing", [
    {
      id: "manufacturing:command-palette",
      label: "Open Command Palette",
      keys: { ctrl: true, shift: true, key: "K" },
      category: "Manufacturing",
      handler: () => setCommandPaletteOpen((prev) => !prev),
    },
  ]);

  // Filter commands for palette
  const commands = [
    { label: "Switch to Dashboard", action: () => setActiveTab("Dashboard") },
    { label: "View Production Orders", action: () => setActiveTab("Orders") },
    { label: "Browse Bill of Materials (BOM)", action: () => setActiveTab("BOM") },
    { label: "Open Kanban Work Orders", action: () => setActiveTab("WorkOrders") },
    { label: "Check Machine Status", action: () => setActiveTab("Machines") },
    { label: "Inspect Inventory Stocks", action: () => setActiveTab("Inventory") },
    { label: "Open Quality Control Records", action: () => setActiveTab("Quality") },
    { label: "Schedule Tool Maintenance", action: () => setActiveTab("Maintenance") },
    { label: "Generate Analytics Reports", action: () => setActiveTab("Analytics") },
  ];

  const filteredCommands = useMemo(() => {
    if (commandQuery.trim() === "") return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(commandQuery.toLowerCase()));
  }, [commandQuery]);

  if (accessQuery.error || accessQuery.data?.data?.locked) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-lg font-semibold text-slate-950">Manufacturing module not available</p>
        <p className="mt-2 text-sm text-slate-600">Connect your backend API to enable manufacturing features.</p>
      </div>
    );
  }

  if (accessQuery.isPending) {
    return <ManufacturingSkeleton />;
  }

  // Active Tab component helper
  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component || DashboardTab;

  return (
    <div className="mx-auto max-w-[1550px] space-y-5 px-4 py-4 sm:px-6 md:py-6 xl:p-8">
      
      {/* 1. HEADER — matches the standard PageHeader styling across the ERP */}
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Apps</span>
              <ChevronRight size={10} />
              <span className="cursor-pointer transition hover:text-slate-600" onClick={() => setActiveTab("Dashboard")}>Manufacturing</span>
              <ChevronRight size={10} />
              <span className="text-slate-900">{TABS.find((t) => t.id === activeTab)?.label}</span>
            </nav>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                <Sparkles size={11} />
                Flagship Suite
              </div>
              {dashboardQuery.data?.data && (
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Active Orders", dashboardQuery.data.data.activeOrders],
                    ["Delayed", dashboardQuery.data.data.delayedOrders],
                    ["PM Due", dashboardQuery.data.data.pendingMaintenance],
                  ].map(([label, val]) => (
                    <span key={label} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                      {label}: <span className="text-slate-950">{val}</span>
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    Pass Rate: {dashboardQuery.data.data.overallPassRatePct}%
                  </span>
                </div>
              )}
            </div>

            <h1 className="mt-2 text-2xl font-semibold leading-tight text-slate-950">
              Manufacturing Wafer Fab
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Manage silicon substrate dicing, photolithography stepping alignment, DRIE deep etching parameters, material coverage safety, and prober calibration records.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/* Ctrl+Shift+K Quick Search Toggle */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Search size={14} />
              Search Actions...
              <span className="text-[10px] font-bold bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded hidden sm:inline ml-1">
                ⌘⇧K
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. TAB WORKSPACE SELECTIONS — standard blue tab bar */}
      <div className="flex gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. ACTIVE TAB PANEL CONTENT */}
      <main className="min-w-0 transition-all duration-200">
        {activeTab === "Dashboard" ? <DashboardTab onJump={setActiveTab} /> : <ActiveComponent />}
      </main>

      {/* 4. CMD+K COMMAND PALETTE DIALOG MODAL */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm pt-[10vh] px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Input field */}
            <div className="relative border-b border-slate-150 p-4">
              <Terminal size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                placeholder="Search commands (e.g. Switch to BOM, view machines)..."
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                className="h-10 w-full pl-9 pr-8 text-xs text-slate-900 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              />
              <button
                onClick={() => {
                  setCommandPaletteOpen(false);
                  setCommandQuery("");
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-lg"
              >
                <X size={14} />
              </button>
            </div>

            {/* List options */}
            <div className="p-2.5 max-h-[250px] overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-2.5 mb-2">Available Actions</p>
              
              <div className="space-y-1">
                {filteredCommands.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 italic">
                    No commands found matching "{commandQuery}"
                  </div>
                ) : (
                  filteredCommands.map((cmd, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        cmd.action();
                        setCommandPaletteOpen(false);
                        setCommandQuery("");
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-950 hover:text-white transition flex items-center justify-between"
                    >
                      <span>{cmd.label}</span>
                      <span className="text-[10px] font-bold opacity-60">↵ Launch</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Command Palette Footnotes */}
            <div className="bg-slate-50 px-4 py-2 border-t border-slate-150 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
              <span>Press ESC to exit</span>
              <span>Velora Command Center v1.2</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}