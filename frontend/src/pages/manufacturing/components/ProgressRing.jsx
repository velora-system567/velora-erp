const TONE_COLORS = {
  info: "#2563eb",
  positive: "#10b981",
  warning: "#f59e0b",
  negative: "#ef4444",
  slate: "#94a3b8",
};

export function ProgressRing({
  value = 0,
  max = 100,
  size = 80,
  stroke = 8,
  tone = "info",
  label,
  sublabel,
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const dashOffset = circumference * (1 - pct);
  const color = TONE_COLORS[tone] || TONE_COLORS.info;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        {label && <span className="text-sm font-bold leading-tight text-slate-950">{label}</span>}
        {sublabel && <span className="text-[10px] font-medium text-slate-500">{sublabel}</span>}
      </div>
    </div>
  );
}
