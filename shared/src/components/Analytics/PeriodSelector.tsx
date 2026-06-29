export type Period = "day" | "week" | "month";

export interface PeriodSelectorLabels {
  day: string;
  week: string;
  month: string;
}

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  labels: PeriodSelectorLabels;
}

const PERIODS: Period[] = ["day", "week", "month"];

export function PeriodSelector({
  value,
  onChange,
  labels,
}: PeriodSelectorProps): React.JSX.Element {
  return (
    <div className="flex gap-1 bg-ink-bg-secondary rounded-lg p-1 border border-ink-border">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === p
              ? "bg-ink-accent text-ink-on-accent shadow-sm"
              : "text-ink-text-secondary hover:text-ink-text hover:bg-ink-hover"
          }`}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  );
}
