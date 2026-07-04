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
    <div className="flex gap-1 bg-lumen-bg-secondary rounded-lg p-1 border border-lumen-border">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === p
              ? "bg-lumen-accent text-lumen-on-accent shadow-sm"
              : "text-lumen-text-secondary hover:text-lumen-text hover:bg-lumen-hover"
          }`}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  );
}
