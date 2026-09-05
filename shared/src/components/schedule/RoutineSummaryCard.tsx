import { ArrowRight, Repeat } from "lucide-react";
import { cn } from "../cn";

/*
 * RoutineSummaryCard (W8 target-IA) — the Calendar-tab right pane when no
 * event is selected: a "my routines" digest + a CTA to the full repeat list
 * (the rightSidebar "繰り返し" tab since #408 retired the Routines tab). Pure
 * presentation (§3.1 / §6.4): rows + copy injected already translated, the CTA
 * is a callback. lumen-* tokens only (§5).
 *
 * #1440: the completion bar and its "N件中M件完了" line are gone. They counted
 * `completed` on today's routine-generated events, and #1373 took completion
 * away from events entirely — so the bar could only ever stay at zero (or at
 * whatever the MCP tool last wrote). Option C of the Issue: fold the readout
 * rather than invent a second meaning for it; the routine list and the CTA are
 * what the card is for.
 */

export interface RoutineSummaryRow {
  id: string;
  title: string;
  /** Already-translated time label (e.g. "7:00"). */
  timeLabel: string;
  /** Already-translated frequency label (e.g. "毎日" / "月・水・金"). */
  frequencyLabel: string;
}

export interface RoutineSummaryCardLabels {
  title: string;
  /** Shown when there are no routines. */
  empty: string;
  /** CTA to switch to the repeat list. */
  cta: string;
}

export interface RoutineSummaryCardProps {
  routines: RoutineSummaryRow[];
  labels: RoutineSummaryCardLabels;
  onOpenRoutines: () => void;
  className?: string;
}

export function RoutineSummaryCard({
  routines,
  labels,
  onOpenRoutines,
  className,
}: RoutineSummaryCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-md border border-lumen-border bg-lumen-bg-secondary p-4",
        className,
      )}
    >
      <h3 className="text-sm font-semibold text-lumen-text">{labels.title}</h3>

      {routines.length === 0 ? (
        <p className="py-4 text-center text-sm text-lumen-text-secondary">
          {labels.empty}
        </p>
      ) : (
        <ul role="list" className="flex flex-col">
          {routines.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 border-b border-lumen-border py-2 last:border-b-0"
            >
              <Repeat
                aria-hidden
                className="size-3 shrink-0 text-lumen-chip-routine-fg"
                strokeWidth={2.5}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-lumen-text">
                {r.title}
              </span>
              <span className="shrink-0 text-xs text-lumen-text-secondary">
                {r.frequencyLabel} {r.timeLabel}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onOpenRoutines}
        className="flex items-center gap-1 self-start rounded-sm text-sm font-medium text-lumen-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {labels.cta}
        <ArrowRight aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}
