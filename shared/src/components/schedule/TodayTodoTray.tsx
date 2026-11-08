import { useEffect, useId, useState } from "react";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CalendarMinus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { TodoStatus } from "../../types/todoTree";
import { isImeComposing } from "../../utils/imeGuard";
import { cn } from "../cn";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import type { StatusLabelSet } from "../todoStatusVisuals";
import { setTodoDragData } from "./todoCalendarDrag";

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
 *
 * #1406 turns Schedule's tray into TWO lists — "今日の Todo" (the merged list
 * above) and "その他の Todo" (every open todo that is not on today, `addable`)
 * — that a row can cross in either direction: `onAddCandidate` still pulls a
 * row up into today, and the new `onMoveOut` sends a today row back down.
 * With `hoverActions` the two buttons stay hidden until the row is hovered or
 * focused (and are always shown where hover does not exist), so the lists
 * read as lists rather than as rows of controls. Briefing opts into none of
 * this and keeps its picker exactly as it was.
 *
 * #1627 gives the "その他" rows what today's rows already had — the status
 * checkbox and the delete button (`addableControls`) — and lets a Desktop host
 * make them draggable onto its calendar (`draggableAddable`, the payload is
 * todoCalendarDrag.ts). Both are opt-in for the same reason as #1406's props:
 * Briefing's picker is a staging list and stays as it was.
 *
 * #2408 gives the Desktop rows of both lists one trailing cluster: move, edit,
 * delete, shown on hover or focus, each with a tooltip above it (`rowActions`).
 * A phone has no hover to reveal them or to show a tooltip with, so a host
 * leaves the prop off there and keeps the buttons it had. `metaLine` moves the
 * clock under the title, beside what `renderRowExtra` draws.
 *
 * #2568 turns that line into the prototype's: the clock, the all-day marker
 * and an "other" row's date all wear one outlined round pill, and the "other"
 * rows get the same second line (date + tags) instead of the date at the
 * title's right end.
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
  /**
   * Already-formatted "where it is now", e.g. "9/5 14:00" for a row parked on
   * another day (#1406). Omitted for a row with no day yet.
   */
  meta?: string;
}

/** What `renderRowExtra` is handed, from either list. */
export type TodayTodoExtraRow = Pick<TodayTodoRow, "id" | "title">;

/** Already-translated copy of the `rowActions` cluster (#2408). */
export interface TodayTodoRowActions {
  /** Accessible name of the edit button. */
  edit: string;
  moveOutHint: string;
  moveToTodayHint: string;
  editHint: string;
  deleteHint: string;
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
  /**
   * One line for when every shown list is empty (#2571), e.g. "Todo はまだ
   * ありません". Given, it replaces the per-heading empty lines in that case
   * only; the headings and their actions stay, so a todo can still be added.
   * Omitted (Briefing), the per-heading lines show as before.
   */
  emptyAll?: string;
  /** Accessible name / title for the title button that jumps to Todos. */
  openInTodos: string;
  /** Accessible name for the per-row delete button (pair with onDelete). */
  delete?: string;
  /** Accessible name for the per-row "out of today" button (pair with onMoveOut, #1406). */
  moveOut?: string;
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
  /**
   * Send a today row back to the "other" list (#1406) — the reverse of
   * `onAddCandidate`. Rendered only with labels.moveOut.
   */
  onMoveOut?: (id: string) => void;
  /**
   * Reveal the per-row move buttons (add / moveOut) on hover or focus only
   * (#1406). Always visible where the pointer cannot hover. Off by default so
   * Briefing's picker keeps its always-visible "+".
   */
  hoverActions?: boolean;
  /**
   * Draw the status checkbox and the delete button on the "other" rows as
   * well (#1627), wired to the same `onToggleComplete` / `onSetStatus` and
   * `onDelete` today's rows use. The delete still needs labels.delete.
   */
  addableControls?: boolean;
  /**
   * Make each "other" row a native drag source carrying its todo id
   * (#1627 — todoCalendarDrag.ts), so a host calendar can take the drop.
   * Desktop only in practice: a phone has no calendar beside the list.
   */
  draggableAddable?: boolean;
  /**
   * Replace the rows' trailing buttons with the move / edit / delete cluster
   * (#2408), in both lists. Move and delete keep their names (labels.moveOut,
   * labels.addAction, labels.delete) and need their callbacks, as before; edit
   * calls `onOpenTodo` or `onOpenAddable`, the same as the title.
   */
  rowActions?: TodayTodoRowActions;
  /**
   * Draw the clock or the all-day marker on a line under the title, in front
   * of `renderRowExtra`, instead of at the title's right end (#2408). Since
   * #2568 both wear the same outlined round pill, and an "other" row gets the
   * same line: its date (`meta`) in that pill, then `renderRowExtra`.
   */
  metaLine?: boolean;
  /**
   * Extra content under the title row (#555 — the host's tag surface). Only
   * the id and title are passed because an "other" row (with `metaLine`) has
   * no time or completion to hand over.
   */
  renderRowExtra?: (row: TodayTodoExtraRow) => ReactNode;
  /**
   * Bold, primary-coloured group headings (#2568) instead of the muted
   * semibold ones. Opt-in so Briefing, which titles its tray itself, keeps
   * the quieter headings under that title.
   */
  strongHeadings?: boolean;
  /**
   * A control to sit at the right end of a group's heading (#1640) — Schedule
   * puts its "+ Todo" pill in both, so each list can be added to from where it
   * is read. A slot rather than an `onAdd` pair: the button carries the host's
   * copy and its tour anchor, and neither belongs in a part that takes both
   * already translated (§6.4).
   *
   * `placed` heads the today list ("今日の Todo"), `addable` the other one.
   */
  headingActions?: { placed?: ReactNode; addable?: ReactNode };
  /**
   * Leave a whole group out — heading, empty state and all (#1641). The Todo
   * tab's filter uses them when the user narrows to one of the two lists:
   * hiding the rows but keeping the heading would say "nothing here today",
   * which is a different (and false) statement.
   *
   * A hidden group takes its `headingActions` slot with it, which is the
   * intended reading: the pill over "その他" adds a todo with no day, and a
   * list the user has filtered away is not one to be adding to.
   */
  hideToday?: boolean;
  hideOther?: boolean;
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

/*
 * The hover reveal (#1406). `group` sits on the row; the button is transparent
 * until the row is hovered or holds focus, and is simply shown on a device
 * that cannot hover (a phone has no hover state to reveal it with). Opacity
 * rather than display, so the button keeps its box — the row does not reflow
 * when it appears — and stays in the tab order for keyboard users.
 */
const HOVER_REVEAL =
  "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";

/*
 * The 44px touch floor for the per-row icon buttons (#1558, the schedule half
 * of #1512). `max-md:` because ONE component draws both instances: the same
 * row is a Desktop sidebar row and a phone drawer row, and an unprefixed floor
 * would grow the mouse-sized buttons too.
 *
 * `min-*` and never `size-11`, because `cn` is a plain string join — two
 * utilities for one property are settled by Tailwind's emit order rather than
 * by call order (rules/frontend.md §Gotchas, #830). A `min-width` beats the
 * `size-6` box without racing it.
 *
 * The BOX grows rather than a TAP_TARGET_TALL ::after being hung over it: the
 * two buttons sit gap-2 apart at the end of one row, so hit areas widened past
 * their own boxes would reach over each other and the wrong one would answer
 * the tap (the caveat TAP_TARGET_TALL's own doc-comment asks callers to check).
 * Growing the boxes costs the row no height — the leading <TodoStatusCheckbox>
 * is already 44px tall — only width, which the title gives up to `truncate`.
 */
const NARROW_TAP_FLOOR = "max-md:min-h-11 max-md:min-w-11";

/*
 * The title on a phone (#2477): two lines instead of one, and the button
 * around it is 44px tall.
 *
 * The drawer leaves the title what the leading checkbox and the two 44px
 * buttons after it do not take, which measured 113px at 390px — five or six
 * characters before the ellipsis, and ONE on an "other" row whose "9/5 14:00"
 * sat on the same line. None of the three can shrink below the touch floor,
 * so the title gets a second line rather than more width: two lines of that
 * column are twice the characters, and a short title still takes one.
 *
 * `max-md:` because the Desktop sidebar keeps its one truncated line (the
 * same reason as NARROW_TAP_FLOOR above). `whitespace-normal` undoes the
 * `truncate` beside it, and `break-words` lets a long Latin word wrap rather
 * than push past the box.
 *
 * #2670: the clamp only stops the box at two lines; the third is still laid
 * out and hidden by `overflow: hidden`, which clips at the PADDING edge. A
 * clamped span with vertical padding therefore paints the top of line three
 * into its own bottom padding — Briefing's "other" rows, which carried
 * `py-1.5`, showed exactly that. So no clamped span takes vertical padding
 * (spacing goes on the margin), and `max-h-10` (two `text-sm` lines) is the
 * cap for an engine whose clamp leaves the box taller than two lines.
 */
const NARROW_TITLE_WRAP =
  "max-md:line-clamp-2 max-md:max-h-10 max-md:whitespace-normal max-md:break-words";

/*
 * The pill on the `metaLine` (#2568). One shape for a clock, for 終日 and for
 * an "other" row's date, so the second line reads the same in both lists.
 */
const META_PILL =
  "inline-flex shrink-0 items-center rounded-full border border-lumen-border-strong px-2 py-px text-xs tabular-nums text-lumen-text-secondary";

function groupHeadingClass(strong?: boolean): string {
  return strong
    ? "text-xs font-bold text-lumen-text"
    : "text-xs font-semibold text-lumen-text-secondary";
}

/*
 * One button of the #2408 cluster, with its tooltip above it.
 *
 * The tooltip is portalled and fixed because the sidebar's scroller clips: the
 * top row's tooltip would be cut off by the scroller's edge, and the sentence
 * is wider than the icons it hangs from, so it grows to the left from the
 * button's right edge. It closes on scroll, where a fixed box would otherwise
 * stay behind while the row moved away.
 *
 * Touch does not open it. A tap sends pointerenter with no pointerleave to
 * follow, which would leave the box up after the finger has gone. Focus opens
 * it only when the browser would draw a focus ring, so a click does not leave
 * it standing, and neither does the panel handing focus back when it closes.
 */
const TOOLTIP_GAP = 4;

function RowActionButton({
  icon: Icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const open = hovered || focused;
  const close = () => {
    setHovered(false);
    setFocused(false);
  };
  const placeAbove = (button: HTMLElement) => {
    const rect = button.getBoundingClientRect();
    setPlace({
      bottom: window.innerHeight - rect.top + TOOLTIP_GAP,
      right: window.innerWidth - rect.right,
    });
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = () => {
      setHovered(false);
      setFocused(false);
    };
    // Capture: a scroll on the sidebar's scroller does not bubble to window.
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => {
          close();
          onClick();
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "touch") return;
          placeAbove(e.currentTarget);
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={(e) => {
          if (!e.currentTarget.matches(":focus-visible")) return;
          placeAbove(e.currentTarget);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !isImeComposing(e)) close();
        }}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover",
          danger ? "hover:text-lumen-danger" : "hover:text-lumen-text",
          NARROW_TAP_FLOOR,
          HOVER_REVEAL,
          FOCUS,
        )}
      >
        <Icon aria-hidden className="size-3.5" />
      </button>
      {open &&
        createPortal(
          <span
            role="tooltip"
            id={tooltipId}
            style={place}
            className="pointer-events-none fixed z-50 w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-1 text-xs text-lumen-text shadow-lumen-md"
          >
            {hint}
          </span>,
          document.body,
        )}
    </>
  );
}

function TodoRow({
  row,
  onToggleComplete,
  onSetStatus,
  onOpenTodo,
  onDelete,
  onMoveOut,
  hoverActions,
  rowActions,
  metaLine,
  extra,
  openLabel,
  deleteLabel,
  moveOutLabel,
  statusLabel,
  statusLabels,
  allDayLabel,
}: {
  row: TodayTodoRow;
  onToggleComplete: (id: string) => void;
  onSetStatus?: (id: string, status: TodoStatus) => void;
  onOpenTodo: (id: string) => void;
  onDelete?: (id: string) => void;
  onMoveOut?: (id: string) => void;
  hoverActions?: boolean;
  rowActions?: TodayTodoRowActions;
  metaLine?: boolean;
  extra?: ReactNode;
  openLabel: string;
  deleteLabel?: string;
  moveOutLabel?: string;
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
  const time = metaLine ? (
    // #2568: the all-day marker leaves the chip-todo tint for the clock's
    // pill — on this line it sits where a time would, beside the tags, and
    // the row's checkbox already says it is a todo rather than an event.
    (row.timeLabel || allDayLabel) && (
      <span data-todo-time-pill className={META_PILL}>
        {row.timeLabel || allDayLabel}
      </span>
    )
  ) : row.timeLabel ? (
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
  );
  return (
    <li className="group flex flex-col border-b border-lumen-border">
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
            // min-w-0 (#1515): a flex ITEM defaults to min-width:auto, so
            // without it this button refuses to shrink below its own content
            // and the row pushes the trailing buttons past the panel — 8px of
            // horizontal scrollbar under the narrow drawer's Todo tab. The
            // `truncate` on the title span inside cannot help while the box
            // around it is the thing that will not give.
            // #2477: `max-md:min-h-11` — 38px is a mouse size.
            "flex min-h-[38px] min-w-0 flex-1 items-center gap-2 rounded-sm py-1 text-left max-md:min-h-11",
            FOCUS,
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              NARROW_TITLE_WRAP,
              done
                ? "text-lumen-text-secondary line-through"
                : "text-lumen-text",
            )}
          >
            {row.title}
          </span>
          {!metaLine && time}
        </button>
        {rowActions && (
          <div className="flex shrink-0 items-center gap-0.5">
            {onMoveOut && moveOutLabel && (
              <RowActionButton
                icon={ArrowDownToLine}
                label={moveOutLabel}
                hint={rowActions.moveOutHint}
                onClick={() => onMoveOut(row.id)}
              />
            )}
            <RowActionButton
              icon={Pencil}
              label={rowActions.edit}
              hint={rowActions.editHint}
              onClick={() => onOpenTodo(row.id)}
            />
            {onDelete && deleteLabel && (
              <RowActionButton
                icon={Trash2}
                label={deleteLabel}
                hint={rowActions.deleteHint}
                onClick={() => onDelete(row.id)}
                danger
              />
            )}
          </div>
        )}
        {!rowActions && onMoveOut && moveOutLabel && (
          <button
            type="button"
            aria-label={moveOutLabel}
            title={moveOutLabel}
            onClick={() => onMoveOut(row.id)}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              NARROW_TAP_FLOOR,
              hoverActions && HOVER_REVEAL,
              FOCUS,
            )}
          >
            <CalendarMinus aria-hidden className="size-3.5" />
          </button>
        )}
        {!rowActions && onDelete && deleteLabel && (
          <button
            type="button"
            aria-label={deleteLabel}
            title={deleteLabel}
            onClick={() => onDelete(row.id)}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-danger",
              NARROW_TAP_FLOOR,
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
      {metaLine ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-13 pb-1.5">
          {time}
          {extra}
        </div>
      ) : (
        extra && <div className="pl-13 pb-1.5">{extra}</div>
      )}
    </li>
  );
}

function Group({
  heading,
  headingAction,
  strongHeading,
  rows,
  empty,
  onToggleComplete,
  onSetStatus,
  onOpenTodo,
  onDelete,
  onMoveOut,
  hoverActions,
  rowActions,
  metaLine,
  renderRowExtra,
  openLabel,
  deleteLabel,
  moveOutLabel,
  statusLabel,
  statusLabels,
  allDayLabel,
}: {
  heading: string;
  headingAction?: ReactNode;
  strongHeading?: boolean;
  rows: TodayTodoRow[];
  /** `null` while the tray's single all-empty line speaks for this group. */
  empty: string | null;
  onToggleComplete: (id: string) => void;
  onSetStatus?: (id: string, status: TodoStatus) => void;
  onOpenTodo: (id: string) => void;
  onDelete?: (id: string) => void;
  onMoveOut?: (id: string) => void;
  hoverActions?: boolean;
  rowActions?: TodayTodoRowActions;
  metaLine?: boolean;
  renderRowExtra?: (row: TodayTodoExtraRow) => ReactNode;
  openLabel: string;
  deleteLabel?: string;
  moveOutLabel?: string;
  statusLabel: string;
  statusLabels: StatusLabelSet;
  allDayLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {/* The heading keeps its own line; the action sits at its right end, so
          a list can be added to from where it is read (#1640). `min-h` holds
          the row's height steady whether or not this group has an action. */}
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h4 className={groupHeadingClass(strongHeading)}>{heading}</h4>
        {headingAction}
      </div>
      {rows.length === 0 ? (
        empty !== null && (
          <p className="py-2 text-center text-xs text-lumen-text-secondary">
            {empty}
          </p>
        )
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
              onMoveOut={onMoveOut}
              hoverActions={hoverActions}
              rowActions={rowActions}
              metaLine={metaLine}
              extra={renderRowExtra?.(row)}
              openLabel={openLabel}
              deleteLabel={deleteLabel}
              moveOutLabel={moveOutLabel}
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
  onMoveOut,
  hoverActions,
  addableControls,
  draggableAddable,
  rowActions,
  metaLine,
  renderRowExtra,
  strongHeadings,
  singleList,
  headingActions,
  hideToday,
  hideOther,
  labels,
  className,
}: TodayTodoTrayProps) {
  const shared = {
    onToggleComplete,
    onSetStatus,
    onOpenTodo,
    onDelete,
    onMoveOut,
    hoverActions,
    rowActions,
    metaLine,
    renderRowExtra,
    openLabel: labels.openInTodos,
    deleteLabel: labels.delete,
    moveOutLabel: labels.moveOut,
    statusLabel: labels.status,
    statusLabels: labels.statusLabels,
    strongHeading: strongHeadings,
  };
  /*
   * #2571: with both lists in view and nothing in either, the per-heading
   * lines would say "none" twice; one line says it once. Only when the host
   * passes the copy, and only when neither list is filtered away — a hidden
   * list may still hold todos, so "none yet" would be false.
   */
  const allEmpty =
    !!labels.emptyAll &&
    !hideToday &&
    !hideOther &&
    placed.length === 0 &&
    unplaced.length === 0 &&
    addable.length === 0;
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {allEmpty && (
        <p className="py-2 text-center text-xs text-lumen-text-secondary">
          {labels.emptyAll}
        </p>
      )}
      {!hideToday && (
        <Group
          {...shared}
          heading={labels.placedHeading}
          headingAction={headingActions?.placed}
          // Time-less first, the order every other surface files all-day items
          // in (BriefingView's schedule sort, AgendaList's two blocks).
          rows={singleList ? [...unplaced, ...placed] : placed}
          empty={allEmpty ? null : labels.emptyPlaced}
          allDayLabel={singleList ? labels.allDay : undefined}
        />
      )}
      {!singleList && !hideToday && (
        <Group
          {...shared}
          heading={labels.unplacedHeading ?? ""}
          rows={unplaced}
          empty={allEmpty ? null : (labels.emptyUnplaced ?? "")}
        />
      )}
      {!hideOther && (
        <div className="flex flex-col gap-1.5">
          <div className="flex min-h-7 items-center justify-between gap-2">
            <h4 className={groupHeadingClass(strongHeadings)}>
              {labels.addHeading}
            </h4>
            {headingActions?.addable}
          </div>
          {addable.length === 0 ? (
            !allEmpty && (
              <p className="py-2 text-center text-xs text-lumen-text-secondary">
                {labels.emptyAddable}
              </p>
            )
          ) : (
            <ul role="list" className="flex flex-col">
              {addable.map((a) => (
                <li
                  key={a.id}
                  draggable={draggableAddable || undefined}
                  onDragStart={
                    draggableAddable
                      ? (e) => setTodoDragData(e.dataTransfer, a.id)
                      : undefined
                  }
                  className={cn(
                    "group flex items-center gap-2 border-b border-lumen-border",
                    draggableAddable && "cursor-grab active:cursor-grabbing",
                  )}
                >
                  {/* #1627: the same checkbox today's rows lead with. Every row
                    in this list is open (pickOtherTodos drops DONE), so it
                    always starts unchecked and a press completes the todo —
                    which also takes it off this list. */}
                  {addableControls && (
                    <TodoStatusCheckbox
                      status="NOT_STARTED"
                      onChange={(next) =>
                        onSetStatus
                          ? onSetStatus(a.id, next)
                          : onToggleComplete(a.id)
                      }
                      labels={labels.statusLabels}
                      label={labels.status}
                    />
                  )}
                  {/* #2477: the title and the "where it is now" share one box,
                    side by side on Desktop (the row's own gap-2, as before) and
                    stacked on a phone, where the meta on the title's line left
                    the title one character. */}
                  <div
                    data-addable-title
                    className={cn(
                      "flex min-w-0 flex-1 items-center max-md:flex-col max-md:items-stretch max-md:gap-0 max-md:py-0.5",
                      // #2568: the second line wraps under the title on
                      // Desktop too, so only the column gap stays.
                      metaLine ? "flex-wrap gap-x-2" : "gap-2",
                    )}
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
                          "flex min-w-0 flex-1 items-center py-1.5 text-left text-sm text-lumen-text transition-colors hover:text-lumen-accent max-md:min-h-11",
                          FOCUS,
                        )}
                      >
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate",
                            NARROW_TITLE_WRAP,
                          )}
                        >
                          {a.title}
                        </span>
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "my-1.5 min-w-0 flex-1 truncate text-sm text-lumen-text",
                          NARROW_TITLE_WRAP,
                        )}
                      >
                        {a.title}
                      </span>
                    )}
                    {/* #1406: where the row is now — a row on some other day
                      says so, in the slot today's rows use for their clock.
                      #2568: with `metaLine` that slot is the second line,
                      as on today's rows. `w-full` makes it wrap there. */}
                    {metaLine
                      ? (() => {
                          const extra = renderRowExtra?.(a);
                          if (!a.meta && !extra) return null;
                          return (
                            <div
                              data-addable-meta-line
                              className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 pb-1.5"
                            >
                              {a.meta && (
                                <span
                                  data-todo-time-pill
                                  className={META_PILL}
                                >
                                  {a.meta}
                                </span>
                              )}
                              {extra}
                            </div>
                          );
                        })()
                      : a.meta && (
                          <span className="shrink-0 text-xs tabular-nums text-lumen-text-secondary">
                            {a.meta}
                          </span>
                        )}
                  </div>
                  {rowActions && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <RowActionButton
                        icon={ArrowUpToLine}
                        label={labels.addAction}
                        hint={rowActions.moveToTodayHint}
                        onClick={() => onAddCandidate(a.id)}
                      />
                      {onOpenAddable && (
                        <RowActionButton
                          icon={Pencil}
                          label={rowActions.edit}
                          hint={rowActions.editHint}
                          onClick={() => onOpenAddable(a.id)}
                        />
                      )}
                      {addableControls && onDelete && labels.delete && (
                        <RowActionButton
                          icon={Trash2}
                          label={labels.delete}
                          hint={rowActions.deleteHint}
                          onClick={() => onDelete(a.id)}
                          danger
                        />
                      )}
                    </div>
                  )}
                  {!rowActions && (
                    <button
                      type="button"
                      aria-label={labels.addAction}
                      title={labels.addAction}
                      onClick={() => onAddCandidate(a.id)}
                      className={cn(
                        "group/add flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:text-lumen-text",
                        NARROW_TAP_FLOOR,
                        hoverActions && HOVER_REVEAL,
                        FOCUS,
                      )}
                    >
                      {/* #2010: the bordered square is painted here, not on the
                      button. The button still grows to 44px on narrow (the
                      floor above), but a border drawn on THAT box turned a 16px
                      "+" into a 44px frame of padding. The square keeps the
                      Desktop size on both layouts; the tap area around it is
                      the button's, as before. */}
                      <span className="flex size-6 items-center justify-center rounded-lumen-md border border-lumen-border-strong transition-colors group-hover/add:bg-lumen-hover">
                        <Plus aria-hidden className="size-4" />
                      </span>
                    </button>
                  )}
                  {/* #1627: to the right of the +, the same soft delete today's
                    rows carry (always visible, like theirs). */}
                  {!rowActions &&
                    addableControls &&
                    onDelete &&
                    labels.delete && (
                      <button
                        type="button"
                        aria-label={labels.delete}
                        title={labels.delete}
                        onClick={() => onDelete(a.id)}
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-danger",
                          NARROW_TAP_FLOOR,
                          FOCUS,
                        )}
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                      </button>
                    )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
