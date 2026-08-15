import type { ReactNode } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import type { TodoStatus } from "../../types/todoTree";
import { cn } from "../cn";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import type { StatusLabelSet } from "../todoStatusVisuals";

/*
 * TodayTodoTray (schedule redesign A-3 / #298) — the rightSidebar "Today's
 * Todo" tray. Pure, presentational: it lays out today's scheduled todos in two
 * groups — PLACED (given a time) and UNPLACED candidates (all-day / time
 * undefined, per the 案 c staging) — plus an "add from todos" picker that turns
 * an unscheduled todo into today's all-day candidate.
 *
 * Same idiom as AgendaList (Day flow): checkbox + title row, lumen-* tokens
 * only. Completion routes to the TodoTree API and the title jumps to the Todos
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
 * timed rows use for their clock — tinted with the chip-todo family so it is
 * still tellable from an all-day EVENT. Schedule stages candidates on purpose
 * and keeps the pair.
 */

export interface TodayTodoRow {
  /** Source TodoNode id (unprefixed). */
  id: string;
  title: string;
  /** Local HH:MM start for a PLACED row; omitted for an UNPLACED (all-day) row. */
  timeLabel?: string;
  completed: boolean;
  /**
   * The Todo's real status. Only read on the three-status branch (#796 — see
   * `onSetStatus`); the binary branch keeps using `completed`.
   */
  status?: TodoStatus;
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
  /** Accessible name for the per-todo "add to today" button. */
  addAction: string;
  emptyAddable: string;
  /** Accessible name for the per-row completion toggle. */
  complete: string;
  /** Accessible name / title for the title button that jumps to Todos. */
  openInTodos: string;
  /** Accessible name for the per-row delete button (pair with onDelete). */
  delete?: string;
  /** Name of what the status control sets, e.g. "Status" (pair with onSetStatus). */
  status?: string;
  /** Per-status copy for the status control (pair with onSetStatus). */
  statusLabels?: StatusLabelSet;
}

export interface TodayTodoTrayProps {
  /** Today's scheduled todos that have a time. */
  placed: TodayTodoRow[];
  /** Today's all-day candidates (time undefined). */
  unplaced: TodayTodoRow[];
  /** Unscheduled, incomplete leaf todos offered for "add to today". */
  addable: TodayTodoAddableRow[];
  onToggleComplete: (id: string) => void;
  /**
   * Write the row's `status` instead of its `completed` flag (#796): rows
   * render <TodoStatusCheckbox> over `row.status`, and this receives the status
   * the press lands on. Briefing passes it so its tray and its paper say the
   * same thing about a Todo; Schedule has not asked for it and keeps its own
   * checkbox until it does. Needs labels.status + labels.statusLabels.
   *
   * Both branches are binary since #873 — what still separates them is which
   * field the press writes, not how many values it offers.
   */
  onSetStatus?: (id: string, status: TodoStatus) => void;
  onOpenTodo: (id: string) => void;
  onAddCandidate: (id: string) => void;
  /** Soft-delete the row's todo (#555). Rendered only with labels.delete. */
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

function TodoRow({
  row,
  onToggleComplete,
  onSetStatus,
  onOpenTodo,
  onDelete,
  extra,
  completeLabel,
  openLabel,
  deleteLabel,
  statusLabel,
  statusLabels,
  allDayLabel,
}: {
  row: TodayTodoRow;
  onToggleComplete: (id: string) => void;
  onSetStatus?: (id: string, status: TodoStatus) => void;
  onOpenTodo: (id: string) => void;
  onDelete?: (id: string) => void;
  extra?: ReactNode;
  completeLabel: string;
  openLabel: string;
  deleteLabel?: string;
  statusLabel?: string;
  statusLabels?: StatusLabelSet;
  allDayLabel?: string;
}) {
  const done = row.status === undefined ? row.completed : row.status === "DONE";
  return (
    <li className="flex flex-col border-b border-lumen-border">
      <div className="flex items-center gap-2">
        {onSetStatus && statusLabel && statusLabels ? (
          <TodoStatusCheckbox
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
          onClick={() => onOpenTodo(row.id)}
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
          {row.timeLabel ? (
            <span className="shrink-0 text-xs tabular-nums text-lumen-text-secondary">
              {row.timeLabel}
            </span>
          ) : (
            // Same pill AgendaList gives an all-day row, in the same slot the
            // timed rows use for their clock — but wearing the chip-todo
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
  onOpenTodo,
  onDelete,
  renderRowExtra,
  completeLabel,
  openLabel,
  deleteLabel,
  statusLabel,
  statusLabels,
  allDayLabel,
}: {
  heading: string;
  rows: TodayTodoRow[];
  empty: string;
  onToggleComplete: (id: string) => void;
  onSetStatus?: (id: string, status: TodoStatus) => void;
  onOpenTodo: (id: string) => void;
  onDelete?: (id: string) => void;
  renderRowExtra?: (row: TodayTodoRow) => ReactNode;
  completeLabel: string;
  openLabel: string;
  deleteLabel?: string;
  statusLabel?: string;
  statusLabels?: StatusLabelSet;
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
            <TodoRow
              key={row.id}
              row={row}
              onToggleComplete={onToggleComplete}
              onSetStatus={onSetStatus}
              onOpenTodo={onOpenTodo}
              onDelete={onDelete}
              extra={renderRowExtra?.(row)}
              completeLabel={completeLabel}
              openLabel={openLabel}
              deleteLabel={deleteLabel}
              statusLabel={statusLabel}
              statusLabels={statusLabels}
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
  onSetStatus,
  onOpenTodo,
  onAddCandidate,
  onDelete,
  renderRowExtra,
  singleList,
  labels,
  className,
}: TodayTodoTrayProps) {
  const shared = {
    onToggleComplete,
    onSetStatus,
    onOpenTodo,
    onDelete,
    renderRowExtra,
    completeLabel: labels.complete,
    openLabel: labels.openInTodos,
    deleteLabel: labels.delete,
    statusLabel: labels.status,
    statusLabels: labels.statusLabels,
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
