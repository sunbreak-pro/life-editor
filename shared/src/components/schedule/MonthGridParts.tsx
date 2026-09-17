import { useCallback, useState, type DragEvent } from "react";
import { CheckSquare, Plus } from "lucide-react";
import { cn } from "../cn";
import { tagFaceStyle } from "../../utils/scheduleTagColor";
import { type ScheduleItemVariant } from "./scheduleVariantVisuals";
import type { MonthGridItem } from "./MonthGrid";
import {
  hasTodoDragData,
  readTodoDragData,
  type TodoCalendarDrop,
} from "./todoCalendarDrag";

/*
 * The two things a MonthGrid cell can hold under its day badge (#1642 W12).
 *
 * The grid used to draw both densities inline, so a change to the phone's title
 * list meant reading past the Desktop chip buttons and back. The cell frame —
 * drop target, face button, + button, day badge — is the same for both and
 * stays in MonthGrid.tsx; only the list under the badge differs, and that is
 * all that moved here, together with the two cell controls whose reasoning is
 * longer than their markup (the todo drop target and the + button). Both bodies render exactly the markup the inline
 * branches did (shared/tests/monthGrid.test.tsx is the pin).
 */

export const CELL_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-inset";

/*
 * How a compact cell's title ENDS when it is wider than the cell (#1516).
 *
 * The audit filed this as "no ellipsis", but an ellipsis is exactly what #1401
 * ruled out ("「…」のような省略記号は付けない", ユーザー指定 point 4), and that
 * ruling still stands. What it did not ask for is the OTHER half of what the
 * audit saw: `overflow: hidden` alone cuts a glyph in half at an arbitrary
 * pixel, which reads as a rendering fault rather than as "there is more here".
 *
 * A fade answers both. The last few pixels of the line ramp to transparent, so
 * the cut is visibly deliberate, and — unlike an ellipsis, which would eat
 * roughly three of the ~7 characters a 51px cell can hold — it costs the title
 * no width at all.
 *
 * It rides on an INNER span so the mask reaches the text only: the outer span
 * carries the chip's background, and masking that would fade every chip's
 * right edge whether its title overflowed or not. On a title that fits, the
 * faded strip holds no glyphs and nothing changes.
 */
const TITLE_FADE =
  "[mask-image:linear-gradient(to_right,black_calc(100%_-_0.5rem),transparent)]";

/** Desktop chips cut at two, with "他 N 件" under them. */
export const MONTH_MAX_CHIPS = 2;

/*
 * Compact: FOUR lines per cell since #1581 (three until then). A day with
 * more than four items shows three titles and spends the fourth line on
 * "+N", so the count is never hidden behind a clipped list (#1045's
 * argument, carried over from the dots).
 *
 * The number and the cell height in MonthGrid move together — the height is
 * exactly what these lines need plus a little slack, so raising one without the
 * other either clips a line or leaves a band of empty cell.
 */
export const MONTH_MAX_TITLE_LINES = 4;

/**
 * How many of a day's items each density shows, and how many it folds into the
 * "他 N 件" line. Each density hides a different number, so each counts its own
 * remainder (#1045) — one shared `overflow` would print the chip figure under a
 * list that cut at a different place.
 */
export function monthCellFold(
  count: number,
  compact: boolean,
): { shown: number; overflow: number } {
  if (compact) {
    const shown =
      count > MONTH_MAX_TITLE_LINES ? MONTH_MAX_TITLE_LINES - 1 : count;
    return { shown, overflow: count - shown };
  }
  const shown = Math.min(count, MONTH_MAX_CHIPS);
  return { shown, overflow: Math.max(0, count - MONTH_MAX_CHIPS) };
}

function chipFaceClasses(variant: ScheduleItemVariant): string {
  switch (variant) {
    case "routine":
      return "bg-lumen-chip-routine-bg text-lumen-chip-routine-fg";
    case "task":
      return "bg-lumen-chip-task-bg text-lumen-chip-task-fg";
    default:
      return "bg-lumen-chip-event-bg text-lumen-chip-event-fg";
  }
}

interface CellBodyProps {
  items: MonthGridItem[];
  shown: number;
  overflow: number;
  formatMoreCount: (n: number) => string;
}

export function MonthCompactTitles({
  items,
  shown,
  overflow,
  formatMoreCount,
}: CellBodyProps) {
  return (
    <>
      {/*
       * The titles (#1401). One line each, in the item's chip
       * colours so an event, a routine and a todo still tell
       * apart at this size. A title wider than the cell is cut
       * at the cell's edge — still no `truncate`, whose ellipsis
       * the Issue rules out, but the last few pixels now fade
       * (#1516 / TITLE_FADE) so the cut reads as deliberate
       * rather than as a half-drawn glyph. The cell's fixed
       * height means a long title can never move a grid line.
       * What a title IS is still answered by the drawer the cell
       * opens; these are plain spans, not the Desktop chip
       * buttons, because the day stays the tap target on a
       * phone.
       */}
      {items.slice(0, shown).map((it) => (
        <span
          key={it.id}
          // #1580: a tag's colour REPLACES the variant face —
          // "which tag" beats "where it came from" once the user
          // has coloured a tag. Inline, because the value is
          // user data (colorPresets.ts), and paired with an ink
          // chosen for contrast rather than assumed.
          style={tagFaceStyle(it.tagColor)}
          className={cn(
            "block w-full overflow-hidden rounded-sm px-0.5 text-[0.625rem] font-medium leading-[0.8125rem]",
            !it.tagColor && chipFaceClasses(it.variant ?? "event"),
            // Same #1373 gate as the Desktop chip: only a todo
            // can be complete.
            it.variant === "task" && it.completed && "line-through opacity-55",
          )}
        >
          {/* The text layer, and the only thing the fade
              touches — see TITLE_FADE. `nowrap` moved down
              here with it, so the mask and the line it fades
              are the same box. */}
          <span className={cn("block whitespace-nowrap", TITLE_FADE)}>
            {it.title || " "}
          </span>
        </span>
      ))}
      {/*
       * The remainder, spelled out (#1045): a day with eight
       * items must not look like a day with two. It takes the
       * last line instead of a fourth title, so it is never the
       * thing that gets clipped. Same `formatMoreCount` the
       * Desktop overflow line uses, so the two densities agree
       * on the wording ("+N more" / "他 N 件").
       */}
      {overflow > 0 && (
        <span className="whitespace-nowrap px-0.5 text-[0.625rem] leading-[0.8125rem] text-lumen-text-tertiary tabular-nums">
          {formatMoreCount(overflow)}
        </span>
      )}
    </>
  );
}

interface FullChipsProps extends CellBodyProps {
  onSelectItem?: (id: string) => void;
  onItemActivate?: (id: string, pos: { x: number; y: number }) => void;
  onItemDoubleClick?: (id: string) => void;
  onItemContextMenu?: (id: string, pos: { x: number; y: number }) => void;
}

export function MonthFullChips({
  items,
  shown,
  overflow,
  formatMoreCount,
  onSelectItem,
  onItemActivate,
  onItemDoubleClick,
  onItemContextMenu,
}: FullChipsProps) {
  return (
    <>
      {items.slice(0, shown).map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onItemActivate)
              onItemActivate(it.id, {
                x: e.clientX,
                y: e.clientY,
              });
            else onSelectItem?.(it.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onItemDoubleClick?.(it.id);
          }}
          onContextMenu={
            onItemContextMenu
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onItemContextMenu(it.id, {
                    x: e.clientX,
                    y: e.clientY,
                  });
                }
              : undefined
          }
          title={it.title}
          // #1580 — see the compact body above.
          style={tagFaceStyle(it.tagColor)}
          className={cn(
            // #1584: `cursor-pointer` says it out loud. Tailwind
            // preflight resets every <button> to the arrow, so a
            // chip read as decoration until it was clicked.
            "pointer-events-auto cursor-pointer rounded px-1 py-0.5 text-left text-xs font-medium",
            // #593: todo chips carry the CheckSquare todo mark,
            // matching the week grid, so the cue does not vanish
            // when the same item is viewed by month.
            it.variant === "task"
              ? "flex items-center gap-1"
              : "block truncate",
            CELL_FOCUS,
            !it.tagColor && chipFaceClasses(it.variant ?? "event"),
            // Gated on the variant (#1373): the MCP tool still
            // writes `completed` for events, and an event struck
            // through with no control to clear it would be worse
            // than the toggle that went.
            it.variant === "task" && it.completed && "line-through opacity-55",
          )}
        >
          {it.variant === "task" ? (
            <>
              <CheckSquare
                aria-hidden
                className="size-3 shrink-0"
                strokeWidth={2.5}
              />
              <span className="truncate">{it.title || " "}</span>
            </>
          ) : (
            it.title || " "
          )}
        </button>
      ))}
      {overflow > 0 && (
        <span className="px-1 text-xs text-lumen-text-tertiary">
          {formatMoreCount(overflow)}
        </span>
      )}
    </>
  );
}

/**
 * A todo dragged in from outside the grid (the Schedule sidebar's "その他"
 * list — #1627) lands on a cell with no time. `dropDay` is the cell under a
 * live drag, tinted until it leaves or drops. When `onDropTodo` is omitted no
 * cell takes a drop and every handler is undefined.
 */
export function useMonthCellDrop(
  onDropTodo: ((drop: TodoCalendarDrop) => void) | undefined,
): {
  dropDay: string | null;
  cellDrop: (dateKey: string) => {
    onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
    onDragLeave?: (e: DragEvent<HTMLDivElement>) => void;
    onDrop?: (e: DragEvent<HTMLDivElement>) => void;
  };
} {
  const [dropDay, setDropDay] = useState<string | null>(null);
  const cellDrop = useCallback(
    (dateKey: string) =>
      onDropTodo
        ? {
            onDragOver: (e: DragEvent<HTMLDivElement>) => {
              if (!hasTodoDragData(e.dataTransfer)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropDay((k) => (k === dateKey ? k : dateKey));
            },
            onDragLeave: (e: DragEvent<HTMLDivElement>) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                setDropDay((k) => (k === dateKey ? null : k));
            },
            onDrop: (e: DragEvent<HTMLDivElement>) => {
              const todoId = readTodoDragData(e.dataTransfer);
              setDropDay(null);
              if (!todoId) return;
              e.preventDefault();
              onDropTodo({
                todoId,
                dateISO: dateKey,
                startTime: null,
                endTime: null,
              });
            },
          }
        : {},
    [onDropTodo],
  );
  return { dropDay, cellDrop };
}

/*
 * The + (#1584). A sibling of the face button rather than a child of the
 * cell's item column, because that column is `pointer-events-none` — it exists
 * so a press lands on the face button underneath, and a control inside it
 * would have to re-enable pointer events the way the chips do anyway.
 *
 * Quiet until asked for: hidden on an untouched cell, shown on hover, and shown
 * on keyboard focus — `opacity-0` leaves it in the a11y tree and in the tab
 * order, so the two are the same button and not a mouse one plus a
 * screen-reader one.
 *
 * 28px square, which is this project's own floor for an icon-only control
 * (tokens.css `--spacing-lumen-tap-min`, the `:has()` rule). Not the 44px touch
 * floor: 44 would reach down past the day badge row into the first chip and,
 * sitting above it, swallow presses meant for that chip — and this control is
 * never mounted at a narrow width, where that floor applies.
 */
export function MonthCellCreateButton({
  label,
  onCreate,
}: {
  label: string;
  onCreate: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onCreate();
      }}
      className={cn(
        "absolute right-0.5 top-0.5 z-20 flex size-7 cursor-pointer items-center justify-center rounded",
        "text-lumen-text-secondary transition-opacity hover:bg-lumen-hover hover:text-lumen-text",
        "opacity-0 focus-visible:opacity-100 group-hover/cell:opacity-100",
        CELL_FOCUS,
      )}
    >
      <Plus aria-hidden className="size-4" strokeWidth={2.5} />
    </button>
  );
}
