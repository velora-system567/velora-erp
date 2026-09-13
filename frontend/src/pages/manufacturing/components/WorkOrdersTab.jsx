import { useState, useMemo } from "react";
import { useWorkOrders, useCreateWorkOrder, useCompleteWorkOrder, useProductionOrders, useMachines } from "../hooks/useManufacturingApi";
import { Kanban, Table, Calendar, Milestone, Plus, X, User, Cpu, Layers, CheckCircle2 } from "lucide-react";
import { useMfgListData } from "./useMfgListData";
import { EmptyState } from "./EmptyState";

const STAGES = ["Photolithography", "Etching", "Bonding", "Dicing", "Testing", "Packaging", "Assembly", "Quality"];

const STATUS_STYLING = {
  PENDING: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700 border-indigo-100",
  ON_TRACK: "bg-emerald-50 text-emerald-700 border-emerald-100",
  DELAYED: "bg-rose-50 text-rose-700 border-rose-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

export function WorkOrdersTab() {
  const workOrdersQuery = useWorkOrders();
  const productionOrdersQuery = useProductionOrders();
  const machinesQuery = useMachines();

  const { list: workOrders, isEmpty: isWorkOrdersEmpty } = useMfgListData(workOrdersQuery);
  const { list: productionOrders } = useMfgListData(productionOrdersQuery);
  const { list: machines } = useMfgListData(machinesQuery);

  const createWorkOrderMutation = useCreateWorkOrder();
  const completeWorkOrderMutation = useCompleteWorkOrder();

  const [subView, setSubView] = useState("kanban"); // kanban, table, calendar, timeline
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newWO, setNewWO] = useState({
    productionOrderId: "",
    operationName: "Photolithography",
    machineId: "",
    plannedQty: 100,
    assignedTo: "",
    notes: "",
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newWO.productionOrderId) {
      alert("Please select a Production Order");
      return;
    }
    createWorkOrderMutation.mutate({
      productionOrderId: newWO.productionOrderId,
      operationName: newWO.operationName || "Operation",
      machineId: newWO.machineId || undefined,
      plannedQty: Number(newWO.plannedQty) || 1,
      assignedTo: newWO.assignedTo || undefined,
      notes: newWO.notes || undefined,
    }, {
      onSuccess: () => {
        setShowCreateModal(false);
        setNewWO({
          productionOrderId: "",
          operationName: "Photolithography",
          machineId: "",
          plannedQty: 100,
          assignedTo: "",
          notes: "",
        });
      },
      onError: (err) => {
        alert(err.message || "Failed to create work order");
      },
    });
  };

  const handleComplete = (id) => {
    const qty = prompt("Enter completed quantity:", "100");
    if (qty !== null) {
      const scrap = prompt("Enter scrap quantity (optional):", "0");
      completeWorkOrderMutation.mutate({
        id,
        completedQty: Number(qty) || 1,
        scrapQty: Number(scrap) || 0,
      });
    }
  };

  if (isWorkOrdersEmpty) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-slate-950">Work Orders</h3>
            <p className="text-xs text-slate-500">Track and execute shop floor operations and stage routing</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-900 shadow-sm"
          >
            <Plus size={14} />
            Create Work Order
          </button>
        </div>
        <EmptyState title="No work orders" subtitle="Create a work order against a production order to begin shop floor execution." />

        {showCreateModal && (
          <CreateWorkOrderModal
            productionOrders={productionOrders}
            machines={machines}
            newWO={newWO}
            setNewWO={setNewWO}
            onSubmit={handleCreateSubmit}
            onClose={() => setShowCreateModal(false)}
            isPending={createWorkOrderMutation.isPending}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-bar Navigation for Work Order Views */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 shrink-0">
          {[
            { id: "kanban", label: "Kanban Board", icon: Kanban },
            { id: "table", label: "Data Table", icon: Table },
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

      {/* 1. KANBAN VIEW */}
      {subView === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1000px]">
            {["PENDING", "IN_PROGRESS", "COMPLETED"].map((statusKey) => {
              const stageWos = workOrders.filter((w) => w.status === statusKey || (statusKey === "PENDING" && !w.status));
              return (
                <div key={statusKey} className="flex-1 rounded-2xl bg-slate-100/70 border border-slate-200/50 p-3 min-w-[250px]">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2 mb-3">
                    <span className="text-xs font-bold text-slate-800">{statusKey.replace("_", " ")}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md shadow-sm">
                      {stageWos.length}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {stageWos.length === 0 ? (
                      <div className="text-center py-8 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/50">
                        No lots in this stage
                      </div>
                    ) : (
                      stageWos.map((wo) => {
                        const mach = machines.find((m) => m.id === wo.machineId);
                        return (
                          <div key={wo.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400">{wo.woNumber || wo.id}</span>
                              <span className={`text-[9px] font-bold border rounded px-1.5 py-0.5 ${STATUS_STYLING[wo.status] || "bg-slate-100 text-slate-700"}`}>
                                {(wo.status || "PENDING").replace("_", " ")}
                              </span>
                            </div>
                            <h4 className="mt-1.5 text-xs font-bold text-slate-950 truncate">{wo.operationName || "Operation"}</h4>

                            <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px] text-slate-500 font-semibold">
                              <div className="flex items-center gap-1">
                                <User size={10} className="text-slate-400" />
                                <span className="truncate">{wo.assignedTo || "—"}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Cpu size={10} className="text-slate-400" />
                                <span className="truncate">{mach?.name || mach?.machineCode || "—"}</span>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-slate-500 border-t border-slate-100 pt-2">
                              <span>Qty: {Number(wo.completedQty || 0)}/{Number(wo.plannedQty || 0)}</span>
                              {wo.status !== "COMPLETED" && (
                                <button
                                  onClick={() => handleComplete(wo.id)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800"
                                >
                                  <CheckCircle2 size={12} />
                                  Complete
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
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
                <th className="px-4 py-3.5">WO Number</th>
                <th className="px-4 py-3.5">Operation Name</th>
                <th className="px-4 py-3.5">Assigned Machine</th>
                <th className="px-4 py-3.5">Operator</th>
                <th className="px-4 py-3.5 text-right">Planned Qty</th>
                <th className="px-4 py-3.5 text-right">Completed</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {workOrders.map((wo) => {
                const mach = machines.find((m) => m.id === wo.machineId);
                return (
                  <tr key={wo.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3.5 font-bold text-slate-900">{wo.woNumber || wo.id}</td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">{wo.operationName}</td>
                    <td className="px-4 py-3.5 text-slate-600">{mach?.name || mach?.machineCode || "—"}</td>
                    <td className="px-4 py-3.5 text-slate-600">{wo.assignedTo || "—"}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900 tabular-nums">{Number(wo.plannedQty || 0).toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-emerald-600 tabular-nums">{Number(wo.completedQty || 0).toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        STATUS_STYLING[wo.status] || "bg-slate-100 text-slate-700"
                      }`}>
                        {(wo.status || "PENDING").replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {wo.status !== "COMPLETED" ? (
                        <button
                          onClick={() => handleComplete(wo.id)}
                          className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition"
                        >
                          Complete
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">Done</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE WORK ORDER MODAL */}
      {showCreateModal && (
        <CreateWorkOrderModal
          productionOrders={productionOrders}
          machines={machines}
          newWO={newWO}
          setNewWO={setNewWO}
          onSubmit={handleCreateSubmit}
          onClose={() => setShowCreateModal(false)}
          isPending={createWorkOrderMutation.isPending}
        />
      )}
    </div>
  );
}

function CreateWorkOrderModal({ productionOrders, machines, newWO, setNewWO, onSubmit, onClose, isPending }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-950">Add Work Order</h3>
            <p className="text-xs text-slate-500">Dispatch a new operational job step for a production lot</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Production Order</label>
            {productionOrders.length > 0 ? (
              <select
                value={newWO.productionOrderId}
                required
                onChange={(e) => setNewWO({ ...newWO, productionOrderId: e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
              >
                <option value="">Select Production Order...</option>
                {productionOrders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber || po.id} — Qty: {Number(po.quantity || 0)} ({po.status})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                required
                placeholder="Enter Production Order UUID"
                value={newWO.productionOrderId}
                onChange={(e) => setNewWO({ ...newWO, productionOrderId: e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Operation Name</label>
              <input
                type="text"
                required
                value={newWO.operationName}
                onChange={(e) => setNewWO({ ...newWO, operationName: e.target.value })}
                placeholder="e.g. Dicing, Inspection, Milling"
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Planned Volume (Qty)</label>
              <input
                type="number"
                required
                min={1}
                value={newWO.plannedQty}
                onChange={(e) => setNewWO({ ...newWO, plannedQty: parseInt(e.target.value) || 1 })}
                placeholder="e.g. 100"
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Assigned Machine</label>
              <select
                value={newWO.machineId}
                onChange={(e) => setNewWO({ ...newWO, machineId: e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
              >
                <option value="">No machine assigned</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.machineCode || m.id} · {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Assigned Operator</label>
              <input
                type="text"
                value={newWO.assignedTo}
                onChange={(e) => setNewWO({ ...newWO, assignedTo: e.target.value })}
                placeholder="Operator name"
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Notes</label>
            <textarea
              value={newWO.notes}
              onChange={(e) => setNewWO({ ...newWO, notes: e.target.value })}
              placeholder="Job specifications, safety guidelines..."
              className="w-full min-h-[60px] rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-10 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create Work Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
