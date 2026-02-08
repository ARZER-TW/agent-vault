import { RingChart } from "@/components/ui/ring-chart";

export function StatCard({
  label,
  value,
  unit,
  accent,
  ringProgress,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
  /** Optional 0-1 value to show a ring chart beside the stat */
  ringProgress?: number;
}) {
  return (
    <div className="stat-card glass-card">
      <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex items-center gap-3">
        {ringProgress !== undefined && (
          <RingChart progress={ringProgress} size={40} strokeWidth={3} />
        )}
        <p className={`text-2xl font-display font-bold ${accent ? "text-accent" : "text-white"}`}>
          {value}
          {unit && (
            <span className="text-sm text-gray-500 ml-1 font-mono">{unit}</span>
          )}
        </p>
      </div>
    </div>
  );
}
