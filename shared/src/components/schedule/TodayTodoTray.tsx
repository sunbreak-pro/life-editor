import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
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
   * The Todo's real status. Read only by a host that also WRITES it (#796 —
   * see `onSetStatus`); a binary host stays on `completed`, so a status it
   * never updates cannot contradict its own checkbox.
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
  /**
   * Accessible name for opening an UNSCHEDULED row's detail (pair with
   * `onOpenAddable`). Separate from `openInTodos`: that one names where the
   * placed rows go, and since #1153 the two can be different places.
   */
  openAddable?: string;
  emptyAddable: string;
  /** Accessible name / title for the title button that jumps to Todos. */
  openInTodos: string;
  /** Accessible name for the per-row delete button (pair with onDelete). */
  delete?: string;
  /**
   * Name of what the row's checkbox sets, e.g. "Status". Required since #1368:
   * every row draws <TodoStatusCheckbox> now, including a host that only
   * writes `completed`, so no branch is left that could go without it.
   */
  status: string;
  /** Per-status copy for the row checkbox (§6.4 — already translated). */
  statusLabels: StatusLabelSet;
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
   * Write the row's `status` instead of its `completed` flag (#796), and read
   * `row.status` rather than `row.completed`. Briefing passes it so its tray
   * and its paper say the same thing about a Todo; Schedule has not asked for
   * it and keeps writing `completed`.
   *
   * What it no longer decides is how the row LOOKS. Until #1368 the branches
   * drew different boxes — a 44px status control here, a hand-rolled 20px one
   * there — which is how one todo came to wear two sizes in two panels. Both
   * draw <TodoStatusCheckbox> now; this prop only picks the field written.
   */
  onSetStatus?: (id: string, status: TodoStatus) => void;
  onOpenTodo: (id: string) => void;
  onAddCandidate: (id: string) => void;
  /**
   * Open an UNSCHEDULED row's detail (#1153). Optional, and the reason it is
   * separate from `onOpenTodo` is that the two groups answer to different
   * hosts: Schedule made this list the home of every todo that has no day yet,
   * so its rows have to be readable and editable, while Briefing's tray is a
   * staging list and leaves them as plain text. Without it the title stays a
   * <span>, exactly as before.
   */
  onOpenAddable?: (id: string) => void;
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
  openLabel: string;
  deleteLabel?: string;
  statusLabel: string;
  statusLabels: StatusLabelSet;
  allDayLabel?: string;
}) {
  /*
   * One value behind both the checkbox and the strike-through, read from the
   * field this host actually writes: a binary host's `row.status` is whatever
   * the row happened to carry, and letting it win would strike a title whose
   * own checkbox reads unchecked.
   */
  const status: TodoStatus =
    (onSetStatus ? row.status : undefined) ??
    (row.completed ? "DONE" : "NOT_STARTED");
  const done = status === "DONE";
  return (
    <li className="flex flex-col border-b border-lumen-border">
      <div className="flex items-center gap-2">
        <TodoStatusCheckbox
          status={status}
          onChange={(next) =>
            onSetStatus ? onSetStatus(row.id, next) : onToggleComplete(row.id)
          }
          labels={statusLabels}
          label={statusLabel}
        />
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
      {/* Leading control + gap-2, so the extra aligns with the title: pl-13 =
          the 44px checkbox plus the row's gap. One value since #1368 — before
          it, the two branches led with two differently sized boxes. */}
      {extra && <div className="pl-13 pb-1.5">{extra}</div>}
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
  openLabel: string;
  deleteLabel?: string;
  statusLabel: string;
  statusLabels: StatusLabelSet;
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
  onOpenAddable,
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
                {onOpenAddable ? (
                  // #1153: the same title, as the way in. A button only when
                  // the host has somewhere to open — a dead one would be worse
                  // than the plain text it replaces.
                  <button
                    type="button"
                    title={labels.openAddable}
                    onClick={() => onOpenAddable(a.id)}
                    className={cn(
                      "min-w-0 flex-1 truncate py-1.5 text-left text-sm text-lumen-text transition-colors hover:text-lumen-accent",
                      FOCUS,
                    )}
                  >
                    {a.title}
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 truncate py-1.5 text-sm text-lumen-text">
                    {a.title}
                  </span>
                )}
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
