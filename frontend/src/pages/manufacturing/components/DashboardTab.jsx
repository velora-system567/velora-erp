import { useMemo, useState } from "react";
import { Activity, BarChart3, Building2, Calendar, ClipboardList, Clock, DollarSign, ShieldAlert, Sparkles, TrendingUp, Users, CheckCircle, AlertTriangle } from "lucide-react";
import { useManufacturingStore } from "../hooks/useManufacturingStore";
import { useManufacturingDashboard } from "../hooks/useManufacturingApi";
import { SectionCard } from "./SectionCard";
import { ProgressRing } from "./ProgressRing";
import { PlannedVsActualChart, OeeTrendChart } from "./Charts";
import { formatNumber, formatPercent } from "./format";
import { TonedDot } from "./TonedDot";

export function DashboardTab({ onJump }) {
  const dashboardQuery = useManufacturingDashboard();
  const hasBackendData = Boolean(dashboardQuery.data?.data);

  const {
    factory,
    plantHealth,
    summaryKpis,
    todayProduction,
    machines,
    productionOrders,
    workOrders,
    logs,
    maintenance
  } = useManufacturingStore();

  if (!dashboardQuery.isLoading && hasBackendData) {
    const activeOrders = dashboardQuery.data.data.activeOrders ?? 0;
    const delayed = dashboardQuery.data.data.delayedOrders ?? 0;
    const delivered = dashboardQuery.data.data.todayOutput ?? 0;
    const planned = dashboardQuery.data.data.todayPlanned ?? 0;
    const haveAny = activeOrders > 0 || delayed > 0 || delivered > 0 || planned > 0;
    if (!haveAny) {
      return (
        <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-lg font-semibold text-slate-950">No manufacturing data yet</p>
            <p className="mt-2 text-sm text-slate-600">Create your first Production Order to start tracking manufacturing KPIs.</p>
          </div>
        </div>
      );
    }
  }

  if (!dashboardQuery.isLoading && dashboardQuery.error && !hasBackendData) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-10">
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center">
          <p className="text-lg font-semibold text-rose-700">Unable to load manufacturing dashboard</p>
          <p className="mt-2 text-sm text-slate-600">Please try again.</p>
        </div>
      </div>
    );
  }

  const [selectedDayOffset, setSelectedDayOffset] = useState(0);

  // Derive extra KPIs
  const activeOrdersCount = useMemo(() => {
    return productionOrders.filter(o => o.status === "IN_PROGRESS" || o.status === "PLANNING").length;
  }, [productionOrders]);

  const completedOrdersCount = useMemo(() => {
    return productionOrders.filter(o => o.status === "COMPLETED").length;
  }, [productionOrders]);

  const delayedOrdersCount = useMemo(() => {
    return productionOrders.filter(o => o.status === "DELAYED").length;
  }, [productionOrders]);

  const totalCost = useMemo(() => {
    // Sum estimated costs * quantity
    const total = productionOrders.reduce((sum, order) => {
      // Find matching BOM cost
      const baseCost = order.product.includes("Pressure") ? 480 : order.product.includes("Accel") ? 320 : 140;
      return sum + (baseCost * order.quantity);
    }, 0);
    return `₹${(total / 100000).toFixed(1)} L`;
  }, [productionOrders]);

  // Weekly Calendar (relative to July 14, 2026)
  const weekDays = useMemo(() => {
    const days = [];
    const baseDate = new Date("2026-07-14T00:00:00+05:30");
    for (let i = -2; i <= 4; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      days.push({
        date: d,
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        dayNum: d.getDate(),
        isoString: d.toISOString().split("T")[0],
        offset: i,
      });
    }
    return days;
  }, []);

  const selectedDateStr = weekDays.find(d => d.offset === selectedDayOffset)?.isoString;

  // Calendar events for the selected day
  const dailyEvents = useMemo(() => {
    const events = [];
    
    // Work orders on this day
    workOrders.forEach(wo => {
      // Simulate dates
      const woDate = wo.dueIn.includes("Today") ? "2026-07-14" 
                   : wo.dueIn.includes("Tomorrow") ? "2026-07-15"
                   : wo.dueIn.includes("Overdue") ? "2026-07-13" 
                   : wo.dueIn.includes("Done") ? "2026-07-12" : "2026-07-16";
      
      if (woDate === selectedDateStr) {
        events.push({
          id: wo.id,
          type: "Work Order",
          title: `${wo.id} - ${wo.product}`,
          sub: `${wo.qtyPlanned} dies @ ${wo.stage}`,
          time: wo.dueIn.includes("Today") ? "14:30" : "09:30",
          status: wo.status,
          intent: wo.status === "COMPLETED" ? "positive" : wo.status === "DELAYED" ? "negative" : "info"
        });
      }
    });

    // Maintenance tasks on this day
    maintenance.forEach(m => {
      const mDate = m.scheduledDate;
      if (mDate === selectedDateStr) {
        events.push({
          id: m.id,
          type: "Maintenance",
          title: `PM: ${m.machineName}`,
          sub: m.task,
          time: "10:00",
          status: m.status,
          intent: m.status === "COMPLETED" ? "positive" : "warning"
        });
      }
    });

    return events;
  }, [workOrders, maintenance, selectedDateStr]);

  return (
    <div className="space-y-6">
      {/* KPI Cards Row — each opens its live operational tab */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {/* KPI 1: Active Work Orders */}
        <button onClick={() => onJump?.("Orders")} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <ClipboardList size={18} className="text-blue-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">Live</span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Active Orders</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{activeOrdersCount}</p>
          <p className="mt-1 text-xs text-slate-500">On-going & Planning</p>
        </button>

        {/* KPI 2: Production Today */}
        <button onClick={() => onJump?.("WorkOrders")} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <Activity size={18} className="text-indigo-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shift</span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Today's Output</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{formatNumber(todayProduction.actual)}</p>
          <p className="mt-1 text-xs text-slate-500">Dies ({formatPercent((todayProduction.actual/todayProduction.planned)*100, 0)} plan)</p>
        </button>

        {/* KPI 3: Completed Orders */}
        <button onClick={() => onJump?.("Orders")} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <CheckCircle size={18} className="text-emerald-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Month</span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Completed</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{completedOrdersCount}</p>
          <p className="mt-1 text-xs text-slate-500">Full runs delivered</p>
        </button>

        {/* KPI 4: Delayed Orders */}
        <button onClick={() => onJump?.("Orders")} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <AlertTriangle size={18} className="text-rose-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md">Urgent</span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Delayed</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{delayedOrdersCount}</p>
          <p className="mt-1 text-xs text-slate-500">Exceeding deadlines</p>
        </button>

        {/* KPI 5: Machine Utilization */}
        <button onClick={() => onJump?.("Machines")} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <Building2 size={18} className="text-sky-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avg</span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Machine Util</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">71.5%</p>
          <p className="mt-1 text-xs text-slate-500">8 lines running</p>
        </button>

        {/* KPI 6: OEE */}
        <button onClick={() => onJump?.("Quality")} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <BarChart3 size={18} className="text-amber-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">78% Target</span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">OEE Score</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">78.4%</p>
          <p className="mt-1 text-xs text-slate-500">Composite Yield</p>
        </button>

        {/* KPI 7: Production Cost */}
        <button onClick={() => onJump?.("Orders")} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <DollarSign size={18} className="text-teal-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Est</span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Est. WIP Cost</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{totalCost}</p>
          <p className="mt-1 text-xs text-slate-500">Active run value</p>
        </button>

        {/* KPI 8: Scrap Rate */}
        <button onClick={() => onJump?.("Quality")} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <ShieldAlert size={18} className="text-rose-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">Best 2.5%</span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Scrap Rate</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">3.1%</p>
          <p className="mt-1 text-xs text-slate-500">345 defect dies</p>
        </button>
      </section>

      {/* Graphical section */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Production Today */}
        <SectionCard
          id="todays-production"
          title="Today's production output"
          description="Planned vs actual yield by hour. Active Shift A."
          icon={Activity}
          className="lg:col-span-2"
        >
          <div className="mt-2 grid gap-5 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shift Target</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatNumber(todayProduction.planned)} <span className="text-xs font-medium text-slate-500">dies</span></p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed Today</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatNumber(todayProduction.actual)} <span className="text-xs font-medium text-slate-500">dies</span></p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attainment Rate</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatPercent((todayProduction.actual / todayProduction.planned) * 100, 1)}</p>
            </div>
          </div>
          <div className="mt-6">
            <PlannedVsActualChart data={todayProduction.trend} height={200} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><TonedDot tone="slate" /> Target Planned</span>
            <span className="inline-flex items-center gap-1.5"><TonedDot tone="info" /> Actual Yield Recorded</span>
          </div>
        </SectionCard>

        {/* OEE Composite score card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-950">Overall Equipment Effectiveness</h3>
                <p className="text-xs text-slate-500">Active Shift A composite OEE metrics</p>
              </div>
              <BarChart3 className="text-blue-600" size={18} />
            </div>
            <div className="mt-6 flex items-center justify-center gap-6">
              <ProgressRing
                value={78.4}
                max={85}
                size={110}
                stroke={10}
                tone="info"
                label="78.4%"
                sublabel="OEE"
              />
              <div className="text-xs space-y-2">
                <div>
                  <span className="font-semibold text-slate-700">Availability:</span>
                  <span className="ml-1 text-slate-600">91.2%</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Performance:</span>
                  <span className="ml-1 text-slate-600">89.7%</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Quality:</span>
                  <span className="ml-1 text-slate-600">95.8%</span>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <OeeTrendChart data={[72, 74, 73, 76, 75, 78, 77, 78, 80, 79, 78, 78.4]} height={120} />
            </div>
          </div>
          <p className="mt-4 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 leading-normal">
            Yield is steady. Performance dip at 08:00 due to vacuum line cleaning on TSV DRIE etcher.
          </p>
        </div>
      </div>

      {/* Week Calendar + Active orders */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Calendar widget */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-950 flex items-center gap-2">
                  <Calendar size={18} className="text-blue-600" />
                  Manufacturing Calendar
                </h3>
                <p className="text-xs text-slate-500">Click a day to filter scheduled work orders and maintenance tasks</p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                July 2026
              </span>
            </div>

            {/* Calendar Days Row */}
            <div className="mt-4 grid grid-cols-7 gap-1 bg-slate-50 rounded-2xl p-1">
              {weekDays.map((day) => {
                const isSelected = selectedDayOffset === day.offset;
                const isToday = day.offset === 0;
                return (
                  <button
                    key={day.isoString}
                    onClick={() => setSelectedDayOffset(day.offset)}
                    className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition ${
                      isSelected
                        ? "bg-slate-950 text-white shadow-sm"
                        : isToday
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "hover:bg-slate-200/60 text-slate-700"
                    }`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{day.label}</span>
                    <span className="mt-1 text-lg font-bold">{day.dayNum}</span>
                  </button>
                );
              })}
            </div>

            {/* Event List */}
            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">
                Events for {selectedDateStr === "2026-07-14" ? "Today" : selectedDateStr}
              </h4>
              {dailyEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                  No scheduled runs or maintenance on this date.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {dailyEvents.map((evt) => (
                    <div key={evt.id} className="rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 transition flex items-start gap-3">
                      <div className={`mt-0.5 rounded-md p-1.5 ${
                        evt.type === "Maintenance" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                      }`}>
                        {evt.type === "Maintenance" ? <Clock size={14} /> : <ClipboardList size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{evt.type}</span>
                          <span className="text-[10px] font-semibold text-slate-500">{evt.time}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-950 truncate mt-0.5">{evt.title}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{evt.sub}</p>
                        <span className={`inline-block mt-2 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${
                          evt.intent === "positive" ? "bg-emerald-50 text-emerald-700" :
                          evt.intent === "negative" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"
                        }`}>
                          {evt.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950 flex items-center justify-between">
              Live Activity Feed
              <TonedDot tone="positive" />
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time shop floor system audit logs</p>

            <div className="mt-4 space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {logs.slice(0, 5).map((log) => (
                <div key={log.id} className="text-xs flex items-start gap-2.5">
                  <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                    log.kind === "quality" ? "bg-emerald-500" :
                    log.kind === "maintenance" ? "bg-amber-500" :
                    log.kind === "inventory" ? "bg-sky-500" : "bg-blue-500"
                  }`} />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{log.who} <span className="font-normal text-slate-600">{log.action}</span></p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(log.when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Cleanroom Class 1000 Compliant</span>
            <span className="font-semibold text-blue-600 hover:underline cursor-pointer">View full log</span>
          </div>
        </div>
      </div>

      {/* Machine Utilization Summary */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-950">Machine Utilization & Status</h3>
        <p className="text-xs text-slate-500 mt-0.5">Physical status and programs running on active tooling lines.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {machines.map((m) => {
            const tone = m.status === "RUNNING" ? "positive" : m.status === "MAINTENANCE" ? "warning" : m.status === "BREAKDOWN" ? "negative" : "slate";
            return (
              <div key={m.id} className="rounded-2xl border border-slate-200 p-4 hover:border-slate-300 transition flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{m.id}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${
                      tone === "positive" ? "bg-emerald-50 text-emerald-700" :
                      tone === "warning" ? "bg-amber-50 text-amber-700" :
                      tone === "negative" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"
                    }`}>
                      <TonedDot tone={tone} />
                      {m.status}
                    </span>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-slate-950 truncate">{m.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 truncate bg-slate-50 px-2 py-1 rounded-md">
                    {m.program}
                  </p>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Utilization</span>
                    <span className="font-bold text-slate-950">{m.utilization}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${
                      tone === "positive" ? "bg-emerald-500" :
                      tone === "warning" ? "bg-amber-500" :
                      tone === "negative" ? "bg-rose-500" : "bg-slate-400"
                    }`} style={{ width: `${m.utilization}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
