import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING } from "../styleTokens";

/*
 * The Daily panel's month calendar (#2588). It replaced the hidden native date
 * input that was the panel's only way to reach a day with nothing written yet:
 * the input showed one date and nothing else, so the panel could not say which
 * days of the month had an entry.
 *
 * Pure presentation like the panel around it (§6.4): every string is already
 * translated, the date maths that needs a locale (month heading, day names)
 * stays host-side, and the only state here is which month is on screen.
 */

export interface DailyMonthCalendarProps {
  /** The open day (YYYY-MM-DD). Its month is the one shown first. */
  selectedDate: string;
  /** Today (YYYY-MM-DD), drawn with a ring. */
  today: string;
  /** Days that carry an entry (YYYY-MM-DD), drawn with a dot. */
  markedDates: ReadonlySet<string>;
  onSelectDate: (date: string) => void;
  /** Seven already-translated day names, Sunday first. */
  weekdayLabels: readonly string[];
  /** Already-translated month heading, e.g. "2026年10月". `month` is 1-12. */
  formatMonthLabel: (year: number, month: number) => string;
  /** Already-translated name of a day button, e.g. "10月3日（金）、記録あり". */
  formatDayLabel: (date: string, marked: boolean) => string;
  /** Already-translated name of the whole calendar region. */
  label: string;
  prevMonthLabel: string;
  nextMonthLabel: string;
  className?: string;
}

const pad = (n: number): string => String(n).padStart(2, "0");

function monthOf(date: string): { year: number; month: number } {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}

export function DailyMonthCalendar({
  selectedDate,
  today,
  markedDates,
  onSelectDate,
  weekdayLabels,
  formatMonthLabel,
  formatDayLabel,
  label,
  prevMonthLabel,
  nextMonthLabel,
  className,
}: DailyMonthCalendarProps) {
  const [shown, setShown] = useState(() => monthOf(selectedDate));
  // A day opened from outside the calendar (a link, the entry list, "today")
  // brings its month into view; paging by hand does not move the selection.
  // Adjusted during render rather than in an effect, so the old month never
  // paints for a frame.
  const [followed, setFollowed] = useState(selectedDate);
  if (followed !== selectedDate) {
    setFollowed(selectedDate);
    setShown(monthOf(selectedDate));
  }

  const { year, month } = shown;
  const leadingBlanks = new Date(year, month - 1, 1).getDay();
  const dayCount = new Date(year, month, 0).getDate();

  const page = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setShown({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  const navButton =
    "inline-flex size-8 shrink-0 items-center justify-center rounded-lumen-sm text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text max-md:size-11";

  return (
    <section aria-label={label} className={cn("flex flex-col", className)}>
      <div className="mb-1 flex items-center gap-1">
        <button
          type="button"
          aria-label={prevMonthLabel}
          title={prevMonthLabel}
          onClick={() => page(-1)}
          className={cn(navButton, FOCUS_RING)}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <h3 className="m-0 flex-1 text-center text-sm font-semibold tabular-nums text-lumen-text">
          {formatMonthLabel(year, month)}
        </h3>
        <button
          type="button"
          aria-label={nextMonthLabel}
          title={nextMonthLabel}
          onClick={() => page(1)}
          className={cn(navButton, FOCUS_RING)}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7" aria-hidden>
        {weekdayLabels.map((name) => (
          <span
            key={name}
            className="py-1 text-center text-[11px] text-lumen-text-tertiary"
          >
            {name}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden />
        ))}
        {Array.from({ length: dayCount }, (_, i) => {
          const date = `${year}-${pad(month)}-${pad(i + 1)}`;
          const selected = date === selectedDate;
          const isToday = date === today;
          const marked = markedDates.has(date);
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              aria-label={formatDayLabel(date, marked)}
              aria-pressed={selected}
              aria-current={isToday ? "date" : undefined}
              onClick={() => onSelectDate(date)}
              className={cn(
                "flex h-[2.125rem] flex-col items-center justify-center gap-px rounded-lumen-sm max-md:h-11",
                FOCUS_RING,
              )}
            >
              <span
                className={cn(
                  "inline-flex size-[1.625rem] items-center justify-center rounded-full text-xs tabular-nums",
                  selected
                    ? "bg-lumen-accent font-bold text-lumen-on-accent"
                    : isToday
                      ? "font-bold text-lumen-accent ring-1 ring-inset ring-lumen-accent"
                      : "text-lumen-text",
                )}
              >
                {i + 1}
              </span>
              <span
                aria-hidden
                data-testid={marked ? "daily-calendar-dot" : undefined}
                className={cn(
                  "size-1 rounded-full",
                  marked ? "bg-lumen-accent" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
