export function StatTile({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-black/10 p-4 dark:border-white/10 ${className ?? ""}`}>
      <p className="text-sm text-black/60 dark:text-white/60">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}
