export function StatCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="stat-card glass-card">
      <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className={`text-xl font-display font-bold ${accent ? "text-accent" : "text-white"}`}>
        {value}
        {unit && (
          <span className="text-xs text-gray-500 ml-1 font-mono">{unit}</span>
        )}
      </p>
    </div>
  );
}
