import { useCallback, useState, type DragEvent } from "react";
import { Calendar, CheckSquare, Plus, Repeat } from "lucide-react";
import { cn } from "../cn";
import {
  tagLineStyle,
  tintedFaceStyle,
  type TagLineStyle,
  type TintedFaceStyle,
} from "../../utils/scheduleTagColor";
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

/*
 * Desktop chips cut at FIVE since #2049 (two until then), with "他 N 件" under
 * them. Two folded a day as ordinary as three meetings and a todo, so the cell
 * read as busy long before it was.
 *
 * Like the compact pair below, the number and the cell's floor in MonthGrid
 * move together: the floor is exactly five chips plus the remainder line, and
 * raising one without the other lets the chips spill into the next week.
 */
export const MONTH_MAX_CHIPS = 5;

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

/**
 * The kind's light face and its ink. Since #2623 every chip wears it, tagged
 * or not — the tag colour moved to the left line (`scheduleLine`).
 */
export function chipFaceClasses(variant: ScheduleItemVariant): string {
  switch (variant) {
    case "routine":
      return "bg-lumen-chip-routine-bg text-lumen-chip-routine-fg";
    case "task":
      return "bg-lumen-chip-task-bg text-lumen-chip-task-fg";
    default:
      return "bg-lumen-chip-event-bg text-lumen-chip-event-fg";
  }
}

/*
 * #2623: one colour rule for every Schedule chip and block — the month chips
 * (both densities), the "他 N 件" rows and the week's timed blocks, and next the
 * week's all-day chips (#2563), which is why it is exported rather than
 * written out at each call site.
 *
 *   face   the kind's light token pair (chips: chipFaceClasses; week blocks
 *          keep their own schedule-* family, read at a larger size)
 *   line   3px on the left, in the tag's colour when one speaks for the item
 *          (#1580's "タグの色を種別の色より優先" lives on here), else the kind's
 *   ring   1px accent while selected
 *
 * The ink always belongs to the face, so no tag colour can make a title
 * unreadable. The borders are 0 everywhere else (Tailwind preflight), so the
 * width class alone draws only the left edge.
 */
export const SCHEDULE_LINE = "border-l-[3px]";
export const SCHEDULE_SELECTED_RING = "ring-1 ring-lumen-accent";

/** The left line's colour when no tag colour speaks for the item. */
export function kindLineClasses(variant: ScheduleItemVariant): string {
  switch (variant) {
    case "routine":
      return "border-l-lumen-chip-routine-dot";
    case "task":
      return "border-l-lumen-chip-task-dot";
    default:
      return "border-l-lumen-chip-event-dot";
  }
}

/** Classes plus the inline colour for a row's left line. */
export interface ScheduleLine {
  className: string;
  style: TagLineStyle | undefined;
}

/**
 * The left line for an item of `variant` coloured by `tagColor`. Inline when
 * it is the tag's, because that value is user data (colorPresets.ts); a token
 * class otherwise, including for a colour that is not a hex.
 */
export function scheduleLine(
  variant: ScheduleItemVariant,
  tagColor?: string | null,
): ScheduleLine {
  const style = tagLineStyle(tagColor);
  return {
    className: cn(SCHEDULE_LINE, !style && kindLineClasses(variant)),
    style,
  };
}

/** Classes plus the inline colours for a holiday's face. */
export interface HolidayFace {
  className: string;
  style: TintedFaceStyle | undefined;
}

/**
 * A holiday in the same light-face-and-line form (#2623), in the colour chosen
 * in Settings (#1626) rather than a fixed red. A holiday has no kind, so its
 * face is a wash of that colour and its ink is the page's own. Without a usable
 * colour it falls back to the neutral face and border tokens.
 */
export function holidayFace(color?: string | null): HolidayFace {
  const style = tintedFaceStyle(color);
  return {
    className: cn(
      SCHEDULE_LINE,
      "text-lumen-text",
      !style && "border-l-lumen-border bg-lumen-bg-secondary",
    ),
    style,
  };
}

/**
 * A chip's whole colouring — face, ink and line — for any variant, holidays
 * included. What the month chips, the "他 N 件" rows and (#2563) the week's
 * all-day chips spread onto their element.
 */
export function chipFace(
  variant: ScheduleItemVariant,
  tagColor?: string | null,
): ScheduleLine | HolidayFace {
  if (variant === "holiday") return holidayFace(tagColor);
  const line = scheduleLine(variant, tagColor);
  return {
    className: cn(chipFaceClasses(variant), line.className),
    style: line.style,
  };
}

/** Already-translated names of the three chip kinds (#2551, §6.4). */
export interface MonthChipKindLabels {
  event: string;
  task: string;
  routine: string;
}

/*
 * The kind mark at the head of a chip (#2551). Until then only a todo carried
 * one (#593), so an event and a routine told apart by colour alone — which
 * fails for a reader who cannot see the difference, and fails for everyone
 * while a tag colour (#1580) replaced the variant face. Holidays keep no mark:
 * they are not operated and their row says what they are.
 *
 * Named (`role="img"`) when the host passes the labels, so a screen reader
 * hears the kind before the title; decorative otherwise.
 */
export function MonthChipKindIcon({
  variant,
  labels,
}: {
  variant: Exclude<ScheduleItemVariant, "holiday">;
  labels?: MonthChipKindLabels;
}) {
  const Icon =
    variant === "task"
      ? CheckSquare
      : variant === "routine"
        ? Repeat
        : Calendar;
  const label = labels?.[variant];
  return (
    <Icon
      data-chip-kind={variant}
      className="size-3 shrink-0"
      strokeWidth={2.5}
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
    />
  );
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
      {items.slice(0, shown).map((it) => {
        // #2623: the kind's face with the tag colour on the left line, the
        // same rule as the Desktop chip. A holiday has no kind and takes the
        // Settings colour instead.
        const face = chipFace(it.variant ?? "event", it.tagColor);
        return (
          <span
            key={it.id}
            style={face.style}
            className={cn(
              "block w-full overflow-hidden rounded-sm px-0.5 text-[0.625rem] font-medium leading-[0.8125rem]",
              face.className,
              // Same #1373 gate as the Desktop chip: only a todo
              // can be complete.
              it.variant === "task" &&
                it.completed &&
                "line-through opacity-55",
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
        );
      })}
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
  /**
   * "+N more" was pressed (#1829). Given, the remainder line is a button;
   * omitted, it stays the static text it has always been.
   *
   * Hands back the button itself (#2049): the host opens its panel beside this
   * cell and puts focus back on the button when the panel closes with Escape.
   */
  onShowMore?: (anchor: HTMLElement) => void;
  /** Already-translated accessible name for that button (§6.4). */
  showMoreLabel?: string;
  /** Names for the kind marks (#2551). Omitted, the marks are decorative. */
  kindLabels?: MonthChipKindLabels;
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
  onShowMore,
  showMoreLabel,
  kindLabels,
  onSelectItem,
  onItemActivate,
  onItemDoubleClick,
  onItemContextMenu,
}: FullChipsProps) {
  return (
    <>
      {items.slice(0, shown).map((it) => {
        const face = chipFace(it.variant ?? "event", it.tagColor);
        return (
          /*
           * #2565: a holiday opens a read-only bubble. It still has no row
           * behind it — its name and date are the law's, so there is nothing
           * to edit, drag or resize (no double-click, no drag here) — but the
           * bubble names it and offers "hide holidays", which #1626's span
           * gave no way to reach from the chip itself. The id handed back is
           * the row's own `holiday-YYYY-MM-DD`, so the host tells it apart.
           * No onSelectItem fallback: a holiday is never a selection.
           */
          it.variant === "holiday" ? (
            <button
              key={it.id}
              type="button"
              title={it.title}
              data-holiday-chip={it.date}
              onClick={(e) => {
                e.stopPropagation();
                onItemActivate?.(it.id, { x: e.clientX, y: e.clientY });
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
              style={face.style}
              className={cn(
                // `pointer-events-auto` for the same reason the event chips
                // carry it: this column is pointer-events-none.
                "pointer-events-auto block cursor-pointer truncate rounded px-1 py-0.5 text-left text-xs font-medium",
                CELL_FOCUS,
                face.className,
              )}
            >
              {it.title}
            </button>
          ) : (
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
              // #2623 — see the compact body above.
              style={face.style}
              className={cn(
                // #1584: `cursor-pointer` says it out loud. Tailwind
                // preflight resets every <button> to the arrow, so a
                // chip read as decoration until it was clicked.
                // #2551: every kind carries its mark now (#593 gave
                // only todos one), so every chip is the same row.
                "pointer-events-auto flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left text-xs font-medium",
                CELL_FOCUS,
                face.className,
                // Gated on the variant (#1373): the MCP tool still
                // writes `completed` for events, and an event struck
                // through with no control to clear it would be worse
                // than the toggle that went.
                it.variant === "task" &&
                  it.completed &&
                  "line-through opacity-55",
              )}
            >
              <MonthChipKindIcon
                variant={it.variant ?? "event"}
                labels={kindLabels}
              />
              <span className="truncate">{it.title || " "}</span>
            </button>
          )
        );
      })}
      {/*
       * The remainder (#1829). It was a <span>, so on Desktop — where the
       * cell has no face button either — the items past the second one had no
       * route at all: the only way to reach them was to switch to the week by
       * hand. It is a button whenever the host says what pressing it does.
       *
       * `pointer-events-auto` for the same reason the chips above carry it:
       * the column this sits in is pointer-events-none so presses fall
       * through to the cell face.
       */}
      {overflow > 0 &&
        (onShowMore ? (
          <button
            type="button"
            aria-label={showMoreLabel}
            // #2049: it opens a panel now, not another view.
            aria-haspopup="dialog"
            onClick={(e) => {
              e.stopPropagation();
              onShowMore(e.currentTarget);
            }}
            className={cn(
              "pointer-events-auto cursor-pointer rounded px-1 text-left text-xs text-lumen-text-tertiary transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              CELL_FOCUS,
            )}
          >
            {formatMoreCount(overflow)}
          </button>
        ) : (
          <span className="px-1 text-xs text-lumen-text-tertiary">
            {formatMoreCount(overflow)}
          </span>
        ))}
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
