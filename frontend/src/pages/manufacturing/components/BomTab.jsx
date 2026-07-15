import { useState } from "react";
import { useManufacturingStore } from "../hooks/useManufacturingStore";
import { ChevronDown, ChevronRight, Layers, DollarSign, Package, Calendar, User, FileText, Plus, Check, X, ShieldAlert, Sparkles } from "lucide-react";

export function BomTab() {
  const { boms, addBom } = useManufacturingStore();
  const [expandedBomId, setExpandedBomId] = useState(null);
  
  // Create BOM modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBom, setNewBom] = useState({
    name: "BOM - Custom Wafer Lot",
    product: "MEMS Pressure Sensor - 1.2 bar",
    version: "v1.0",
    estimatedCost: 250.00,
    components: [
      { sku: "WFR-SOI-200", name: "SOI Wafer 200mm - 725 micron", qty: 0.01, unit: "pcs", unitCost: 15000, availability: "Low Stock", required: 50 },
      { sku: "PR-AZ-9260", name: "Photoresist AZ 9260", qty: 0.002, unit: "liters", unitCost: 8000, availability: "Out of Stock", required: 10 }
    ]
  });

  const toggleExpand = (id) => {
    if (expandedBomId === id) {
      setExpandedBomId(null);
    } else {
      setExpandedBomId(id);
    }
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    addBom(newBom);
    setShowCreateModal(false);
    // Reset state
    setNewBom({
      name: "BOM - Custom Wafer Lot",
      product: "MEMS Pressure Sensor - 1.2 bar",
      version: "v1.0",
      estimatedCost: 250.00,
      components: [
        { sku: "WFR-SOI-200", name: "SOI Wafer 200mm - 725 micron", qty: 0.01, unit: "pcs", unitCost: 15000, availability: "Low Stock", required: 50 }
      ]
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters Sub-Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-slate-950 flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            Bill of Materials (BOM) Library
          </h3>
          <p className="text-xs text-slate-500">Manage formulation recipes, wafer stack structures, and material unit costs</p>
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
              <th className="px-4 py-3.5">BOM Recipe Name</th>
              <th className="px-4 py-3.5">Target Product</th>
              <th className="px-4 py-3.5 text-center">Version</th>
              <th className="px-4 py-3.5 text-center">Status</th>
              <th className="px-4 py-3.5 text-right">Est. Unit Cost</th>
              <th className="px-4 py-3.5 text-center">Materials</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {boms.map((bom) => {
              const isExpanded = expandedBomId === bom.id;
              return (
                <>
                  <tr
                    key={bom.id}
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
                      {bom.name}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      {bom.product}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-600 bg-slate-100/50 rounded-md py-0.5 max-w-[60px] mx-auto">
                      {bom.version}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        {bom.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                      ₹{bom.estimatedCost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-500 tabular-nums">
                      {bom.materialsCount} components
                    </td>
                  </tr>

                  {/* Expandable Section */}
                  {isExpanded && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={7} className="px-6 py-5 border-t border-b border-slate-100">
                        <div className="grid gap-6 lg:grid-cols-3">
                          
                          {/* Nested Materials Table */}
                          <div className="lg:col-span-2 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              <Package size={14} className="text-blue-500" />
                              Wafer Stack & Chemical Components List
                            </h4>
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                              <table className="w-full text-left border-collapse text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    <th className="px-3 py-2">SKU</th>
                                    <th className="px-3 py-2">Material</th>
                                    <th className="px-3 py-2 text-right">Qty/Die</th>
                                    <th className="px-3 py-2 text-center">Unit</th>
                                    <th className="px-3 py-2 text-right">Cost/Unit</th>
                                    <th className="px-3 py-2 text-center">Availability</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-600">
                                  {bom.components.map((comp) => (
                                    <tr key={comp.sku} className="hover:bg-slate-50/50">
                                      <td className="px-3 py-2 font-bold text-slate-400 tabular-nums">{comp.sku}</td>
                                      <td className="px-3 py-2 font-semibold text-slate-800">{comp.name}</td>
                                      <td className="px-3 py-2 text-right font-semibold text-slate-900 tabular-nums">{comp.qty}</td>
                                      <td className="px-3 py-2 text-center font-medium uppercase text-slate-400">{comp.unit}</td>
                                      <td className="px-3 py-2 text-right font-bold text-slate-700 tabular-nums">₹{comp.unitCost.toLocaleString()}</td>
                                      <td className="px-3 py-2 text-center">
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                                          comp.availability === "In Stock" ? "bg-emerald-50 text-emerald-700" :
                                          comp.availability === "Low Stock" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                                        }`}>
                                          {comp.availability}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Version History & Actions */}
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Calendar size={14} className="text-purple-500" />
                                Revision History & Audit Trails
                              </h4>
                              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 max-h-[160px] overflow-y-auto">
                                {bom.history.map((hist, idx) => (
                                  <div key={idx} className="flex gap-2.5 items-start text-[11px]">
                                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between text-slate-400 font-medium">
                                        <span className="font-bold text-purple-700">{hist.version}</span>
                                        <span>{hist.date}</span>
                                      </div>
                                      <p className="font-semibold text-slate-800 mt-0.5">{hist.description}</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                        <User size={10} /> By {hist.author}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-xl bg-slate-900 p-4 text-white space-y-2">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Formula Insights</p>
                              <p className="text-[11px] leading-relaxed text-slate-300">
                                This BOM recipe calculates substrate wafer yield loss at <span className="font-bold text-emerald-400">4.2%</span>. Gold target sputter thickness is calibrated to <span className="font-bold">400nm</span>.
                              </p>
                              <div className="pt-2 flex gap-1.5">
                                <button
                                  onClick={() => alert("Component addition is open in raw material designer")}
                                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold text-center transition"
                                >
                                  Modify BOM
                                </button>
                                <button
                                  onClick={() => alert("Recipe locked for active production")}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-bold text-center transition"
                                >
                                  Validate
                                </button>
                              </div>
                            </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CREATE BOM MODAL DIALOG */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Add BOM Recipe</h3>
                <p className="text-xs text-slate-500">Establish a new Bill of Materials recipe formulation</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">BOM Recipe Name</label>
                <input
                  type="text"
                  required
                  value={newBom.name}
                  onChange={(e) => setNewBom({ ...newBom, name: e.target.value })}
                  placeholder="e.g. BOM - MEMS Pressure Sensor v3.2"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Target Product</label>
                  <select
                    value={newBom.product}
                    onChange={(e) => setNewBom({ ...newBom, product: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="MEMS Pressure Sensor - 1.2 bar">MEMS Pressure Sensor - 1.2 bar</option>
                    <option value="MEMS Accelerometer - 3-axis">MEMS Accelerometer - 3-axis</option>
                    <option value="MEMS Microphone - Analog">MEMS Microphone - Analog</option>
                    <option value="MEMS Gyroscope - Industrial">MEMS Gyroscope - Industrial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Recipe Version</label>
                  <input
                    type="text"
                    required
                    value={newBom.version}
                    onChange={(e) => setNewBom({ ...newBom, version: e.target.value })}
                    placeholder="e.g. v3.2"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Estimated Unit Cost (₹ per die)</label>
                <input
                  type="number"
                  required
                  value={newBom.estimatedCost}
                  onChange={(e) => setNewBom({ ...newBom, estimatedCost: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 480"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wide">
                  <span>Chemical / Wafer Ingredients</span>
                  <span className="text-[10px] text-blue-600 cursor-pointer hover:underline" onClick={() => alert("Added component slot")}>+ Add Component Row</span>
                </div>
                <div className="space-y-1.5">
                  {newBom.components.map((comp, index) => (
                    <div key={index} className="flex gap-2 items-center text-[10px] font-semibold text-slate-700 bg-white border border-slate-200 p-2 rounded-lg">
                      <span className="font-bold text-slate-400">{comp.sku}</span>
                      <span className="flex-1 truncate">{comp.name}</span>
                      <span className="tabular-nums bg-slate-100 px-2 py-0.5 rounded text-slate-600">{comp.qty} {comp.unit}</span>
                      <span className="text-slate-800">₹{comp.unitCost}</span>
                    </div>
                  ))}
                </div>
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
                  Save BOM Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
