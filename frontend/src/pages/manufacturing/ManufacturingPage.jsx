import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ClipboardList, Layers, Cpu, Package, CheckSquare, Wrench, BarChart3, Sparkles, Home, Search, ChevronRight, Terminal, X } from "lucide-react";
import { manufacturingApi } from "../../services/api";
import { useManufacturingDashboard } from "./hooks/useManufacturingApi";
import { formatRupees } from "../../utils/money";

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
      <div className="h-44 animate-pulse rounded-3xl bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200 xl:col-span-2" />
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200" />
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

  // Keyboard shortcut Cmd+K or Ctrl+K for command palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const isCmdK = (isMac && e.metaKey && e.key === "k") || (!isMac && e.ctrlKey && e.key === "k");
      if (isCmdK) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      
      {/* 1. PROFESSIONAL WORKSPACE HEADER */}
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 transition hover:border-slate-350">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Apps</span>
              <ChevronRight size={10} />
              <span className="cursor-pointer hover:text-slate-600 transition" onClick={() => setActiveTab("Dashboard")}>Manufacturing</span>
              <ChevronRight size={10} />
              <span className="text-slate-900">{TABS.find((t) => t.id === activeTab)?.label}</span>
            </nav>
            
            <div className="mt-3.5 flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-150 bg-blue-50/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
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

            <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
              Manufacturing Wafer Fab
            </h1>
            <p className="mt-1.5 max-w-2xl text-xs sm:text-sm text-slate-500 leading-normal">
              Manage silicon substrate dicing, photolithography stepping alignment, DRIE deep etching parameters, material coverage safety, and prober calibration records.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            
            {/* Cmd+K Quick Search Toggle */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100 px-4 text-xs font-semibold text-slate-500 hover:text-slate-700 transition shadow-sm"
            >
              <Search size={14} />
              Search Actions...
              <span className="text-[10px] font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm hidden sm:inline ml-1">
                ⌘K
              </span>
            </button>
            
          </div>
        </div>

        {/* 2. TAB WORKSPACE SELECTIONS */}
        <div className="mt-6 overflow-x-auto border-t border-slate-100 pt-4 scrollbar-thin">
          <div className="flex min-w-max gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 h-9 rounded-xl px-4 text-xs font-bold transition select-none ${
                    isSelected
                      ? "bg-slate-950 text-white shadow-sm"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200"
                  }`}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* 3. ACTIVE TAB PANEL CONTENT */}
      <main className="min-w-0 transition-all duration-200">
        <ActiveComponent />
      </main>

      {/* 4. CMD+K COMMAND PALETTE DIALOG MODAL */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm pt-[10vh] px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-scale-up">
            
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