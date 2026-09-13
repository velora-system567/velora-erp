import { useState, useMemo } from "react";
import { useQualityChecks, useCreateQualityCheck, useWorkOrders } from "../hooks/useManufacturingApi";
import { useMfgListData } from "./useMfgListData";
import { EmptyState } from "./EmptyState";
import { CheckCircle, AlertTriangle, ShieldAlert, Sparkles, Plus, X, BarChart3, TrendingUp, HelpCircle } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

export function QualityTab() {
  const qualityQuery = useQualityChecks();
  const { list: qualityRecords, isEmpty: isQualityEmpty } = useMfgListData(qualityQuery);
  const workOrdersQuery = useWorkOrders();
  const { list: workOrders } = useMfgListData(workOrdersQuery);

  const createQualityCheckMutation = useCreateQualityCheck();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create Inspection Form State
  const [newRecord, setNewRecord] = useState({
    workOrderId: "",
    inspectedQty: 100,
    passedQty: 95,
    failedQty: 5,
    reworkQty: 0,
    notes: "",
  });

  // Calculate statistics from real data
  const stats = useMemo(() => {
    let totalInspected = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalRework = 0;

    qualityRecords.forEach((r) => {
      totalInspected += Number(r.inspectedQty || 0);
      totalPassed += Number(r.passedQty || 0);
      totalFailed += Number(r.failedQty || 0);
      totalRework += Number(r.reworkQty || 0);
    });

    const compositePassRate = totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 0;

    return {
      totalInspected,
      totalPassed,
      totalFailed,
      totalRework,
      compositePassRate: compositePassRate.toFixed(2),
    };
  }, [qualityRecords]);

  // Quality trend data from real records (no hardcoded values)
  const trendData = useMemo(() => {
    if (qualityRecords.length === 0) return [];
    const rate = parseFloat(stats.compositePassRate) || 0;
    return [{ day: "Current", pass: rate, scrap: (100 - rate) }];
  }, [stats, qualityRecords]);

  // Top defects distribution — derived from real quality check defect data
  const topDefects = useMemo(() => {
    const defectMap = {};
    qualityRecords.forEach((r) => {
      if (Array.isArray(r.defects)) {
        r.defects.forEach((d) => {
          const key = d.code || d.label || "UNKNOWN";
          if (!defectMap[key]) defectMap[key] = { code: d.code || key, label: d.label || key, count: 0 };
          defectMap[key].count += d.count || 1;
        });
      }
    });
    return Object.values(defectMap).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [qualityRecords]);

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newRecord.workOrderId) {
      alert("Please select a Work Order");
      return;
    }
    createQualityCheckMutation.mutate({
      workOrderId: newRecord.workOrderId,
      inspectedQty: Number(newRecord.inspectedQty) || 1,
      passedQty: Number(newRecord.passedQty) || 0,
      failedQty: Number(newRecord.failedQty) || 0,
      reworkQty: Number(newRecord.reworkQty) || 0,
      notes: newRecord.notes || undefined,
    }, {
      onSuccess: () => {
        setShowCreateModal(false);
        setNewRecord({
          workOrderId: "",
          inspectedQty: 100,
          passedQty: 95,
          failedQty: 5,
          reworkQty: 0,
          notes: "",
        });
      },
      onError: (err) => {
        alert(err.message || "Failed to create quality check");
      },
    });
  };

  if (isQualityEmpty) {
    return (
      <div className="space-y-6">
        <EmptyState title="No quality checks" subtitle="Once inspections are logged in the backend, records will appear here." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* KPI Cards Row */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Pass Rate */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Composite Pass Rate</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 tabular-nums">{stats.compositePassRate}%</p>
          <p className="mt-1 text-xs text-slate-500">Cleanroom limit: &gt;96%</p>
        </div>

        {/* KPI 2: Total Inspected */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Inspected Dies</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{stats.totalInspected.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">Through optical & probe tests</p>
        </div>

        {/* KPI 3: Failed / Scrap */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scrap Count (Failures)</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600 tabular-nums">{stats.totalFailed.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">Scrapped silicon volume</p>
        </div>

        {/* KPI 4: Reworked */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dies Scheduled for Rework</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 tabular-nums">{stats.totalRework.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">Substrate litho stripping</p>
        </div>
      </section>

      {/* Main Charts & Defect Analytics */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Quality Trend Line chart */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-950 flex items-center gap-1.5">
                  <TrendingUp size={18} className="text-blue-600" />
                  Yield Quality trends
                </h3>
                <p className="text-xs text-slate-500">Wafer yield pass rate vs scrap rate over shift periods</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-900 shadow-sm"
              >
                <Plus size={14} />
                Log Inspection
              </button>
            </div>

            <div className="w-full text-xs font-semibold" style={{ height: 210 }}>
              <ResponsiveContainer>
                <LineChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis domain={[80, 100]} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="pass" name="Pass Rate (%)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line dataKey="scrap" name="Scrap Rate (%)" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Defect Analytics panel */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">Excursion Defect Analytics</h3>
            <p className="text-xs text-slate-500">Highest contribution failures categorized by root cause code</p>

            <ul className="mt-4 space-y-3">
              {topDefects.map((def) => {
                const totalDefCounts = topDefects.reduce((sum, d) => sum + d.count, 0);
                const pct = ((def.count / totalDefCounts) * 100).toFixed(0);
                return (
                  <li key={def.code} className="rounded-xl border border-slate-150 p-2.5 bg-slate-50">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-400 uppercase tracking-wide mr-1.5">{def.code}</span>
                        <span className="font-semibold text-slate-800">{def.label}</span>
                      </div>
                      <span className="font-bold text-slate-950 tabular-nums">{def.count} dies ({pct}%)</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-200 mt-2 overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-[10px] text-slate-400 mt-3">
            Source: SEM (Scanning Electron Microscope) automated inspection logs.
          </p>
        </div>
      </div>

      {/* QC Log Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3.5">Record ID</th>
                <th className="px-4 py-3.5">Associated WO ID</th>
                <th className="px-4 py-3.5">QA Inspector</th>
                <th className="px-4 py-3.5 text-right">Inspected dies</th>
                <th className="px-4 py-3.5 text-right">Passed dies</th>
                <th className="px-4 py-3.5 text-right">Scrap dies</th>
                <th className="px-4 py-3.5 text-right">Rework dies</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5">QA Audit Notes</th>
                <th className="px-4 py-3.5">Log Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {qualityRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-3.5 font-bold text-slate-900">{rec.id}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-500">{rec.workOrderId}</td>
                  <td className="px-4 py-3.5 font-medium text-slate-700">{rec.inspector}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-slate-900 tabular-nums">{rec.inspectedQty.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-emerald-600 tabular-nums">{rec.passedQty.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-rose-600 tabular-nums">{rec.failedQty.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-amber-600 tabular-nums">{rec.reworkQty.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      rec.passed ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                    }`}>
                      {rec.passed ? "PASSED" : "FAILED"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-500 max-w-[200px] truncate" title={rec.notes}>{rec.notes}</td>
                  <td className="px-4 py-3.5 font-medium text-slate-400 tabular-nums">{rec.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOG INSPECTION MODAL DIALOG */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Record Quality Audit</h3>
                <p className="text-xs text-slate-500">Log inspection statistics for finished wafer batches</p>
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Work Order ID</label>
                  <select
                    value={newRecord.workOrderId}
                    onChange={(e) => setNewRecord({ ...newRecord, workOrderId: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="WO-2026-1042">WO-2026-1042 (Test stage)</option>
                    <option value="WO-2026-1041">WO-2026-1041 (Packaging stage)</option>
                    <option value="WO-2026-1040">WO-2026-1040 (Bonding stage)</option>
                    <option value="WO-2026-1039">WO-2026-1039 (Etch stage)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Inspected Dies Volume</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newRecord.inspectedQty}
                    onChange={(e) => setNewRecord({ ...newRecord, inspectedQty: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 1000"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Passed Quantity</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newRecord.passedQty}
                    onChange={(e) => setNewRecord({ ...newRecord, passedQty: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 980"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Failed Quantity</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newRecord.failedQty}
                    onChange={(e) => setNewRecord({ ...newRecord, failedQty: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 20"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Rework Quantity</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newRecord.reworkQty}
                    onChange={(e) => setNewRecord({ ...newRecord, reworkQty: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 15"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Audit Observation Notes</label>
                <textarea
                  value={newRecord.notes}
                  onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                  placeholder="Excursion parameters, silicon substrate chips, cleanroom air contamination spikes..."
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
                  className="h-10 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-900"
                >
                  Log Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
