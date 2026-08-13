import type { ReactNode } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { cn } from "../cn";

/*
 * TodayTodoTray (schedule redesign A-3 / #298) — the rightSidebar "Today's
 * Todo" tray. Pure, presentational: it lays out today's scheduled tasks in two
 * groups — PLACED (given a time) and UNPLACED candidates (all-day / time
 * undefined, per the 案 c staging) — plus an "add from tasks" picker that turns
 * an unscheduled task into today's all-day candidate.
 *
 * Same idiom as AgendaList (Day flow): checkbox + title row, lumen-* tokens
 * only. Completion routes to the TaskTree API and the title jumps to the Tasks
 * section — both are injected callbacks (CLAUDE.md §3.1 / §6.4: no DataService,
 * no useTranslation; all copy injected already translated).
 *
 * #555 adds two optional per-row surfaces so a todo can be managed without
 * leaving the tray: a soft-delete button (onDelete — no confirm, matching the
 * Notes idiom; undo + Trash restore are the safety nets) and a renderRowExtra
 * slot under the title row, which the Schedule host fills with the web-layer
 * <TagPicker> (the tag layer stays outside this pure part).
 *
 * #795 adds `singleList`, which collapses the PLACED / UNPLACED pair into one
 * list. Briefing turns it on: "pick a todo → it lands in Candidates → it later
 * becomes Scheduled" was two names and two lists for one act. A todo with no
 * time then reads as an all-day row — AgendaList's pill in the same slot the
 * timed rows use for their clock — tinted with the chip-task family so it is
 * still tellable from an all-day EVENT. Schedule stages candidates on purpose
 * and keeps the pair.
 */

export interface TodayTodoRow {
  /** Source TaskNode id (unprefixed). */
  id: string;
  title: string;
  /** Local HH:MM start for a PLACED row; omitted for an UNPLACED (all-day) row. */
  timeLabel?: string;
  completed: boolean;
}

export interface TodayTodoAddableRow {
  id: string;
  title: string;
}

export interface TodayTodoTrayLabels {
  placedHeading: string;
  emptyPlaced: string;
  /** Second group's copy — the paired-groups layout only (not `singleList`). */
  unplacedHeading?: string;
  emptyUnplaced?: string;
  /** Marker for a row with no time, e.g. "All-day" (pair with `singleList`). */
  allDay?: string;
  addHeading: string;
  /** Accessible name for the per-task "add to today" button. */
  addAction: string;
  emptyAddable: string;
  /** Accessible name for the per-row completion toggle. */
  complete: string;
  /** Accessible name / title for the title button that jumps to Tasks. */
  openInTasks: string;
  /** Accessible name for the per-row delete button (pair with onDelete). */
  delete?: string;
}

export interface TodayTodoTrayProps {
  /** Today's scheduled tasks that have a time. */
  placed: TodayTodoRow[];
  /** Today's all-day candidates (time undefined). */
  unplaced: TodayTodoRow[];
  /** Unscheduled, incomplete leaf tasks offered for "add to today". */
  addable: TodayTodoAddableRow[];
  onToggleComplete: (id: string) => void;
  onOpenTask: (id: string) => void;
  onAddCandidate: (id: string) => void;
  /** Soft-delete the row's task (#555). Rendered only with labels.delete. */
  onDelete?: (id: string) => void;
  /** Extra content under the title row (#555 — the host's tag surface). */
  renderRowExtra?: (row: TodayTodoRow) => ReactNode;
  /**
   * Show ONE list (headed `labels.placedHeading`) instead of the placed /
   * unplaced pair (#795): time-less rows first, as all-day rows. Needs
   * labels.allDay; leaves labels.unplacedHeading / emptyUnplaced unused.
   */
  singleList?: boolean;
  labels: TodayTodoTrayLabels;
  className?: string;
}

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-inset";

function TaskRow({
  row,
  onToggleComplete,
  onOpenTask,
  onDelete,
  extra,
  completeLabel,
  openLabel,
  deleteLabel,
  allDayLabel,
}: {
  row: TodayTodoRow;
  onToggleComplete: (id: string) => void;
  onOpenTask: (id: string) => void;
  onDelete?: (id: string) => void;
  extra?: ReactNode;
  completeLabel: string;
  openLabel: string;
  deleteLabel?: string;
  allDayLabel?: string;
}) {
  return (
    <li className="flex flex-col border-b border-lumen-border">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={completeLabel}
          aria-pressed={row.completed}
          onClick={() => onToggleComplete(row.id)}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded border",
            row.completed
              ? "border-lumen-accent text-lumen-accent"
              : "border-lumen-border-strong text-transparent",
            FOCUS,
          )}
        >
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={() => onOpenTask(row.id)}
          title={openLabel}
          className={cn(
            "flex min-h-[38px] flex-1 items-center gap-2 rounded-sm py-1 text-left",
            FOCUS,
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              row.completed
                ? "text-lumen-text-secondary line-through"
                : "text-lumen-text",
            )}
          >
            {row.title}
          </span>
          {row.timeLabel ? (
            <span className="shrink-0 text-xs tabular-nums text-lumen-text-secondary">
              {row.timeLabel}
            </span>
          ) : (
            // Same pill AgendaList gives an all-day row, in the same slot the
            // timed rows use for their clock — but wearing the chip-task
            // family, so a todo with no time never reads as an all-day EVENT
            // (#795). Only on the merged list; the paired layout says
            // "unplaced" with its heading already.
            allDayLabel && (
              <span className="shrink-0 rounded border border-lumen-chip-task-dot bg-lumen-chip-task-bg px-1.5 py-0.5 text-xs font-semibold text-lumen-chip-task-fg">
                {allDayLabel}
              </span>
            )
          )}
        </button>
        {onDelete && deleteLabel && (
          <button
            type="button"
            aria-label={deleteLabel}
            title={deleteLabel}
            onClick={() => onDelete(row.id)}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-danger",
              FOCUS,
            )}
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        )}
      </div>
      {/* pl-7 = checkbox (size-5) + gap-2, so the extra aligns with the title. */}
      {extra && <div className="pb-1.5 pl-7">{extra}</div>}
    </li>
  );
}

function Group({
  heading,
  rows,
  empty,
  onToggleComplete,
  onOpenTask,
  onDelete,
  renderRowExtra,
  completeLabel,
  openLabel,
  deleteLabel,
  allDayLabel,
}: {
  heading: string;
  rows: TodayTodoRow[];
  empty: string;
  onToggleComplete: (id: string) => void;
  onOpenTask: (id: string) => void;
  onDelete?: (id: string) => void;
  renderRowExtra?: (row: TodayTodoRow) => ReactNode;
  completeLabel: string;
  openLabel: string;
  deleteLabel?: string;
  allDayLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-semibold text-lumen-text-secondary">
        {heading}
      </h4>
      {rows.length === 0 ? (
        <p className="py-2 text-center text-xs text-lumen-text-secondary">
          {empty}
        </p>
      ) : (
        <ul role="list" className="flex flex-col">
          {rows.map((row) => (
            <TaskRow
              key={row.id}
              row={row}
              onToggleComplete={onToggleComplete}
              onOpenTask={onOpenTask}
              onDelete={onDelete}
              extra={renderRowExtra?.(row)}
              completeLabel={completeLabel}
              openLabel={openLabel}
              deleteLabel={deleteLabel}
              allDayLabel={allDayLabel}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function TodayTodoTray({
  placed,
  unplaced,
  addable,
  onToggleComplete,
  onOpenTask,
  onAddCandidate,
  onDelete,
  renderRowExtra,
  singleList,
  labels,
  className,
}: TodayTodoTrayProps) {
  const shared = {
    onToggleComplete,
    onOpenTask,
    onDelete,
    renderRowExtra,
    completeLabel: labels.complete,
    openLabel: labels.openInTasks,
    deleteLabel: labels.delete,
  };
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Group
        {...shared}
        heading={labels.placedHeading}
        // Time-less first, the order every other surface files all-day items
        // in (BriefingView's schedule sort, AgendaList's two blocks).
        rows={singleList ? [...unplaced, ...placed] : placed}
        empty={labels.emptyPlaced}
        allDayLabel={singleList ? labels.allDay : undefined}
      />
      {!singleList && (
        <Group
          {...shared}
          heading={labels.unplacedHeading ?? ""}
          rows={unplaced}
          empty={labels.emptyUnplaced ?? ""}
        />
      )}
      <div className="flex flex-col gap-1.5">
        <h4 className="text-xs font-semibold text-lumen-text-secondary">
          {labels.addHeading}
        </h4>
        {addable.length === 0 ? (
          <p className="py-2 text-center text-xs text-lumen-text-secondary">
            {labels.emptyAddable}
          </p>
        ) : (
          <ul role="list" className="flex flex-col">
            {addable.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 border-b border-lumen-border"
              >
                <span className="min-w-0 flex-1 truncate py-1.5 text-sm text-lumen-text">
                  {a.title}
                </span>
                <button
                  type="button"
                  aria-label={labels.addAction}
                  onClick={() => onAddCandidate(a.id)}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-lumen-md border border-lumen-border-strong text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                    FOCUS,
                  )}
                >
                  <Plus aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
