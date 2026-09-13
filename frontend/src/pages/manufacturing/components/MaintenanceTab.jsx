import { useState, useMemo } from "react";
import { useMaintenance, useCreateMaintenance, useCompleteMaintenance, useMachines } from "../hooks/useManufacturingApi";
import { useMfgListData } from "./useMfgListData";
import { EmptyState } from "./EmptyState";
import { Wrench, Calendar, Clock, DollarSign, Plus, X, Check, Clipboard, Settings } from "lucide-react";

export function MaintenanceTab() {
  const maintenanceQuery = useMaintenance();
  const machinesQuery = useMachines();
  const createMaintenanceMutation = useCreateMaintenance();
  const completeMaintenanceMutation = useCompleteMaintenance();

  const { list: maintenance, isEmpty: isMaintenanceEmpty } = useMfgListData(maintenanceQuery);
  const { list: machines } = useMfgListData(machinesQuery);

  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Maintenance State
  const [newMaint, setNewMaint] = useState({
    machineId: "",
    task: "",
    type: "PREVENTIVE",
    scheduledDate: new Date().toISOString().split("T")[0],
    owner: "",
    cost: 0,
    notes: "",
  });

  // Split upcoming vs completed history
  const upcomingMaintenance = useMemo(() => {
    return maintenance.filter((m) => m.status !== "COMPLETED");
  }, [maintenance]);

  const completedMaintenance = useMemo(() => {
    return maintenance.filter((m) => m.status === "COMPLETED");
  }, [maintenance]);

  // Aggregate expenditure
  const stats = useMemo(() => {
    const totalCost = maintenance.reduce((sum, m) => sum + (m.costPaise ? m.costPaise / 100 : (m.cost || 0)), 0);
    const pendingCount = upcomingMaintenance.length;
    const completedCount = completedMaintenance.length;
    return {
      totalCost: `₹${(totalCost / 1000).toFixed(1)}k`,
      pendingCount,
      completedCount,
    };
  }, [maintenance, upcomingMaintenance, completedMaintenance]);

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newMaint.machineId) {
      alert("Please select a machine");
      return;
    }
    createMaintenanceMutation.mutate({
      machineId: newMaint.machineId,
      taskType: newMaint.type,
      description: newMaint.task,
      scheduledDate: newMaint.scheduledDate,
      assignedTo: newMaint.owner,
      costEstimate: Number(newMaint.cost || 0),
      notes: newMaint.notes,
    }, {
      onSuccess: () => {
        setShowCreateModal(false);
        setNewMaint({
          machineId: "",
          task: "",
          type: "PREVENTIVE",
          scheduledDate: new Date().toISOString().split("T")[0],
          owner: "",
          cost: 0,
          notes: "",
        });
      }
    });
  };

  const handleComplete = (id) => {
    const actualCost = prompt("Enter settled cost (INR):", "0");
    if (actualCost !== null) {
      completeMaintenanceMutation.mutate({
        id,
        actualCost: Number(actualCost) || 0,
      });
    }
  };

  if (isMaintenanceEmpty) {
    return (
      <div className="space-y-4">
        <EmptyState title="No maintenance tasks" subtitle="Schedule maintenance tasks for machines to track upkeep and repairs." />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Stat Cards */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scheduled PM Tasks</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{stats.pendingCount}</p>
          <p className="mt-1 text-xs text-slate-500">Awaiting technician release</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Completed Audits (This Month)</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{stats.completedCount}</p>
          <p className="mt-1 text-xs text-slate-500">Signed-off by Shift Lead</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Maintenance Spend (WIP)</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{stats.totalCost}</p>
          <p className="mt-1 text-xs text-slate-500">Spare parts & technician costs</p>
        </div>
      </section>

      {/* Main Layout: Upcoming Tasks + Visual Calendar */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Upcoming Maintenance Table */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-950 flex items-center gap-1.5">
                  <Wrench size={18} className="text-blue-600" />
                  Upcoming Maintenance Tasks
                </h3>
                <p className="text-xs text-slate-500">Scheduled tooling downtime for preventative maintenance calibrations</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-900 shadow-sm"
              >
                <Plus size={14} />
                Schedule PM
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2">Tool Code</th>
                    <th className="px-3 py-2">Maintenance Task</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Scheduled</th>
                    <th className="px-3 py-2">Assigned Tech</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {upcomingMaintenance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                        No upcoming maintenance tasks scheduled.
                      </td>
                    </tr>
                  ) : (
                    upcomingMaintenance.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-3 font-bold text-slate-900">{m.machine?.machineCode || m.machineId}</td>
                        <td className="px-3 py-3 font-semibold text-slate-800">
                          <div>
                            <p>{m.description || m.task}</p>
                            {m.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">{m.notes}</p>}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-bold">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] ${
                            (m.taskType || m.type) === "PREVENTIVE" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"
                          }`}>
                            {m.taskType || m.type}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-600 tabular-nums">{m.scheduledDate ? new Date(m.scheduledDate).toISOString().split("T")[0] : "—"}</td>
                        <td className="px-3 py-3 font-medium">{m.assignedTo || m.owner || "—"}</td>
                        <td className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums">₹{((m.costPaise ? m.costPaise / 100 : m.cost) || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleComplete(m.id)}
                            className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-[9px] font-bold hover:bg-emerald-100 transition"
                          >
                            <Check size={11} />
                            Complete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Maintenance visual timeline widget */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950 flex items-center gap-1.5">
              <Calendar size={18} className="text-blue-600" />
              PM Calendar
            </h3>
            <p className="text-xs text-slate-500">Upcoming tasks schedule</p>

            <div className="mt-4 space-y-2.5">
              {upcomingMaintenance.slice(0, 5).map((m, idx) => (
                <div key={m.id || idx} className="flex gap-3 items-center text-xs p-2 rounded-xl border border-slate-100 bg-slate-50/50">
                  <span className="font-bold text-slate-400 w-16 shrink-0">{m.scheduledDate ? new Date(m.scheduledDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "—"}</span>
                  <p className="flex-1 truncate font-semibold text-slate-700">{m.description || m.task}</p>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${m.status === "COMPLETED" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                </div>
              ))}
              {upcomingMaintenance.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No maintenance scheduled
                </div>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal mt-4">
            Downtime is coordinated with production scheduling to minimize WIP buffer gaps.
          </p>
        </div>

      </div>

      {/* Machine Audit Log History */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <h3 className="text-base font-semibold text-slate-950 flex items-center gap-1.5 mb-3">
          <Clipboard size={18} className="text-slate-500" />
          Maintenance History Log
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2">Record ID</th>
                <th className="px-3 py-2">Tool Name</th>
                <th className="px-3 py-2">Task Performed</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Tech Owner</th>
                <th className="px-3 py-2 text-right">Settled Cost</th>
                <th className="px-3 py-2">Completion Date</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {completedMaintenance.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                    No completed maintenance tasks recorded.
                  </td>
                </tr>
              ) : (
                completedMaintenance.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-3.5 font-bold text-slate-900">{m.taskNumber || m.id}</td>
                    <td className="px-3 py-3.5 font-semibold text-slate-800">{m.machine?.name || m.machineName || m.machineId}</td>
                    <td className="px-3 py-3.5 font-semibold">{m.description || m.task}</td>
                    <td className="px-3 py-3.5 font-bold">
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px]">
                        {m.taskType || m.type}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 font-medium">{m.assignedTo || m.owner || "—"}</td>
                    <td className="px-3 py-3.5 text-right font-bold text-slate-900 tabular-nums">₹{((m.costPaise ? m.costPaise / 100 : m.cost) || 0).toLocaleString()}</td>
                    <td className="px-3 py-3.5 text-slate-500 font-semibold tabular-nums">{m.completedDate ? new Date(m.completedDate).toISOString().split("T")[0] : "—"}</td>
                    <td className="px-3 py-3.5 text-center">
                      <span className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                        COMPLETED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SCHEDULE MAINTENANCE MODAL DIALOG */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Schedule Tool Maintenance</h3>
                <p className="text-xs text-slate-500">Initiate preventive/corrective technician release</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Machine Tool</label>
                  <select
                    value={newMaint.machineId}
                    required
                    onChange={(e) => setNewMaint({ ...newMaint, machineId: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="">Select machine...</option>
                    {machines.map((mac) => (
                      <option key={mac.id} value={mac.id}>{mac.machineCode || mac.id} · {mac.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Maintenance Type</label>
                  <select
                    value={newMaint.type}
                    onChange={(e) => setNewMaint({ ...newMaint, type: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="PREVENTIVE">PREVENTIVE (Routine check)</option>
                    <option value="CORRECTIVE">CORRECTIVE (Breakdown repair)</option>
                    <option value="PREDICTIVE">PREDICTIVE (Condition-based)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">PM Task description</label>
                <input
                  type="text"
                  required
                  value={newMaint.task}
                  onChange={(e) => setNewMaint({ ...newMaint, task: e.target.value })}
                  placeholder="e.g. Slurry feed replacement or pump oil flush"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Target Scheduled Date</label>
                  <input
                    type="date"
                    required
                    value={newMaint.scheduledDate}
                    onChange={(e) => setNewMaint({ ...newMaint, scheduledDate: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Technician Release</label>
                  <input
                    type="text"
                    value={newMaint.owner}
                    onChange={(e) => setNewMaint({ ...newMaint, owner: e.target.value })}
                    placeholder="Assigned tech name"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Budget Cost (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={newMaint.cost}
                    onChange={(e) => setNewMaint({ ...newMaint, cost: parseInt(e.target.value) || 0 })}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Diagnostic Notes</label>
                <textarea
                  value={newMaint.notes}
                  onChange={(e) => setNewMaint({ ...newMaint, notes: e.target.value })}
                  placeholder="Record gas line leaks, pressure fluctuations, or calibration parameters..."
                  className="w-full min-h-[70px] rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMaintenanceMutation.isPending}
                  className="h-10 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {createMaintenanceMutation.isPending ? "Scheduling..." : "Schedule Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
