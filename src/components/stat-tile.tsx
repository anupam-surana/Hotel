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
    <div className={`rounded-2xl border border-ink/10 p-4 dark:border-sand/10 ${className ?? ""}`}>
      <p className="text-sm text-ink/60 dark:text-sand/60">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}
