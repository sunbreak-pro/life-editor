import { Check, Plus } from "lucide-react";
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
  unplacedHeading: string;
  emptyPlaced: string;
  emptyUnplaced: string;
  addHeading: string;
  /** Accessible name for the per-task "add to today" button. */
  addAction: string;
  emptyAddable: string;
  /** Accessible name for the per-row completion toggle. */
  complete: string;
  /** Accessible name / title for the title button that jumps to Tasks. */
  openInTasks: string;
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
  labels: TodayTodoTrayLabels;
  className?: string;
}

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-inset";

function TaskRow({
  row,
  onToggleComplete,
  onOpenTask,
  completeLabel,
  openLabel,
}: {
  row: TodayTodoRow;
  onToggleComplete: (id: string) => void;
  onOpenTask: (id: string) => void;
  completeLabel: string;
  openLabel: string;
}) {
  return (
    <li className="flex items-center gap-2 border-b border-lumen-border">
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
        {row.timeLabel && (
          <span className="shrink-0 text-[11px] tabular-nums text-lumen-text-secondary">
            {row.timeLabel}
          </span>
        )}
      </button>
    </li>
  );
}

function Group({
  heading,
  rows,
  empty,
  onToggleComplete,
  onOpenTask,
  completeLabel,
  openLabel,
}: {
  heading: string;
  rows: TodayTodoRow[];
  empty: string;
  onToggleComplete: (id: string) => void;
  onOpenTask: (id: string) => void;
  completeLabel: string;
  openLabel: string;
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
              completeLabel={completeLabel}
              openLabel={openLabel}
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
  labels,
  className,
}: TodayTodoTrayProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Group
        heading={labels.placedHeading}
        rows={placed}
        empty={labels.emptyPlaced}
        onToggleComplete={onToggleComplete}
        onOpenTask={onOpenTask}
        completeLabel={labels.complete}
        openLabel={labels.openInTasks}
      />
      <Group
        heading={labels.unplacedHeading}
        rows={unplaced}
        empty={labels.emptyUnplaced}
        onToggleComplete={onToggleComplete}
        onOpenTask={onOpenTask}
        completeLabel={labels.complete}
        openLabel={labels.openInTasks}
      />
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
