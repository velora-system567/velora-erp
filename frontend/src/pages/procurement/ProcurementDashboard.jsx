import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Clock, AlertTriangle, CheckCircle, Package, TrendingUp, DollarSign, ShoppingCart, FileText, Truck, AlertCircle, BarChart3, Target, Award, Zap, Layers, Activity } from "lucide-react";
import { procurementApi } from "../../services/api";

const KPICard = ({ title, value, subtext, icon: Icon, trend, trendValue, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-2xl font-bold text-slate-950">{value}</p>
          {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
        </div>
        <div className={`rounded-xl p-3 ${colorClasses[color]}`}>
          <Icon size={22} />
        </div>
      </div>
      {trend && (
        <div className={`mt-4 flex items-center gap-1 text-sm font-medium ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-slate-600'}`}>
          {trend === 'up' ? <ArrowUpRight size={16} /> : trend === 'down' ? <ArrowDownRight size={16} /> : null}
          <span>{trendValue}</span>
          <span className="text-slate-500 font-normal">vs last month</span>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, description, status = "neutral" }) => {
  const statusColors = {
    success: "text-green-600 bg-green-50",
    warning: "text-amber-600 bg-amber-50",
    danger: "text-red-600 bg-red-50",
    neutral: "text-slate-600 bg-slate-50",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${statusColors[status]}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-600 truncate">{title}</p>
          <p className="text-lg font-bold text-slate-950">{value}</p>
          {description && <p className="text-xs text-slate-500 truncate">{description}</p>}
        </div>
      </div>
    </div>
  );
};

const AlertCard = ({ type, title, message, count }) => {
  const typeConfig = {
    critical: { icon: AlertCircle, color: "text-red-600 bg-red-50 border-red-200" },
    warning: { icon: AlertTriangle, color: "text-amber-600 bg-amber-50 border-amber-200" },
    info: { icon: InfoCircle, color: "text-blue-600 bg-blue-50 border-blue-200" },
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${config.color}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{title}</p>
          {count !== undefined && (
            <span className="rounded-full bg-white/50 px-2 py-0.5 text-xs font-bold">{count}</span>
          )}
        </div>
        <p className="text-xs opacity-80">{message}</p>
      </div>
    </div>
  );
};

// Simple Info icon since we didn't import it
const InfoCircle = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

export function ProcurementDashboard() {
  // Fetch procurement data
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['procurement', 'kpis'],
    queryFn: () => procurementApi.getKpis(),
  });

  const { data: requests } = useQuery({
    queryKey: ['procurement', 'requests'],
    queryFn: () => procurementApi.getRequests({ status: 'PENDING' }),
  });

  const { data: orders } = useQuery({
    queryKey: ['procurement', 'orders'],
    queryFn: () => procurementApi.getOrders({ status: 'PENDING' }),
  });

  // Mock data for demonstration (will be replaced with real API data)
  const mockData = {
    totalSpend: "₹2.4 Cr",
    monthlySpend: "₹18.5 L",
    spendTrend: "up",
    spendTrendValue: "+12.5%",
    pendingRequests: 12,
    pendingOrders: 8,
    approvedOrders: 24,
    deliveredOrders: 156,
    delayedOrders: 3,
    avgCycleTime: "4.2 days",
    budgetUtilization: 78,
    costSavings: "₹12.4 L",
    vendorPerformance: 94,
    onTimeDelivery: 96,
    criticalAlerts: 5,
    stockHealth: 88,
    supplierRiskScore: 12,
    materialCriticalityScore: 8,
    productionDelayRisk: "Low",
    avgLeadTime: "7.5 days",
    emergencyPurchases: 2,
    qualityPassRate: 98.5,
    batchRejectionRate: 1.5,
    procurementEfficiencyScore: 92,
  };

  const data = kpis?.data || mockData;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Procurement Dashboard</h1>
            <p className="mt-1 text-blue-100">Monitor your procurement operations and supplier performance</p>
          </div>
          <div className="hidden sm:block">
            <div className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur">
              <p className="text-xs text-blue-100">Last Updated</p>
              <p className="text-sm font-semibold">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Primary KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Procurement Spend"
          value={data.totalSpend}
          subtext="Year to date"
          icon={DollarSign}
          trend={data.spendTrend}
          trendValue={data.spendTrendValue}
          color="blue"
        />
        <KPICard
          title="Monthly Spend"
          value={data.monthlySpend}
          subtext="Current month"
          icon={TrendingUp}
          color="green"
        />
        <KPICard
          title="Budget Utilization"
          value={`${data.budgetUtilization}%`}
          subtext="Of annual budget"
          icon={Target}
          color="purple"
        />
        <KPICard
          title="Cost Savings"
          value={data.costSavings}
          subtext="Year to date"
          icon={Award}
          trend="up"
          trendValue="+8.2%"
          color="indigo"
        />
      </section>

      {/* Operational Status */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Pending Requests"
          value={data.pendingRequests}
          subtext="Awaiting approval"
          icon={FileText}
          color="amber"
        />
        <KPICard
          title="Pending Orders"
          value={data.pendingOrders}
          subtext="Awaiting delivery"
          icon={ShoppingCart}
          color="blue"
        />
        <KPICard
          title="Delivered Orders"
          value={data.deliveredOrders}
          subtext="Successfully completed"
          icon={CheckCircle}
          color="green"
        />
        <KPICard
          title="Delayed Orders"
          value={data.delayedOrders}
          subtext="Requires attention"
          icon={Clock}
          color="red"
        />
      </section>

      {/* Performance Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Avg. Procurement Cycle"
          value={data.avgCycleTime}
          icon={Clock}
          description="From request to delivery"
        />
        <StatCard
          title="Vendor Performance"
          value={`${data.vendorPerformance}%`}
          icon={Award}
          description="Average rating"
          status="success"
        />
        <StatCard
          title="On-Time Delivery"
          value={`${data.onTimeDelivery}%`}
          icon={Truck}
          description="Supplier reliability"
          status="success"
        />
        <StatCard
          title="Quality Pass Rate"
          value={`${data.qualityPassRate}%`}
          icon={CheckCircle}
          description="Incoming QC pass rate"
          status="success"
        />
      </section>

      {/* Alerts & Risks */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-950">Alerts & Risk Indicators</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AlertCard
            type="critical"
            title="Critical Material Alerts"
            message="Materials requiring immediate attention"
            count={data.criticalAlerts}
          />
          <AlertCard
            type="warning"
            title="Supplier Risk Score"
            message={`${data.supplierRiskScore}% high-risk suppliers`}
            count={data.supplierRiskScore}
          />
          <AlertCard
            type="warning"
            title="Material Criticality"
            message="High-criticality materials in pipeline"
            count={data.materialCriticalityScore}
          />
          <AlertCard
            type="info"
            title="Production Delay Risk"
            message={`Risk Level: ${data.productionDelayRisk}`}
          />
        </div>
      </section>

      {/* Additional Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Avg. Lead Time"
          value={data.avgLeadTime}
          icon={Clock}
          description="Supplier average"
        />
        <StatCard
          title="Emergency Purchases"
          value={data.emergencyPurchases}
          icon={Zap}
          description="This month"
          status="warning"
        />
        <StatCard
          title="Batch Rejection Rate"
          value={`${data.batchRejectionRate}%`}
          icon={AlertTriangle}
          description="Quality failures"
          status={data.batchRejectionRate > 2 ? "danger" : "success"}
        />
        <StatCard
          title="Stock Health Score"
          value={`${data.stockHealth}%`}
          icon={Package}
          description="Inventory adequacy"
          status={data.stockHealth > 80 ? "success" : "warning"}
        />
      </section>

      {/* Efficiency Score */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Procurement Efficiency Score</h2>
            <p className="text-sm text-slate-600">Overall procurement performance metric</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">{data.procurementEfficiencyScore}</p>
              <p className="text-xs text-slate-500">out of 100</p>
            </div>
            <div className="relative h-16 w-16">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="3"
                  strokeDasharray={`${data.procurementEfficiencyScore}, 100`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <BarChart3 size={20} className="text-blue-600" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-600">Process Efficiency</p>
            <p className="text-lg font-bold text-slate-950">94%</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-600">Cost Efficiency</p>
            <p className="text-lg font-bold text-slate-950">89%</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-600">Time Efficiency</p>
            <p className="text-lg font-bold text-slate-950">93%</p>
          </div>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-950">Quick Overview</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Layers size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-600">Active Vendors</p>
              <p className="text-lg font-bold text-slate-950">48</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <div className="rounded-lg bg-green-50 p-2 text-green-600">
              <Activity size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-600">Orders This Month</p>
              <p className="text-lg font-bold text-slate-950">67</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-600">Avg. Approval Time</p>
              <p className="text-lg font-bold text-slate-950">2.1 hrs</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Package size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-600">Items in Pipeline</p>
              <p className="text-lg font-bold text-slate-950">234</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
