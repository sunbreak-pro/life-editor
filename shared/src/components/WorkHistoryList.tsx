import { Clock } from "lucide-react";
import { TagPill } from "./TagPill";
import { cn } from "./cn";
import {
  workTargetChipClass,
  workTargetIcon,
  type WorkTargetOption,
} from "./PomodoroTodoSelector";

/*
 * WorkHistoryList — the "history" tab of the Work sidebar (#1666). One row per
 * WORK session of a single day: its time range, how long it ran, what it was
 * measured against and that item's tags.
 *
 * Pure primitive (§6.4): the host picks the day, resolves every title and tag,
 * and formats the times and durations in the user's locale. Nothing here reads
 * a clock or a DataService, so the list draws the same rows in a test as it
 * does on screen.
 *
 * The target chip reuses the selector's colour pairing (task blue / event
 * purple) so a row reads as "the same thing you picked up there". A session
 * with no target keeps a neutral label instead of an empty gap — "worked on
 * nothing in particular" is an answer, not a missing value.
 */

export interface WorkHistoryTag {
  id: string;
  name: string;
  color: string | null;
  icon?: string | null;
}

export interface WorkHistoryEntry {
  /** Stable row key — the session id. */
  id: string;
  /** Already-formatted "09:00–09:25". */
  timeRange: string;
  /** Already-formatted "25 min". */
  durationLabel: string;
  /** The linked item, or null when the session named none. */
  target: { kind: WorkTargetOption["kind"]; title: string } | null;
  tags: WorkHistoryTag[];
}

export interface WorkHistoryListLabels {
  /** Heading above the rows — the host's formatted day ("Today" / "Sep 16"). */
  heading: string;
  /** Shown instead of the rows when nothing has ever been worked. */
  empty: string;
  /** Chip text for a session with no linked item. */
  noTarget: string;
  /** Accessible name of the list. */
  listLabel: string;
}

export interface WorkHistoryListProps {
  entries: WorkHistoryEntry[];
  labels: WorkHistoryListLabels;
  /** Skeleton rows while the host's first read is in flight. */
  loading?: boolean;
  className?: string;
}

export function WorkHistoryList({
  entries,
  labels,
  loading = false,
  className,
}: WorkHistoryListProps) {
  if (loading) {
    return (
      <div className={cn("flex flex-col gap-2", className)} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-14 rounded-lumen-md bg-lumen-surface-sunken"
          />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p
        className={cn("text-sm text-lumen-text-secondary", className)}
        data-testid="work-history-empty"
      >
        {labels.empty}
      </p>
    );
  }

  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h3 className="text-xs font-medium text-lumen-text-secondary">
        {labels.heading}
      </h3>
      <ul className="flex flex-col gap-2" aria-label={labels.listLabel}>
        {entries.map((entry) => (
          <li
            key={entry.id}
            data-testid="work-history-row"
            className="flex flex-col gap-1.5 rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-lumen-text">
                <Clock
                  size={13}
                  aria-hidden="true"
                  className="text-lumen-text-secondary"
                />
                {entry.timeRange}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-lumen-text-secondary">
                {entry.durationLabel}
              </span>
            </div>
            {entry.target ? (
              <span
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 self-start rounded-lumen-sm px-2 py-0.5 text-xs font-medium",
                  workTargetChipClass(entry.target.kind),
                )}
              >
                <span className="shrink-0">
                  {workTargetIcon(entry.target.kind, 12)}
                </span>
                <span className="truncate">{entry.target.title}</span>
              </span>
            ) : (
              <span className="self-start text-xs text-lumen-text-secondary">
                {labels.noTarget}
              </span>
            )}
            {entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {entry.tags.map((tag) => (
                  <TagPill
                    key={tag.id}
                    name={tag.name}
                    color={tag.color}
                    icon={tag.icon ?? null}
                  />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
