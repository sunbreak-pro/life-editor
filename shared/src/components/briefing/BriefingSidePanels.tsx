import { useId, useState, type ReactNode } from "react";
import { CalendarDays, Pencil, Repeat } from "lucide-react";
import { SkeletonList } from "../SkeletonList";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import {
  EditJumpButton,
  RowActions,
  type BriefingCarryoverEntry,
  type BriefingLabels,
} from "./BriefingView";
import type {
  EveningLabels,
  EveningScheduleEntry,
  EveningTodoEntry,
} from "./EveningView";
import type { TodoStatus } from "../../types/todoTree";

/*
 * The papers' blocks that live in the detail panel (#2285): 朝刊's「持ち越し」,
 * and 夕刊's「残りの Todo」and「今後の予定」. They used to close each paper's
 * column. Each is something to look up rather than part of the day the paper
 * prints, which is the same reason「きのうまでの自分」left in #938.
 *
 * The rows are the ones the papers drew, moved as they were: the carryover
 * row keeps its checkbox and its「編集」(#1368 / #1824), the remaining-todo row
 * its three statuses (#796). What is new is the upcoming row's actions.
 *
 * Every block wears BriefingVizPanel's heading and its top rule (#1826): the
 * detail well stacks its portals with no gap, and the rule is what tells one
 * block from the next. A block draws a skeleton while the paper loads. The
 * paper has no error surface (a failed read lands as an empty slot), so an
 * error reads as the empty state, as it did on the paper.
 *
 * Pure presentation (§6.4): no DataService, no useTranslation.
 */

function PanelBlock({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: ReactNode;
}) {
  const headId = useId();
  return (
    <section
      aria-labelledby={headId}
      className="mt-4 flex flex-col gap-3 border-t border-lumen-border pt-4"
    >
      <h3 id={headId} className="text-sm font-semibold text-lumen-text">
        {title}
      </h3>
      {loading ? <SkeletonList rows={3} rowHeight={28} /> : children}
    </section>
  );
}

export interface BriefingCarryoverPanelProps {
  loading: boolean;
  entries: BriefingCarryoverEntry[];
  labels: Pick<
    BriefingLabels,
    | "carryoverTitle"
    | "todoStatus"
    | "statusNotStarted"
    | "statusDone"
    | "edit"
    | "jumpToTodos"
  >;
  /** Completes / un-completes the row's todo. */
  onToggleTodo: (id: string) => void;
  /** The row's「編集」— opens that todo where it lives (#1824). */
  onJumpToTodos: (id: string) => void;
}

/** 朝刊's「持ち越し」. Left out with no rows, as the paper left it out. */
export function BriefingCarryoverPanel({
  loading,
  entries,
  labels,
  onToggleTodo,
  onJumpToTodos,
}: BriefingCarryoverPanelProps): React.JSX.Element | null {
  if (!loading && entries.length === 0) return null;
  return (
    <PanelBlock title={labels.carryoverTitle} loading={loading}>
      <ul className="space-y-1">
        {entries.map((item) => (
          /* `flex-wrap` below `md` (#2182): `RowActions` asks for the full
             width there, and in a row that cannot wrap the title was squeezed
             to 0px. The drawer is a phone's width, so it still applies. */
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-lumen-text-secondary md:flex-nowrap"
          >
            {/* The left rail at one width (#1368), so「3日目」and「12日目」
                hand the checkbox after them the same left edge. */}
            <span className="w-14 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
              {item.daysLabel}
            </span>
            <TodoStatusCheckbox
              status={item.completed ? "DONE" : "NOT_STARTED"}
              onChange={() => onToggleTodo(item.id)}
              labels={labels}
              label={labels.todoStatus}
              accentClassName="text-lumen-briefing-shu"
            />
            <button
              type="button"
              onClick={() => onToggleTodo(item.id)}
              className="min-w-0 text-left max-md:flex-1"
            >
              <span className={item.completed ? "line-through" : undefined}>
                {item.title}
              </span>
            </button>
            {/* The jump alone: a carryover row is a past day's todo, and a
                delete here would act on a day the paper is not editing. */}
            <RowActions>
              <EditJumpButton
                onClick={() => onJumpToTodos(item.id)}
                label={labels.edit}
                hint={labels.jumpToTodos}
              />
            </RowActions>
          </li>
        ))}
      </ul>
    </PanelBlock>
  );
}

export interface EveningTodosPanelProps {
  loading: boolean;
  todos: EveningTodoEntry[];
  labels: Pick<
    EveningLabels,
    "todosTitle" | "noTodos" | "todoStatus" | "statusNotStarted" | "statusDone"
  >;
  /** Moves a todo to the status its control landed on (#796). */
  onSetTodoStatus: (id: string, status: TodoStatus) => void;
}

/** 夕刊's「残りの Todo」— today's unfinished and the open carryover. */
export function EveningTodosPanel({
  loading,
  todos,
  labels,
  onSetTodoStatus,
}: EveningTodosPanelProps): React.JSX.Element {
  return (
    <PanelBlock title={labels.todosTitle} loading={loading}>
      {todos.length === 0 ? (
        <p className="text-sm text-lumen-text-secondary">{labels.noTodos}</p>
      ) : (
        <ul>
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center gap-1.5 border-b border-dashed border-lumen-border last:border-b-0"
            >
              {/* 朱 is the user's own action voice on the paper, so the
                  control wears it rather than the app accent. */}
              <TodoStatusCheckbox
                status={todo.status}
                onChange={(next) => onSetTodoStatus(todo.id, next)}
                labels={labels}
                label={labels.todoStatus}
                accentClassName="text-lumen-briefing-shu"
              />
              <span
                className={
                  todo.status === "DONE"
                    ? "min-w-0 text-sm text-lumen-text-secondary line-through"
                    : "min-w-0 text-sm text-lumen-text"
                }
              >
                {todo.title}
              </span>
              {todo.meta !== undefined && (
                <span className="flex-shrink-0 text-xs font-bold text-lumen-briefing-shu">
                  {todo.meta}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </PanelBlock>
  );
}

export interface EveningUpcomingLabels extends Pick<
  EveningLabels,
  "upcomingTitle" | "noUpcoming" | "tomorrowTag" | "allDay"
> {
  /** 「この日の予定へ移動」. */
  goToDay: string;
  /** 「編集」— an event's editor. */
  edit: string;
  /** 「繰り返しを見る」— a routine occurrence's editor, repeat and all. */
  showRepeat: string;
}

export interface EveningUpcomingPanelProps {
  loading: boolean;
  schedule: EveningScheduleEntry[];
  labels: EveningUpcomingLabels;
  /** Schedule, on the row's day, with the row selected. */
  onGoToDay: (entry: EveningScheduleEntry) => void;
  /** The row's editor, in place. Routine rows open it for its repeat. */
  onOpenEditor: (entry: EveningScheduleEntry) => void;
}

// 44px below `md` only: the drawer is a phone's, the wide panel keeps compact rows.
const UPCOMING_ACTION =
  "inline-flex items-center gap-1 rounded-lumen-sm border border-lumen-border px-2 py-1 text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-briefing-shu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11";

/**
 * 夕刊's「今後の予定」. Pressing a row opens its actions under it (#2285),
 * one row at a time: a second row closes the first.
 */
export function EveningUpcomingPanel({
  loading,
  schedule,
  labels,
  onGoToDay,
  onOpenEditor,
}: EveningUpcomingPanelProps): React.JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null);
  const idBase = useId();
  return (
    <PanelBlock title={labels.upcomingTitle} loading={loading}>
      {schedule.length === 0 ? (
        <p className="text-sm text-lumen-text-secondary">{labels.noUpcoming}</p>
      ) : (
        <ul className="space-y-1">
          {schedule.map((item) => {
            const open = openId === item.id;
            const actionsId = `${idBase}-${item.id}`;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={open ? actionsId : undefined}
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex w-full items-baseline gap-3 rounded-lumen-sm py-1 text-left transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11"
                >
                  <span className="w-14 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
                    {item.isAllDay ? labels.allDay : item.startTime}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-lumen-text">
                    {item.title}
                  </span>
                  {item.isTomorrow && (
                    <span className="flex-shrink-0 rounded-full border border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-2 text-xs text-lumen-briefing-kohaku">
                      {labels.tomorrowTag}
                    </span>
                  )}
                </button>
                {open && (
                  <div
                    id={actionsId}
                    role="group"
                    aria-label={item.title}
                    className="flex flex-wrap gap-1.5 pb-2 pl-17 pt-1"
                  >
                    <button
                      type="button"
                      onClick={() => onGoToDay(item)}
                      className={UPCOMING_ACTION}
                    >
                      <CalendarDays size={13} aria-hidden="true" />
                      {labels.goToDay}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEditor(item)}
                      className={UPCOMING_ACTION}
                    >
                      {item.isRoutine ? (
                        <Repeat size={13} aria-hidden="true" />
                      ) : (
                        <Pencil size={13} aria-hidden="true" />
                      )}
                      {item.isRoutine ? labels.showRepeat : labels.edit}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PanelBlock>
  );
}
