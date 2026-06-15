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
    <div className="flex gap-1 bg-notion-bg-secondary rounded-lg p-1 border border-notion-border">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === p
              ? "bg-notion-accent text-notion-on-accent shadow-sm"
              : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
          }`}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  );
}
