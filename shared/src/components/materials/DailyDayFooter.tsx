import { Star } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING_TIGHT } from "../styleTokens";

/*
 * The strip under the Daily body (#2123, D-20261006-main-7): the day's mood
 * stars and its four figures — events, todo rate, work time, goals moved.
 * Nothing else sits under the body any more: the evening card of #1046 /
 * #1680 (mood + a separate reflection + the day's schedule) went when the
 * Daily body became the day's ONE text, which already holds the reflection.
 *
 * The stars are the evening paper's: tap one to set it, tap the lit one to
 * clear (the host decides that and publishes the day). The figures arrive as
 * ready-made strings, so the counting and the units stay with the host.
 *
 * Pure presentation (§6.4): no DataService, no useTranslation. lumen-* tokens
 * only, opaque surface; 朱 (lumen-briefing-shu) marks the lit stars as on the
 * papers.
 */

export interface DailyDayFigure {
  id: string;
  label: string;
  value: string;
}

export interface DailyDayFooterLabels {
  /** Group name of the star row —「今日の気分」. */
  moodGroup: string;
  /** Accessible name of each star, index 0 =「気分 1/5」etc. */
  moodStars: string[];
  /** Accessible name of the figures list. */
  figuresGroup: string;
}

export interface DailyDayFooterProps {
  /** Mood 1–5, null when the day has none. */
  mood: number | null;
  /** Receives the star pressed. */
  onSelectMood: (mood: number) => void;
  /** [] while the figures load — the row is then left out. */
  figures: DailyDayFigure[];
  labels: DailyDayFooterLabels;
  className?: string;
}

const MOOD_STAR_BUTTON =
  "inline-flex items-center justify-center rounded-lumen-sm p-0.5 transition-colors max-md:min-h-11 max-md:min-w-11";

export function DailyDayFooter({
  mood,
  onSelectMood,
  figures,
  labels,
  className,
}: DailyDayFooterProps): React.JSX.Element {
  return (
    <section
      data-testid="daily-day-footer"
      className={cn(
        "mt-3 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary px-5 py-3 shadow-lumen-sm",
        className,
      )}
    >
      {/* flex-wrap: five 44px stars do not fit one line under a large root
          font size, and a second line is still reachable (#1722). */}
      <div
        role="group"
        aria-label={labels.moodGroup}
        className="flex flex-wrap items-center gap-0.5"
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = mood !== null && n <= mood;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onSelectMood(n)}
              aria-label={labels.moodStars[n - 1]}
              aria-pressed={mood === n}
              className={cn(
                MOOD_STAR_BUTTON,
                FOCUS_RING_TIGHT,
                filled
                  ? "text-lumen-briefing-shu"
                  : "text-lumen-text-tertiary hover:text-lumen-briefing-shu",
              )}
            >
              <Star
                size={15}
                aria-hidden="true"
                fill={filled ? "currentColor" : "none"}
              />
            </button>
          );
        })}
      </div>
      {figures.length > 0 && (
        <dl
          aria-label={labels.figuresGroup}
          className="flex flex-wrap items-baseline gap-x-5 gap-y-1"
        >
          {figures.map((f) => (
            <div key={f.id} className="flex items-baseline gap-1.5">
              <dt className="text-xs text-lumen-text-secondary">{f.label}</dt>
              <dd className="text-sm font-semibold tabular-nums text-lumen-text">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
