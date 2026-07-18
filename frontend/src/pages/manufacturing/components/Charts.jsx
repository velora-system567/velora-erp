import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer,
} from "recharts";

/**
 * Planned vs Actual bar/area chart for today's production.
 */
export function PlannedVsActualChart({ data = [], height = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="plannedGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="actualGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          formatter={(v, name) => [Number(v).toLocaleString("en-IN"), name === "planned" ? "Planned" : "Actual"]}
        />
        <Area type="monotone" dataKey="planned" stroke="#94a3b8" strokeWidth={1.5} fill="url(#plannedGrad)" />
        <Area type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2} fill="url(#actualGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * OEE trend sparkline.
 */
export function OeeTrendChart({ data = [], height = 120 }) {
  const chartData = data.map((v, i) => ({ i, oee: v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
        <XAxis dataKey="i" hide />
        <YAxis domain={[60, 100]} hide />
        <Tooltip formatter={(v) => [`${v}%`, "OEE"]} />
        <Line
          type="monotone"
          dataKey="oee"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
