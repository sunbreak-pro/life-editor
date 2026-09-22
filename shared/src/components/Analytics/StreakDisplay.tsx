import { useMemo } from "react";
import { Flame, Trophy } from "lucide-react";
import type { TimerSession } from "../../types/timer";
import { computeWorkStreak } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";

export interface StreakDisplayLabels {
  title: string;
  current: string;
  longest: string;
  /**
   * The unit beside a streak's number, for THAT number (#1823).
   *
   * A function and not a string, because English says「1 day」and「2 days」and
   * this widget is the only thing that knows which. It used to take the fixed
   * word「days」, so a one-day streak read "1 days" in en — ja was unaffected,
   * having a single plural form, which is why it survived. The host resolves
   * it through i18next's own plural (`t("analytics.streak.days", { count })`),
   * the same way TagHub's `formatCount` resolves its own; §6.4 keeps
   * `useTranslation` out of shared UI.
   *
   * It returns the UNIT ALONE, not「1 day」: the number and the unit are drawn
   * as two spans at two type sizes (#1467 / #1863), and folding the count into
   * the string would collapse them into one.
   */
  formatDays: (count: number) => string;
  noStreak: string;
}

interface StreakDisplayProps {
  sessions: TimerSession[];
  labels: StreakDisplayLabels;
}

/*
 * The value line of a tile: the count, then its unit (#1863).
 *
 * #1467 put `truncate` on this whole line to stop it wrapping, which also made
 * the COUNT ellipsis-able: with the detail panel open the tiles narrow and the
 * en card read "1… / Lon…" — the number, the one thing the card is for, gone.
 * The line still cannot wrap (`whitespace-nowrap`), but only the unit is
 * allowed to give way: the count is `flex-shrink-0`, the unit truncates.
 */
const STREAK_VALUE_LINE =
  "flex min-w-0 items-baseline whitespace-nowrap text-lg font-semibold tabular-nums text-lumen-text";
const STREAK_UNIT =
  "ml-1 min-w-0 truncate text-xs font-normal text-lumen-text-secondary";

export function StreakDisplay({
  sessions,
  labels,
}: StreakDisplayProps): React.JSX.Element {
  const streak = useMemo(() => computeWorkStreak(sessions), [sessions]);

  if (streak.currentStreak === 0 && streak.longestStreak === 0) {
    return (
      <ChartCard title={labels.title}>
        <p className="py-2 text-center text-sm text-lumen-text-secondary">
          {labels.noStreak}
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={labels.title}>
      {/* The unit rides with the number, not with the label (#1467). The two
          tiles are not equally wide: the right one spends 13px of its column on
          the divider it draws (`border-l` + `pl-3`), so in the ~320px detail
          panel「最長 (日)」ran out of room and broke after「最長」while
         「現在 (日)」stayed on one line — and because the row centres its
          contents, a label of two lines pushed its number up out of line with
          its neighbour's. A label of one word has nothing to break after, and
          `truncate` keeps that true however narrow the user drags the panel. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-lumen-md bg-lumen-chip-progress-bg text-lumen-chip-progress-fg">
            <Flame size={18} />
          </span>
          <div className="min-w-0">
            <p className={STREAK_VALUE_LINE}>
              <span className="flex-shrink-0">{streak.currentStreak}</span>
              <span className={STREAK_UNIT}>
                {labels.formatDays(streak.currentStreak)}
              </span>
            </p>
            <p className="truncate text-xs text-lumen-text-secondary">
              {labels.current}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-l border-lumen-border pl-3">
          <span className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-lumen-md bg-lumen-chip-mint-bg text-lumen-chip-mint-fg">
            <Trophy size={18} />
          </span>
          <div className="min-w-0">
            <p className={STREAK_VALUE_LINE}>
              <span className="flex-shrink-0">{streak.longestStreak}</span>
              <span className={STREAK_UNIT}>
                {labels.formatDays(streak.longestStreak)}
              </span>
            </p>
            <p className="truncate text-xs text-lumen-text-secondary">
              {labels.longest}
            </p>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
