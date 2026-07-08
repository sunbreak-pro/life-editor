import { cn } from "../cn";

export interface DateStripDay {
  /** YYYY-MM-DD — the stable identifier + onSelect payload. */
  date: string;
  /** Already-translated weekday label (e.g. "月"). */
  weekdayLabel: string;
  /** Already-translated day label (e.g. "7/5"). */
  dayLabel: string;
  /** Whether an entry exists for this day (drives the dot). */
  hasEntry: boolean;
}

export interface DateStripProps {
  days: DateStripDay[];
  /** Currently selected date (matches a DateStripDay.date). */
  selectedDate: string;
  onSelect: (date: string) => void;
  /** Already-translated accessible name for the group (§6.4). */
  label?: string;
  className?: string;
}

/*
 * Daily Mobile date chip row (brief). Equal-width chips (weekday 10px tertiary
 * + day 14px semibold + a 4px entry dot). The selected chip fills with accent
 * (on-accent ink + dot); unselected dots are accent when an entry exists and
 * transparent otherwise. The row scrolls horizontally when the days overflow.
 * Date math stays host-side — this only renders the given days. Pure
 * presentation: labels injected (§6.4), lumen-* tokens only (§5).
 */
export function DateStrip({
  days,
  selectedDate,
  onSelect,
  label,
  className,
}: DateStripProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex gap-1.5 overflow-x-auto", className)}
    >
      {days.map((day) => {
        const selected = day.date === selectedDate;
        return (
          <button
            key={day.date}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(day.date)}
            className={cn(
              "flex min-w-[44px] flex-1 flex-col items-center gap-1 rounded-lumen-md border px-1.5 py-2",
              "transition-colors focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-lumen-accent",
              selected
                ? "border-lumen-accent bg-lumen-accent text-lumen-on-accent"
                : "border-lumen-border bg-lumen-bg text-lumen-text hover:bg-lumen-hover",
            )}
          >
            <span
              className={cn(
                "text-[10px] leading-none",
                selected ? "text-lumen-on-accent" : "text-lumen-text-tertiary",
              )}
            >
              {day.weekdayLabel}
            </span>
            <span className="text-sm font-semibold leading-none">
              {day.dayLabel}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "h-1 w-1 rounded-lumen-full",
                selected
                  ? "bg-lumen-on-accent"
                  : day.hasEntry
                    ? "bg-lumen-accent"
                    : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
