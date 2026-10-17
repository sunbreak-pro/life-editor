import { useEffect, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import {
  CalendarDays,
  ChevronRight,
  MoreHorizontal,
  Repeat,
} from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING_TIGHT } from "../styleTokens";
import { ItemRoleBadge } from "../items/ItemRoleBadge";
import { SelectCheckbox } from "../SelectCheckbox";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import type { TodoStatus } from "../../types/todoTree";
import type { TagHubGroup, TagHubItem, TagHubLabels } from "./types";

/*
 * The hub's detail column (#1171): one selected tag's items, split by kind.
 *
 * #2224 reworked the rows after the Claude Design prototype:
 *   - each kind is a FRAME of its own, headed by the kind's icon (the same
 *     tint the Schedule gives it — ../items/itemRole), its name and a count;
 *   - every row starts with its DAY, bold, and a time under it. That pair is
 *     the row's whole date: the right edge carries none any more;
 *   - a todo row leads with the round completion checkbox, and a done todo is
 *     struck through with a "Done" chip;
 *   - the square selection checkbox (#2217) appears only in selection mode,
 *     left of the day, so an ordinary read of a topic is not a column of boxes;
 *   - a right-click (a long press on a phone) asks the host to EDIT the row —
 *     what that means per kind is the host's (the item panel for a todo or an
 *     event, the item's own screen otherwise).
 *
 * The kind is announced by the frame's HEADING rather than by a badge on every
 * row — the same ItemRoleBadge the tag editor puts on each row (#409), lifted
 * once to the top of its run.
 *
 * Rows NAVIGATE (or select, on wide), they do not edit in place — except the
 * todo's round checkbox, the one-tap write the Mobile brief keeps.
 *
 * Pure presentation: copy injected (§6.4), lumen-* tokens only.
 */

/** How long a touch has to rest on a row before it counts as a long press. */
export const LONG_PRESS_MS = 500;
/** How far a held finger may drift before the hold is read as a scroll. */
const MOVE_TOLERANCE_PX = 10;
/** How long after a long press a stray click is still its tail. */
const PRESS_TAIL_MS = 800;

/** Whether a press that fired at `firedAt` still owns what follows it. */
function inPressTail(firedAt: number): boolean {
  return Date.now() - firedAt < PRESS_TAIL_MS;
}

/** When a press fires — read in the handlers, never during render. */
function pressTime(): number {
  return Date.now();
}

export interface TagHubItemGroupsProps {
  groups: readonly TagHubGroup[];
  onOpenItem: (item: TagHubItem) => void;
  /** Count → its accessible text, for the per-kind heading. */
  formatCount: (count: number) => string;
  /**
   * A row's `dayKey` (YYYY-MM-DD) → the bold day at its left edge. The host
   * owns the locale; without it the key itself is shown.
   */
  formatDay?: (dayKey: string) => string;
  /**
   * Wide = the Desktop detail column; narrow = the whole phone screen. The
   * touch targets depend on it (#1561): narrow rows and selection squares get
   * the 44px floor, wide ones keep their mouse size.
   */
  wide: boolean;
  labels: TagHubLabels;
  /*
   * Bulk selection (#1644 / #2224). The squares are drawn only while
   * `selecting` is on AND a toggle is given; otherwise the rows read exactly
   * as an ordinary list.
   */
  selecting?: boolean;
  checkedIds?: ReadonlySet<string>;
  onToggleChecked?: (itemId: string) => void;
  /** A row's checkbox name ("Select “Standup”"). */
  formatSelectItem?: (title: string) => string;
  /*
   * Relations selection (#1645 / plan assumption 1). With `onSelectItem` the
   * row's CLICK picks the item for the right panel, and leaving the hub is the
   * chevron — now a button of its own — or a double click. Without it a click
   * opens the item, which is what narrow keeps.
   */
  activeItemId?: string | null;
  onSelectItem?: (item: TagHubItem) => void;
  /** The chevron button's name ("Open “Standup”"). */
  formatOpenItem?: (title: string) => string;
  /*
   * The narrow row's "…" (#1646 / M3). The host owns what it offers — the
   * sheet holds actions that write, and this component writes nothing.
   */
  onItemMenu?: (item: TagHubItem) => void;
  /** That button's name ("Standup: Item actions"). */
  formatItemMenu?: (title: string) => string;
  /** A todo row's round checkbox (#2224). Omit to draw no checkbox. */
  onToggleTodoStatus?: (item: TagHubItem, next: TodoStatus) => void;
  /**
   * Right-click, or a long press on touch (#2224). The browser's own menu is
   * kept out only when this is given.
   */
  onItemContextMenu?: (item: TagHubItem) => void;
}

export function TagHubItemGroups({
  groups,
  onOpenItem,
  formatCount,
  formatDay = (dayKey) => dayKey,
  wide,
  labels,
  selecting = false,
  checkedIds,
  onToggleChecked,
  formatSelectItem,
  activeItemId,
  onSelectItem,
  formatOpenItem,
  onItemMenu,
  formatItemMenu,
  onToggleTodoStatus,
  onItemContextMenu,
}: TagHubItemGroupsProps) {
  const showSelect = selecting && onToggleChecked !== undefined;

  /*
   * The long press (#2224). iOS Safari raises no `contextmenu` for a held
   * finger on an ordinary element, so the timer is the phone's right-click.
   * One touch at a time, so one timer for the whole list.
   *
   * What follows a press that fired is swallowed, so one press is one open:
   *   - the lifted finger: `touchend` is default-prevented, which stops the
   *     compatibility mousedown / click the browser would send next — the
   *     mousedown would otherwise land on the backdrop of the sheet that just
   *     opened and close it;
   *   - Android's own `contextmenu` for the same hold, which can arrive before
   *     or after the timer (its threshold is ~400ms): whichever comes first
   *     opens, the other is dropped;
   *   - a click that still gets through, within PRESS_TAIL_MS.
   * A finger may drift MOVE_TOLERANCE_PX before the hold counts as a scroll.
   */
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedAt = useRef(Number.NEGATIVE_INFINITY);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const cancelPress = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  useEffect(() => cancelPress, []);
  const inTail = () => inPressTail(firedAt.current);

  const pressHandlers = (item: TagHubItem) =>
    onItemContextMenu
      ? {
          onTouchStart: (e: ReactTouchEvent) => {
            cancelPress();
            const touch = e.touches[0];
            pressStart.current = touch
              ? { x: touch.clientX, y: touch.clientY }
              : null;
            pressTimer.current = setTimeout(() => {
              pressTimer.current = null;
              firedAt.current = pressTime();
              onItemContextMenu(item);
            }, LONG_PRESS_MS);
          },
          onTouchMove: (e: ReactTouchEvent) => {
            const start = pressStart.current;
            const touch = e.touches[0];
            if (
              !start ||
              !touch ||
              Math.hypot(touch.clientX - start.x, touch.clientY - start.y) >
                MOVE_TOLERANCE_PX
            ) {
              cancelPress();
            }
          },
          onTouchEnd: (e: ReactTouchEvent) => {
            cancelPress();
            pressStart.current = null;
            if (inTail()) e.preventDefault();
          },
          onTouchCancel: () => {
            cancelPress();
            pressStart.current = null;
          },
          onContextMenu: (e: ReactMouseEvent) => {
            e.preventDefault();
            // The same hold the timer already served.
            if (inTail()) return;
            // Android got there first: the timer must not open it again, and
            // what the lifted finger sends is the tail. A mouse right-click
            // has no tail — the next left click is a click.
            if (pressStart.current !== null) {
              cancelPress();
              firedAt.current = pressTime();
            }
            onItemContextMenu(item);
          },
        }
      : {};

  /** Run a row's click unless it is the tail of a long press. */
  const guarded = (run: () => void) => () => {
    if (inTail()) return;
    run();
  };

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <section
          key={group.role}
          data-taghub-group={group.role}
          className="overflow-hidden rounded-lumen-md border border-lumen-border bg-lumen-bg"
        >
          {/*
           * aria-label rather than the concatenated content: the badge already
           * names the kind and the chip is a bare number, so without it the
           * heading is announced as "Todo 3" with no sense of what 3 counts.
           */}
          <h3
            aria-label={`${labels.roles[group.role]}: ${formatCount(
              group.items.length,
            )}`}
            className="flex items-center gap-2 border-b border-lumen-border bg-lumen-bg-secondary px-2 py-1.5"
          >
            <ItemRoleBadge role={group.role} labels={labels.roles} size="md" />
            <span
              aria-hidden
              className="text-sm font-medium tabular-nums text-lumen-text-tertiary"
            >
              {group.items.length}
            </span>
          </h3>
          <ul className="flex flex-col p-1">
            {group.items.map((item) => {
              const checked = checkedIds?.has(item.id) ?? false;
              const marked = checked || activeItemId === item.id;
              const done = item.role === "task" && item.status === "DONE";
              const dayText = item.dayKey
                ? formatDay(item.dayKey)
                : item.role === "task"
                  ? labels.noDate
                  : null;
              const timeText = item.allDay ? labels.allDay : item.time;
              /*
               * The row's name, spelled out: title first (a list walked by
               * ear is scanned by name), then the left edge, then the second
               * line and the Done chip. A daily's day IS its title.
               */
              const rowName = [
                item.title,
                ...(item.role === "daily"
                  ? []
                  : [dayText, timeText, item.repeats ? labels.repeats : null]),
                item.detail,
                done ? labels.done : null,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <li
                  key={item.id}
                  data-taghub-row={item.id}
                  {...pressHandlers(item)}
                  className={cn(
                    "group/row relative flex items-center gap-1 rounded-lumen-sm",
                    // The tint plus the 2px bar (D9), so neither a checked
                    // row nor the selected one is told apart by colour alone.
                    marked && "bg-lumen-accent-subtle",
                  )}
                >
                  {marked && (
                    <span
                      aria-hidden
                      className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-lumen-accent"
                    />
                  )}
                  {showSelect && (
                    <SelectCheckbox
                      checked={checked}
                      onChange={() => onToggleChecked?.(item.id)}
                      label={formatSelectItem?.(item.title) ?? item.title}
                      // The box is 16px; the press target is not (#1561).
                      // One size class or the other — `cn` does not merge.
                      className={wide ? "ml-1 size-7" : "size-11"}
                    />
                  )}
                  {item.role === "task" && onToggleTodoStatus && (
                    <TodoStatusCheckbox
                      status={item.status ?? "NOT_STARTED"}
                      onChange={(next) => onToggleTodoStatus(item, next)}
                      labels={labels.todoStatusLabels}
                      label={labels.todoStatus}
                      itemName={item.title}
                    />
                  )}
                  <button
                    type="button"
                    aria-label={rowName}
                    aria-current={activeItemId === item.id ? "true" : undefined}
                    onClick={guarded(() =>
                      onSelectItem ? onSelectItem(item) : onOpenItem(item),
                    )}
                    onDoubleClick={
                      onSelectItem ? () => onOpenItem(item) : undefined
                    }
                    className={cn(
                      // #1749 — `min-w-0` is what lets the row end at the
                      // screen edge; truncation only reaches the title once
                      // every flex level above can shrink.
                      "group flex min-w-0 flex-1 items-center gap-3 rounded-lumen-sm px-2 py-1.5 text-left",
                      "transition-colors hover:bg-lumen-hover",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                      // #1561 — 44px touch floor on narrow only. `min-h-*`,
                      // never `h-*`: `cn` is a plain string join.
                      !wide && "min-h-11",
                    )}
                  >
                    {/* The left edge — read through the button's name above. */}
                    <span
                      aria-hidden
                      data-taghub-when=""
                      className="flex w-[4.5rem] shrink-0 flex-col leading-tight"
                    >
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs tabular-nums",
                          item.dayKey
                            ? "font-semibold text-lumen-text"
                            : "text-lumen-text-tertiary",
                        )}
                      >
                        {item.role === "daily" && (
                          <CalendarDays
                            size={12}
                            className="shrink-0 text-lumen-warning"
                          />
                        )}
                        <span className="truncate">{dayText}</span>
                      </span>
                      {(timeText || item.repeats) && (
                        <span className="flex items-center gap-1 text-[11px] tabular-nums text-lumen-text-tertiary">
                          {timeText && (
                            <span className="truncate">{timeText}</span>
                          )}
                          {item.repeats && (
                            <Repeat size={11} className="shrink-0" />
                          )}
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(
                          "min-w-0 truncate text-sm",
                          done
                            ? "text-lumen-text-tertiary line-through"
                            : "text-lumen-text",
                        )}
                        title={item.title}
                      >
                        {item.title}
                      </span>
                      {item.detail && (
                        <span
                          className="truncate text-xs text-lumen-text-tertiary"
                          title={item.detail}
                        >
                          {item.detail}
                        </span>
                      )}
                    </span>
                    {done && (
                      <span className="shrink-0 rounded-lumen-sm border border-lumen-border px-1.5 py-0.5 text-[11px] text-lumen-text-secondary">
                        {labels.done}
                      </span>
                    )}
                    {/* Decorative while the row itself opens the item; the
                        button below takes over when it does not. */}
                    {!onSelectItem && (
                      <ChevronRight
                        size={14}
                        aria-hidden
                        className="shrink-0 text-lumen-text-tertiary opacity-0 transition-opacity group-hover/row:opacity-100"
                      />
                    )}
                  </button>
                  {onItemMenu && (
                    // M3 — narrow has no hover to reveal anything with, so the
                    // row's actions sit on a 44px button of their own.
                    <button
                      type="button"
                      onClick={() => onItemMenu(item)}
                      aria-label={formatItemMenu?.(item.title) ?? item.title}
                      className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-lumen-sm text-lumen-text-secondary",
                        "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                        FOCUS_RING_TIGHT,
                      )}
                    >
                      <MoreHorizontal size={16} aria-hidden />
                    </button>
                  )}
                  {onSelectItem && (
                    // Always reachable, never hover-only: with the row's click
                    // taken by selection this is the only pointer route out of
                    // the hub, and a keyboard has no hover to reveal it with.
                    <button
                      type="button"
                      onClick={() => onOpenItem(item)}
                      aria-label={formatOpenItem?.(item.title) ?? item.title}
                      className={cn(
                        "mr-1 shrink-0 rounded-lumen-sm p-1 text-lumen-text-tertiary",
                        "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                        FOCUS_RING_TIGHT,
                      )}
                    >
                      <ChevronRight size={14} aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
