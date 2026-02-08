interface RingChartProps {
  /** Value between 0 and 1 representing the fill percentage */
  progress: number;
  /** Outer diameter in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
}

function getStrokeColor(pct: number): string {
  if (pct >= 85) return "#ef4444";
  if (pct >= 60) return "var(--color-amber)";
  return "var(--color-success)";
}

export function RingChart({
  progress,
  size = 48,
  strokeWidth = 4,
}: RingChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(progress * 100, 0), 100);
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-elevated)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={getStrokeColor(pct)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transform: "rotate(-90deg)",
          transformOrigin: "50% 50%",
          transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease",
          ["--circumference" as string]: circumference,
          ["--target-offset" as string]: offset,
        }}
      />
    </svg>
  );
}
