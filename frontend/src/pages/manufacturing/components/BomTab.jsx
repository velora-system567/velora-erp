import { useState } from "react";
import { useBoms, useCreateBom, useDeleteBom, useManufacturingItems } from "../hooks/useManufacturingApi";
import { useMfgListData } from "./useMfgListData";
import { EmptyState } from "./EmptyState";
import { ChevronDown, ChevronRight, Layers, Package, Plus, Trash2, X } from "lucide-react";

export function BomTab() {
  const bomsQuery = useBoms();
  const { list: boms, isEmpty: isBomsEmpty } = useMfgListData(bomsQuery);
  const itemsQuery = useManufacturingItems();
  const items = itemsQuery.data?.data || [];

  const createBomMutation = useCreateBom();
  const deleteBomMutation = useDeleteBom();

  const [expandedBomId, setExpandedBomId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newBom, setNewBom] = useState({
    itemId: "",
    version: "v1.0",
    notes: "",
    lines: [
      { componentId: "", quantity: 1, scrapPercent: 0 }
    ]
  });

  const toggleExpand = (id) => {
    setExpandedBomId(expandedBomId === id ? null : id);
  };

  const handleAddLine = () => {
    setNewBom({
      ...newBom,
      lines: [...newBom.lines, { componentId: "", quantity: 1, scrapPercent: 0 }]
    });
  };

  const handleRemoveLine = (idx) => {
    if (newBom.lines.length <= 1) return;
    setNewBom({
      ...newBom,
      lines: newBom.lines.filter((_, i) => i !== idx)
    });
  };

  const handleLineChange = (idx, field, value) => {
    const nextLines = [...newBom.lines];
    nextLines[idx] = { ...nextLines[idx], [field]: value };
    setNewBom({ ...newBom, lines: nextLines });
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newBom.itemId) {
      alert("Please select a target Item/Product");
      return;
    }
    const validLines = newBom.lines.filter((l) => l.componentId && l.quantity > 0);
    if (validLines.length === 0) {
      alert("Please add at least one valid component to the BOM");
      return;
    }

    createBomMutation.mutate({
      itemId: newBom.itemId,
      version: newBom.version || "v1.0",
      notes: newBom.notes || undefined,
      lines: validLines.map((l) => ({
        componentId: l.componentId,
        quantity: Number(l.quantity) || 1,
        scrapPercent: Number(l.scrapPercent) || 0,
      })),
    }, {
      onSuccess: () => {
        setShowCreateModal(false);
        setNewBom({
          itemId: "",
          version: "v1.0",
          notes: "",
          lines: [{ componentId: "", quantity: 1, scrapPercent: 0 }]
        });
      },
      onError: (err) => {
        alert(err.message || "Failed to create BOM");
      },
    });
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this BOM?")) {
      deleteBomMutation.mutate(id);
    }
  };

  if (isBomsEmpty) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-slate-950">Bill of Materials (BOM)</h3>
            <p className="text-xs text-slate-500">Manage formulations, component recipes, and sub-assemblies</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-900 shadow-sm"
          >
            <Plus size={14} />
            Create BOM
          </button>
        </div>
        <EmptyState title="No BOM recipes" subtitle="Create a BOM to start managing product recipes and components." />

        {showCreateModal && (
          <CreateBomModal
            items={items}
            newBom={newBom}
            setNewBom={setNewBom}
            onAddLine={handleAddLine}
            onRemoveLine={handleRemoveLine}
            onLineChange={handleLineChange}
            onSubmit={handleCreateSubmit}
            onClose={() => setShowCreateModal(false)}
            isPending={createBomMutation.isPending}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Sub-Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-slate-950 flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            Bill of Materials (BOM) Library
          </h3>
          <p className="text-xs text-slate-500">Manage formulation recipes, component structures, and material requirements</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-900 shadow-sm"
        >
          <Plus size={14} />
          Create BOM
        </button>
      </div>

      {/* BOM Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3.5 w-10"></th>
              <th className="px-4 py-3.5">Target Item / Product</th>
              <th className="px-4 py-3.5 text-center">Version</th>
              <th className="px-4 py-3.5 text-center">Default</th>
              <th className="px-4 py-3.5 text-center">Components</th>
              <th className="px-4 py-3.5">Notes</th>
              <th className="px-4 py-3.5 text-center w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {boms.map((bom) => {
              const isExpanded = expandedBomId === bom.id;
              const itemName = bom.product || items.find((i) => i.id === bom.itemId)?.name || bom.itemId;
              const lines = bom.lines || [];
              return (
                <tbody key={bom.id} className="divide-y divide-slate-100">
                  <tr
                    onClick={() => toggleExpand(bom.id)}
                    className="hover:bg-slate-50/70 transition cursor-pointer select-none"
                  >
                    <td className="px-4 py-3.5 text-center">
                      {isExpanded ? (
                        <ChevronDown size={16} className="text-slate-500" />
                      ) : (
                        <ChevronRight size={16} className="text-slate-500" />
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">
                      {itemName}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-600 bg-slate-100/50 rounded-md py-0.5 max-w-[60px] mx-auto">
                      {bom.version || "v1.0"}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        bom.isDefault ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-slate-100 text-slate-600"
                      }`}>
                        {bom.isDefault ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-500 tabular-nums">
                      {lines.length} components
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 truncate max-w-[200px]">
                      {bom.notes || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={(e) => handleDelete(bom.id, e)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="Delete BOM"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>

                  {/* Expandable Lines Section */}
                  {isExpanded && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={7} className="px-6 py-5 border-t border-b border-slate-100">
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Package size={14} className="text-blue-500" />
                            Component Materials List
                          </h4>
                          {lines.length === 0 ? (
                            <p className="text-xs text-slate-400">No components registered in this BOM.</p>
                          ) : (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                              <table className="w-full text-left border-collapse text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    <th className="px-3 py-2">Component Item</th>
                                    <th className="px-3 py-2 text-right">Required Quantity</th>
                                    <th className="px-3 py-2 text-right">Scrap %</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-600">
                                  {lines.map((line, idx) => {
                                    const compName = items.find((i) => i.id === line.componentId)?.name || line.componentId;
                                    return (
                                      <tr key={line.id || idx} className="hover:bg-slate-50/50">
                                        <td className="px-3 py-2 font-semibold text-slate-800">{compName}</td>
                                        <td className="px-3 py-2 text-right font-semibold text-slate-900 tabular-nums">{Number(line.quantity || 0)}</td>
                                        <td className="px-3 py-2 text-right font-medium text-slate-500 tabular-nums">{line.scrapPercent || 0}%</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CREATE BOM MODAL */}
      {showCreateModal && (
        <CreateBomModal
          items={items}
          newBom={newBom}
          setNewBom={setNewBom}
          onAddLine={handleAddLine}
          onRemoveLine={handleRemoveLine}
          onLineChange={handleLineChange}
          onSubmit={handleCreateSubmit}
          onClose={() => setShowCreateModal(false)}
          isPending={createBomMutation.isPending}
        />
      )}
    </div>
  );
}

function CreateBomModal({ items, newBom, setNewBom, onAddLine, onRemoveLine, onLineChange, onSubmit, onClose, isPending }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-950">Create Bill of Materials</h3>
            <p className="text-xs text-slate-500">Define raw materials and sub-components for an item</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Target Item / Finished Good</label>
              {items.length > 0 ? (
                <select
                  value={newBom.itemId}
                  required
                  onChange={(e) => setNewBom({ ...newBom, itemId: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                >
                  <option value="">Select item...</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.itemCode})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="Enter Item UUID"
                  value={newBom.itemId}
                  onChange={(e) => setNewBom({ ...newBom, itemId: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">BOM Version</label>
              <input
                type="text"
                required
                value={newBom.version}
                onChange={(e) => setNewBom({ ...newBom, version: e.target.value })}
                placeholder="e.g. v1.0"
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Notes / Description</label>
            <input
              type="text"
              value={newBom.notes}
              onChange={(e) => setNewBom({ ...newBom, notes: e.target.value })}
              placeholder="Recipe details, process instructions..."
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
            />
          </div>

          <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50">
            <div className="flex items-center justify-between text-xs text-slate-700 font-bold uppercase tracking-wide">
              <span>Required Components</span>
              <button
                type="button"
                onClick={onAddLine}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                + Add Component
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {newBom.lines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    {items.length > 0 ? (
                      <select
                        value={line.componentId}
                        required
                        onChange={(e) => onLineChange(idx, "componentId", e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
                      >
                        <option value="">Select component...</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.itemCode})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="Component Item UUID"
                        value={line.componentId}
                        onChange={(e) => onLineChange(idx, "componentId", e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                  <input
                    type="number"
                    min={0.001}
                    step="any"
                    required
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => onLineChange(idx, "quantity", parseFloat(e.target.value) || 1)}
                    className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Scrap %"
                    value={line.scrapPercent}
                    onChange={(e) => onLineChange(idx, "scrapPercent", parseInt(e.target.value) || 0)}
                    className="h-9 w-16 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                  />
                  {newBom.lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveLine(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
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
              {isPending ? "Creating..." : "Create BOM"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
