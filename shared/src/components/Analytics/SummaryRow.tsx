/*
 * Shared label/value row for the Overview summary cards (Today / Weekly).
 * A full-width row never wraps its value regardless of locale — ja duration
 * strings like 「12時間34分」 need ~90px+, which the previous 3-col mini grid
 * could not guarantee inside a 1000px dashboard column (#182).
 */
export function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-lumen-text-secondary">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-lumen-text">
        {value}
      </span>
    </div>
  );
}
