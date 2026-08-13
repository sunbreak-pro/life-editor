import type { ReactNode } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import type { TaskStatus } from "../../types/taskTree";
import { cn } from "../cn";
import { TaskStatusCycleButton } from "../TaskStatusCycleButton";
import type { StatusLabelSet } from "../taskStatusVisuals";

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
 */

export interface TodayTodoRow {
  /** Source TaskNode id (unprefixed). */
  id: string;
  title: string;
  /** Local HH:MM start for a PLACED row; omitted for an UNPLACED (all-day) row. */
  timeLabel?: string;
  completed: boolean;
  /**
   * The Todo's real status. Only read on the three-status branch (#796 — see
   * `onSetStatus`); the binary branch keeps using `completed`.
   */
  status?: TaskStatus;
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
  /** Accessible name for the per-row delete button (pair with onDelete). */
  delete?: string;
  /** Name of what the status control sets, e.g. "Status" (pair with onSetStatus). */
  status?: string;
  /** Per-status copy for the status control (pair with onSetStatus). */
  statusLabels?: StatusLabelSet;
}

export interface TodayTodoTrayProps {
  /** Today's scheduled tasks that have a time. */
  placed: TodayTodoRow[];
  /** Today's all-day candidates (time undefined). */
  unplaced: TodayTodoRow[];
  /** Unscheduled, incomplete leaf tasks offered for "add to today". */
  addable: TodayTodoAddableRow[];
  onToggleComplete: (id: string) => void;
  /**
   * Opt in to the three-status control (#796): rows render
   * <TaskStatusCycleButton> over `row.status` instead of the binary checkbox,
   * and this receives the status the press lands on. Briefing passes it so its
   * tray and its paper say the same thing about a Todo; Schedule has not asked
   * for it and keeps the checkbox until it does. Needs labels.status +
   * labels.statusLabels.
   */
  onSetStatus?: (id: string, status: TaskStatus) => void;
  onOpenTask: (id: string) => void;
  onAddCandidate: (id: string) => void;
  /** Soft-delete the row's task (#555). Rendered only with labels.delete. */
  onDelete?: (id: string) => void;
  /** Extra content under the title row (#555 — the host's tag surface). */
  renderRowExtra?: (row: TodayTodoRow) => ReactNode;
  labels: TodayTodoTrayLabels;
  className?: string;
}

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-inset";

function TaskRow({
  row,
  onToggleComplete,
  onSetStatus,
  onOpenTask,
  onDelete,
  extra,
  completeLabel,
  openLabel,
  deleteLabel,
  statusLabel,
  statusLabels,
}: {
  row: TodayTodoRow;
  onToggleComplete: (id: string) => void;
  onSetStatus?: (id: string, status: TaskStatus) => void;
  onOpenTask: (id: string) => void;
  onDelete?: (id: string) => void;
  extra?: ReactNode;
  completeLabel: string;
  openLabel: string;
  deleteLabel?: string;
  statusLabel?: string;
  statusLabels?: StatusLabelSet;
}) {
  const done = row.status === undefined ? row.completed : row.status === "DONE";
  return (
    <li className="flex flex-col border-b border-lumen-border">
      <div className="flex items-center gap-2">
        {onSetStatus && statusLabel && statusLabels ? (
          <TaskStatusCycleButton
            status={row.status ?? (row.completed ? "DONE" : "NOT_STARTED")}
            onChange={(next) => onSetStatus(row.id, next)}
            labels={statusLabels}
            label={statusLabel}
          />
        ) : (
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
        )}
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
              done
                ? "text-lumen-text-secondary line-through"
                : "text-lumen-text",
            )}
          >
            {row.title}
          </span>
          {row.timeLabel && (
            <span className="shrink-0 text-xs tabular-nums text-lumen-text-secondary">
              {row.timeLabel}
            </span>
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
      {/* Leading control + gap-2, so the extra aligns with the title: pl-7 for
          the size-5 checkbox, pl-13 for the 44px status button (#796). */}
      {extra && (
        <div className={cn("pb-1.5", onSetStatus ? "pl-13" : "pl-7")}>
          {extra}
        </div>
      )}
    </li>
  );
}

function Group({
  heading,
  rows,
  empty,
  onToggleComplete,
  onSetStatus,
  onOpenTask,
  onDelete,
  renderRowExtra,
  completeLabel,
  openLabel,
  deleteLabel,
  statusLabel,
  statusLabels,
}: {
  heading: string;
  rows: TodayTodoRow[];
  empty: string;
  onToggleComplete: (id: string) => void;
  onSetStatus?: (id: string, status: TaskStatus) => void;
  onOpenTask: (id: string) => void;
  onDelete?: (id: string) => void;
  renderRowExtra?: (row: TodayTodoRow) => ReactNode;
  completeLabel: string;
  openLabel: string;
  deleteLabel?: string;
  statusLabel?: string;
  statusLabels?: StatusLabelSet;
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
              onSetStatus={onSetStatus}
              onOpenTask={onOpenTask}
              onDelete={onDelete}
              extra={renderRowExtra?.(row)}
              completeLabel={completeLabel}
              openLabel={openLabel}
              deleteLabel={deleteLabel}
              statusLabel={statusLabel}
              statusLabels={statusLabels}
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
  onSetStatus,
  onOpenTask,
  onAddCandidate,
  onDelete,
  renderRowExtra,
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
        onSetStatus={onSetStatus}
        onOpenTask={onOpenTask}
        onDelete={onDelete}
        renderRowExtra={renderRowExtra}
        completeLabel={labels.complete}
        openLabel={labels.openInTasks}
        deleteLabel={labels.delete}
        statusLabel={labels.status}
        statusLabels={labels.statusLabels}
      />
      <Group
        heading={labels.unplacedHeading}
        rows={unplaced}
        empty={labels.emptyUnplaced}
        onToggleComplete={onToggleComplete}
        onSetStatus={onSetStatus}
        onOpenTask={onOpenTask}
        onDelete={onDelete}
        renderRowExtra={renderRowExtra}
        completeLabel={labels.complete}
        openLabel={labels.openInTasks}
        deleteLabel={labels.delete}
        statusLabel={labels.status}
        statusLabels={labels.statusLabels}
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
