import { mistToSui } from "@/lib/constants";

interface BudgetBarProps {
  totalSpent: bigint;
  maxBudget: bigint;
}

function getBarColor(pct: number): string {
  if (pct >= 85) return "#ef4444";
  if (pct >= 60) return "var(--color-amber)";
  return "var(--color-success)";
}

function getPctTextClass(pct: number): string {
  if (pct >= 85) return "text-red-400";
  if (pct >= 60) return "text-amber";
  return "text-accent";
}

export function BudgetBar({ totalSpent, maxBudget }: BudgetBarProps) {
  const pct =
    maxBudget > 0n ? Number((totalSpent * 100n) / maxBudget) : 0;
  const clampedPct = Math.min(pct, 100);

  const spentSui = mistToSui(totalSpent).toFixed(2);
  const budgetSui = mistToSui(maxBudget).toFixed(2);

  return (
    <div className="glass-card p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">
          Budget Utilization
        </p>
        <span className={`text-base font-mono font-bold ${getPctTextClass(pct)}`}>
          {spentSui} / {budgetSui} SUI ({pct}%)
        </span>
      </div>
      <div
        className="budget-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Budget usage: ${pct}% spent`}
      >
        <div
          className="budget-bar-fill"
          style={{
            width: `${clampedPct}%`,
            background: getBarColor(pct),
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s ease",
          }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs font-mono text-gray-600">
        <span>0 SUI</span>
        <span>{budgetSui} SUI</span>
      </div>
    </div>
  );
}
