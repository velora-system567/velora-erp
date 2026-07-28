import { useState, useMemo } from "react";
import { useManufacturingStore } from "../hooks/useManufacturingStore";
import { Kanban, Table, Calendar, Milestone, Plus, X, ArrowRight, User, Cpu, AlertTriangle, Layers, Clock, ArrowLeftRight } from "lucide-react";

const STAGES = ["Photolithography", "Etch (DRIE)", "Bonding", "Dicing", "Test", "Packaging"];

const STATUS_STYLING = {
  ON_TRACK: "bg-emerald-50 text-emerald-700 border-emerald-100",
  DELAYED: "bg-rose-50 text-rose-700 border-rose-100",
  SHORTAGE: "bg-amber-50 text-amber-700 border-amber-100",
  COMPLETED: "bg-slate-100 text-slate-700 border-slate-200",
};

export function WorkOrdersTab() {
  const { workOrders, addWorkOrder, updateWorkOrderStage, updateWorkOrderStatus } = useManufacturingStore();
  const [subView, setSubView] = useState("kanban"); // kanban, table, calendar, timeline

  // Create Work Order modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWO, setNewWO] = useState({
    product: "MEMS Pressure Sensor - 1.2 bar",
    qtyPlanned: 2000,
    stage: "Photolithography",
    worker: "Rahul Kulkarni",
    machine: "LITH-01 - DUV Stepper",
    priority: "HIGH",
    dueIn: "Today 16:00",
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    addWorkOrder(newWO);
    setShowCreateModal(false);
    setNewWO({
      product: "MEMS Pressure Sensor - 1.2 bar",
      qtyPlanned: 2000,
      stage: "Photolithography",
      worker: "Rahul Kulkarni",
      machine: "LITH-01 - DUV Stepper",
      priority: "HIGH",
      dueIn: "Today 16:00",
    });
  };

  const handleStageMove = (id, direction) => {
    const wo = workOrders.find((w) => w.id === id);
    if (!wo) return;
    const currIndex = STAGES.indexOf(wo.stage);
    if (direction === "next" && currIndex < STAGES.length - 1) {
      updateWorkOrderStage(id, STAGES[currIndex + 1]);
    } else if (direction === "prev" && currIndex > 0) {
      updateWorkOrderStage(id, STAGES[currIndex - 1]);
    }
  };

  // Timeline groups (organized by machines)
  const timelineData = useMemo(() => {
    const machinesGroup = {};
    workOrders.forEach((wo) => {
      const machName = wo.machine.split(" - ")[0];
      if (!machinesGroup[machName]) {
        machinesGroup[machName] = [];
      }
      machinesGroup[machName].push(wo);
    });
    return machinesGroup;
  }, [workOrders]);

  return (
    <div className="space-y-4">
      {/* Sub-bar Navigation for Work Order Views */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 shrink-0">
          {[
            { id: "kanban", label: "Kanban Board", icon: Kanban },
            { id: "table", label: "Data Table", icon: Table },
            { id: "calendar", label: "Shift Calendar", icon: Calendar },
            { id: "timeline", label: "Gantt Timeline", icon: Milestone },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setSubView(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                subView === v.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <v.icon size={13} />
              {v.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-900 shadow-sm"
        >
          <Plus size={14} />
          Create Work Order
        </button>
      </div>

      {/* RENDER VIEW CONTEXTS */}

      {/* 1. KANBAN VIEW */}
      {subView === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1200px]">
            {STAGES.map((stage) => {
              const stageWos = workOrders.filter((w) => w.stage === stage);
              return (
                <div key={stage} className="flex-1 rounded-2xl bg-slate-100/70 border border-slate-200/50 p-3 min-w-[200px]">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2 mb-3">
                    <span className="text-xs font-bold text-slate-800">{stage}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md shadow-sm">
                      {stageWos.length}
                    </span>
                  </div>
                  
                  <div className="space-y-2.5">
                    {stageWos.length === 0 ? (
                      <div className="text-center py-8 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/50">
                        No active lots
                      </div>
                    ) : (
                      stageWos.map((wo) => (
                        <div key={wo.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400">{wo.id}</span>
                            <span className={`text-[9px] font-bold border rounded px-1.5 py-0.2 ${STATUS_STYLING[wo.status]}`}>
                              {wo.status.replace("_", " ")}
                            </span>
                          </div>
                          <h4 className="mt-1.5 text-xs font-bold text-slate-950 truncate">{wo.product}</h4>
                          
                          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px] text-slate-500 font-semibold">
                            <div className="flex items-center gap-1">
                              <User size={10} className="text-slate-400" />
                              <span className="truncate">{wo.worker}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Cpu size={10} className="text-slate-400" />
                              <span className="truncate">{wo.machine.split(" - ")[0]}</span>
                            </div>
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[10px] mb-1 font-semibold text-slate-400">
                              <span>Lot: {wo.qtyCompleted}/{wo.qtyPlanned}</span>
                              <span className="text-slate-700">{wo.progress}%</span>
                            </div>
                            <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full bg-indigo-600" style={{ width: `${wo.progress}%` }} />
                            </div>
                          </div>

                          {/* Shift Stage Buttons */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                            <button
                              disabled={STAGES.indexOf(stage) === 0}
                              onClick={() => handleStageMove(wo.id, "prev")}
                              className="text-[10px] font-bold text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            >
                              ← Back
                            </button>
                            
                            <select
                              value={wo.status}
                              onChange={(e) => updateWorkOrderStatus(wo.id, e.target.value)}
                              className="text-[9px] font-bold text-slate-600 outline-none bg-slate-50 rounded border border-slate-200 px-1 py-0.5 cursor-pointer"
                            >
                              <option value="ON_TRACK">Track</option>
                              <option value="SHORTAGE">Short</option>
                              <option value="DELAYED">Delay</option>
                              <option value="COMPLETED">Done</option>
                            </select>

                            <button
                              disabled={STAGES.indexOf(stage) === STAGES.length - 1}
                              onClick={() => handleStageMove(wo.id, "next")}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-30"
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. DATA TABLE VIEW */}
      {subView === "table" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3.5">Work Order ID</th>
                <th className="px-4 py-3.5">Product Lot</th>
                <th className="px-4 py-3.5">Active Stage</th>
                <th className="px-4 py-3.5">Assigned Operator</th>
                <th className="px-4 py-3.5">Tool Tooling</th>
                <th className="px-4 py-3.5 text-right">Target Volume</th>
                <th className="px-4 py-3.5">Due Date</th>
                <th className="px-4 py-3.5">Dependencies</th>
                <th className="px-4 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {workOrders.map((wo) => (
                <tr key={wo.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-3.5 font-bold text-slate-900">{wo.id}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-800">{wo.product}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                      {wo.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium">{wo.worker}</td>
                  <td className="px-4 py-3.5 font-medium text-slate-500">{wo.machine}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums">{wo.qtyPlanned} dies</td>
                  <td className="px-4 py-3.5 text-slate-600 font-medium">{wo.dueIn}</td>
                  <td className="px-4 py-3.5">
                    {wo.dependencies.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                        <Layers size={10} />
                        {wo.dependencies.join(", ")}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${STATUS_STYLING[wo.status]}`}>
                      {wo.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. CALENDAR VIEW */}
      {subView === "calendar" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h4 className="text-sm font-semibold text-slate-950">Active Lot Calendar (July 2026)</h4>
            <span className="text-xs font-semibold text-slate-500">Weekly Shift View</span>
          </div>

          <div className="grid grid-cols-7 gap-3 text-center border-b border-slate-100 pb-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <div>Mon 12</div>
            <div>Tue 13</div>
            <div className="text-blue-600 bg-blue-50/50 py-1 rounded">Wed 14 (Today)</div>
            <div>Thu 15</div>
            <div>Fri 16</div>
            <div>Sat 17</div>
            <div>Sun 18</div>
          </div>

          <div className="grid grid-cols-7 gap-3 min-h-[300px] text-left">
            {/* Mon 12 */}
            <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-2 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400">12</span>
              {workOrders.filter(w => w.dueIn.includes("Done")).map(w => (
                <div key={w.id} className="bg-slate-200 text-slate-700 border border-slate-300 p-1.5 rounded-lg text-[9px] font-semibold truncate">
                  {w.id} - {w.product}
                </div>
              ))}
            </div>
            {/* Tue 13 */}
            <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-2 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400">13</span>
              {workOrders.filter(w => w.dueIn.includes("Overdue")).map(w => (
                <div key={w.id} className="bg-rose-50 text-rose-700 border border-rose-100 p-1.5 rounded-lg text-[9px] font-semibold truncate">
                  {w.id} - {w.product}
                </div>
              ))}
            </div>
            {/* Wed 14 */}
            <div className="border border-blue-200 rounded-xl bg-blue-50/20 p-2 space-y-1.5">
              <span className="text-[10px] font-bold text-blue-600">14</span>
              {workOrders.filter(w => w.dueIn.includes("Today")).map(w => (
                <div key={w.id} className="bg-indigo-50 text-indigo-700 border border-indigo-100 p-1.5 rounded-lg text-[9px] font-semibold truncate">
                  {w.id} - {w.product}
                </div>
              ))}
            </div>
            {/* Thu 15 */}
            <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-2 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400">15</span>
              {workOrders.filter(w => w.dueIn.includes("Tomorrow")).map(w => (
                <div key={w.id} className="bg-blue-50 text-blue-700 border border-blue-100 p-1.5 rounded-lg text-[9px] font-semibold truncate">
                  {w.id} - {w.product}
                </div>
              ))}
            </div>
            {/* Fri 16 */}
            <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-2 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400">16</span>
              <div className="text-[9px] text-slate-400 italic text-center py-4">No jobs scheduled</div>
            </div>
            {/* Sat 17 */}
            <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-2 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400">17</span>
              <div className="text-[9px] text-slate-400 italic text-center py-4">Weekend maintenance</div>
            </div>
            {/* Sun 18 */}
            <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-2 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400">18</span>
              <div className="text-[9px] text-slate-400 italic text-center py-4">Factory offline</div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TIMELINE VIEW */}
      {subView === "timeline" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h4 className="text-sm font-semibold text-slate-950">Gantt Tool Timeline (July 14)</h4>
            <span className="text-xs text-slate-500">Resource Routing Gantt Chart</span>
          </div>

          <div className="space-y-4">
            {Object.keys(timelineData).map((mach) => (
              <div key={mach} className="grid grid-cols-12 items-center gap-4">
                <div className="col-span-2 font-bold text-xs text-slate-800 uppercase tracking-wider">{mach}</div>
                <div className="col-span-10 h-10 rounded-xl bg-slate-50 border border-slate-100 relative overflow-hidden flex items-center p-1">
                  {timelineData[mach].map((wo, i) => {
                    const widthPct = Math.max(30, Math.min(100, 100 / timelineData[mach].length - 5));
                    return (
                      <div
                        key={wo.id}
                        className={`h-8 rounded-lg flex items-center justify-between px-3 text-[10px] font-bold shadow-sm border truncate ${
                          wo.status === "COMPLETED" ? "bg-slate-200 text-slate-700 border-slate-300" :
                          wo.status === "DELAYED" ? "bg-rose-50 text-rose-700 border-rose-200" :
                          "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}
                        style={{ width: `${widthPct}%` }}
                      >
                        <span className="truncate">{wo.id}: {wo.stage}</span>
                        <span className="text-[8px] font-semibold bg-white/60 px-1 py-0.2 rounded border">
                          {wo.progress}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-3 flex justify-between items-center text-[10px] text-slate-400 font-semibold">
            <span>Left side: Tool Resource IDs</span>
            <span className="flex items-center gap-1.5"><Clock size={11} /> All times scaled to active Shift A duration (8 hours)</span>
          </div>
        </div>
      )}

      {/* CREATE WORK ORDER MODAL DIALOG */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Add Work Order</h3>
                <p className="text-xs text-slate-500">Dispatch a new operational job lot on the floor</p>
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Product</label>
                  <select
                    value={newWO.product}
                    onChange={(e) => setNewWO({ ...newWO, product: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="MEMS Pressure Sensor - 1.2 bar">MEMS Pressure Sensor - 1.2 bar</option>
                    <option value="MEMS Accelerometer - 3-axis">MEMS Accelerometer - 3-axis</option>
                    <option value="MEMS Microphone - Analog">MEMS Microphone - Analog</option>
                    <option value="MEMS Gyroscope - Industrial">MEMS Gyroscope - Industrial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Volume (Qty)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newWO.qtyPlanned}
                    onChange={(e) => setNewWO({ ...newWO, qtyPlanned: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 2400"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Target Stage</label>
                  <select
                    value={newWO.stage}
                    onChange={(e) => setNewWO({ ...newWO, stage: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Priority</label>
                  <select
                    value={newWO.priority}
                    onChange={(e) => setNewWO({ ...newWO, priority: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Assigned Operator</label>
                  <select
                    value={newWO.worker}
                    onChange={(e) => setNewWO({ ...newWO, worker: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="Rahul Kulkarni">Rahul Kulkarni</option>
                    <option value="Siddharth Patil">Siddharth Patil</option>
                    <option value="Madhuri Joshi">Madhuri Joshi</option>
                    <option value="Anil Sharma">Anil Sharma</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Allocated Machine Tool</label>
                  <select
                    value={newWO.machine}
                    onChange={(e) => setNewWO({ ...newWO, machine: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="LITH-01 - DUV Stepper">LITH-01 - DUV Stepper</option>
                    <option value="ETCH-02 - DRIE Etcher">ETCH-02 - DRIE Etcher</option>
                    <option value="BOND-03 - Wafer Bonder">BOND-03 - Wafer Bonder</option>
                    <option value="DICE-01 - Automatic Dicer">DICE-01 - Automatic Dicer</option>
                    <option value="TEST-04 - Wafer Prober">TEST-04 - Wafer Prober</option>
                    <option value="PACK-02 - WLP Packager">PACK-02 - WLP Packager</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Scheduling Frame (Due In)</label>
                <input
                  type="text"
                  required
                  value={newWO.dueIn}
                  onChange={(e) => setNewWO({ ...newWO, dueIn: e.target.value })}
                  placeholder="e.g. Today 16:00, Tomorrow, etc."
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
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
                  className="h-10 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-900"
                >
                  Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
