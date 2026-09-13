import { useState } from "react";
import { useMachines, useUpdateMachineStatus, useCreateMaintenance } from "../hooks/useManufacturingApi";
import { useMfgListData } from "./useMfgListData";
import { EmptyState } from "./EmptyState";
import { Cpu, Power, Calendar, Wrench, ShieldAlert, TrendingUp, RefreshCw, Activity, ArrowRight, CheckCircle, X } from "lucide-react";
import { TonedDot } from "./TonedDot";

const STATUS_THEMES = {
  RUNNING: {
    bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
    dot: "bg-emerald-500",
    icon: Activity,
  },
  IDLE: {
    bg: "bg-blue-50 border-blue-200 text-blue-700",
    dot: "bg-blue-500",
    icon: Power,
  },
  MAINTENANCE: {
    bg: "bg-amber-50 border-amber-200 text-amber-700",
    dot: "bg-amber-500",
    icon: Wrench,
  },
  BREAKDOWN: {
    bg: "bg-rose-50 border-rose-200 text-rose-700",
    dot: "bg-rose-500",
    icon: ShieldAlert,
  },
};

export function MachinesTab() {
  const machinesQuery = useMachines();
  const { list: machines, isEmpty: isMachinesEmpty } = useMfgListData(machinesQuery);

  const updateMachineStatusMutation = useUpdateMachineStatus();
  const createMaintenanceMutation = useCreateMaintenance();
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [showStatusPanel, setShowStatusPanel] = useState(false);

  const handleStateChange = (id, newStatus) => {
    updateMachineStatusMutation.mutate({ id, status: newStatus });
    setShowStatusPanel(false);
  };

  const handleTriggerMaintenance = (machine) => {
    if (!machine) return;
    if (confirm(`Do you want to log immediate Corrective Maintenance for ${machine.name}?`)) {
      createMaintenanceMutation.mutate({
        machineId: machine.id,
        machineName: machine.name,
        task: "Emergency technician inspection and diagnostic reset",
        type: "CORRECTIVE",
        owner: "Siddharth Patil",
        scheduledDate: new Date().toISOString().split("T")[0],
        cost: 15000,
        notes: "Tool flagged down. Calibration required.",
      });
      updateMachineStatusMutation.mutate({ id: machine.id, status: "MAINTENANCE" });
    }
  };

  if (isMachinesEmpty) {
    return (
      <div className="space-y-4">
        <EmptyState title="No machines" subtitle="Machines list will appear once backend data is connected." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-header Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-slate-950 flex items-center gap-2">
            <Cpu size={18} className="text-blue-600" />
            Machine Status & Utilization Monitor
          </h3>
          <p className="text-xs text-slate-500">Track physical shop floor lines, tooling programs, health degradation parameters, and operating hours</p>
        </div>
        <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
          {["RUNNING", "IDLE", "MAINTENANCE", "BREAKDOWN"].map((status) => {
            const count = machines.filter((m) => m.status === status).length;
            if (count === 0) return null;
            const tone = status === "RUNNING" ? "positive" : status === "MAINTENANCE" ? "warning" : status === "BREAKDOWN" ? "negative" : "info";
            return (
              <span key={status} className="flex items-center gap-1">
                <TonedDot tone={tone} /> {count} {status.charAt(0) + status.slice(1).toLowerCase()}
              </span>
            );
          })}
        </div>
      </div>

      {/* Machine Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {machines.map((m) => {
          const theme = STATUS_THEMES[m.status] || STATUS_THEMES.IDLE;
          const HealthIcon = theme.icon;
          return (
            <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between relative overflow-hidden">
              
              {/* Header */}
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{m.machineCode} · {m.type}</span>
                    <h4 className="mt-1 text-sm font-bold text-slate-950 truncate leading-tight">{m.name}</h4>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedMachine(m);
                      setShowStatusPanel(true);
                    }}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase transition hover:opacity-85 ${theme.bg}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
                    {m.status}
                  </button>
                </div>

                <div className="mt-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Active Program:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[130px]" title={m.currentProgram}>
                      {m.currentProgram || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Operating Hours:</span>
                    <span className="font-bold text-slate-900 tabular-nums">{Number(m.operatingHours || 0).toLocaleString()} hrs</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Health Indicator:</span>
                    <span className={`font-bold tabular-nums ${
                      (m.healthScore ?? 100) >= 90 ? "text-emerald-600" :
                      (m.healthScore ?? 100) >= 75 ? "text-amber-600" : "text-rose-600"
                    }`}>
                      {m.healthScore ?? 100}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Maintenance Due:</span>
                    <span className="font-semibold text-slate-600 tabular-nums">{m.maintenanceDue ? new Date(m.maintenanceDue).toISOString().split("T")[0] : "—"}</span>
                  </div>
                </div>
              </div>

              {/* Utilization progress bar and quick actions */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 space-y-3.5">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    <span>Tool Utilization</span>
                    <span className="text-slate-700">{m.utilizationPct ?? 0}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full ${
                        m.status === "RUNNING" ? "bg-emerald-500" :
                        m.status === "MAINTENANCE" ? "bg-amber-500" :
                        m.status === "BREAKDOWN" ? "bg-rose-500" : "bg-slate-400"
                      }`}
                      style={{ width: `${m.utilizationPct ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedMachine(m);
                      setShowStatusPanel(true);
                    }}
                    className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-700 text-center transition"
                  >
                    Change State
                  </button>
                  <button
                    onClick={() => handleTriggerMaintenance(m)}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-[10px] font-bold text-white text-center transition"
                  >
                    Schedule PM
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* QUICK STATUS TOGGLE SHEET DIALOG */}
      {showStatusPanel && selectedMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-950">Change Machine State</h3>
                <p className="text-xs text-slate-500">{selectedMachine.id} · {selectedMachine.name}</p>
              </div>
              <button
                onClick={() => setShowStatusPanel(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Select New Status</p>
              {[
                { key: "RUNNING", label: "RUNNING (Active Production)", desc: "Tool is online and running active lots recipes" },
                { key: "IDLE", label: "IDLE (Standby Wait)", desc: "Tool is powered but waiting for next lot recipe feed" },
                { key: "MAINTENANCE", label: "MAINTENANCE (Preventive/Calibration)", desc: "Tool is offline for calibration, seasoning, or parts replacement" },
                { key: "BREAKDOWN", label: "BREAKDOWN (Critical Outage)", desc: "Tool has suffered a hardware trip. Emergency maintenance requested" },
              ].map((st) => {
                const isActive = selectedMachine.status === st.key;
                return (
                  <button
                    key={st.key}
                    onClick={() => handleStateChange(selectedMachine.id, st.key)}
                    className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-2.5 ${
                      isActive
                        ? "border-slate-900 bg-slate-50 text-slate-950"
                        : "border-slate-200 hover:bg-slate-50/50 text-slate-700"
                    }`}
                  >
                    <div className="mt-1">
                      <TonedDot tone={st.key === "RUNNING" ? "positive" : st.key === "MAINTENANCE" ? "warning" : st.key === "BREAKDOWN" ? "negative" : "info"} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{st.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">{st.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
