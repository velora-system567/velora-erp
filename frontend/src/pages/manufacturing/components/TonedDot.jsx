const TONE_CLASSES = {
  positive: "bg-emerald-500",
  negative: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  slate: "bg-slate-400",
};

export function TonedDot({ tone = "slate", size = "h-2 w-2" }) {
  return (
    <span
      className={`inline-block rounded-full shrink-0 ${size} ${TONE_CLASSES[tone] || TONE_CLASSES.slate}`}
    />
  );
}
