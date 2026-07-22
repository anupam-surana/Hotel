// Fill carries the accent hue; the unfilled track is a lighter step of the
// same ramp (blue-on-blue) so the state reads across the whole bar.
export function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <p className="text-sm text-ink/60 dark:text-sand/60">{label}</p>
        <p className="text-sm font-semibold">{pct}%</p>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-500/15">
        <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
