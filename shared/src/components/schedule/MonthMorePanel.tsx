import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { CheckSquare, X } from "lucide-react";
import { cn } from "../cn";
import { tagFaceStyle } from "../../utils/scheduleTagColor";
import { isImeComposing } from "../../utils/imeGuard";
import { clampToViewport } from "../itemActions/floating";
import { CELL_FOCUS, chipFaceClasses } from "./MonthGridParts";
import type { MonthGridItem } from "./MonthGrid";

/*
 * MonthMorePanel (#2049) — what a Desktop month cell folded into "他 N 件",
 * listed beside that cell.
 *
 * #1829 / #1973 answered the press by pointing the detail panel's flow tab at
 * the day. The list was complete, but it appeared in a different part of the
 * screen and focus stayed on the cell, so the press read as doing nothing.
 * This panel opens next to the cell that was pressed and takes focus with it.
 *
 * Only the items the cell did NOT draw are listed: the first five are already
 * on screen as chips, one row up from here.
 *
 * Placement: to the LEFT of the cell, so the cell itself — and the chips the
 * user was just reading — stays visible. The first column has no cell on its
 * left, only the app's own navigation, so that column opens on the right. The
 * last column needs no special case: a panel on its left is never past the
 * window's right edge. Either way the result is clamped into the window.
 *
 * Closing:
 *   - Escape returns focus to the "他 N 件" button that opened it.
 *   - A press outside, a scroll or a resize just closes it. The panel is placed
 *     from the cell's rectangle once, so after a scroll it would point at
 *     somewhere the cell no longer is.
 *   - Pressing an item closes it and hands the item to `onItemActivate`, which
 *     on this screen opens the same quick-edit bubble a chip opens (#299).
 *     `focus` tells that bubble to take focus — only for a keyboard press, so
 *     a mouse press behaves exactly like a press on a chip.
 *
 * Pure presentation (§3.1 / §6.4): no DataService, no useTranslation; every
 * label arrives translated. lumen-* tokens only; opaque (§5).
 */

const PANEL_WIDTH = 248;
const EDGE_GAP = 8;
// First-paint estimate only; the measured height takes over before paint
// (the #826 lesson ItemActionPopover carries).
const EST_HEIGHT = 200;

export interface MonthMorePanelPlacement {
  top: number;
  left: number;
  side: "left" | "right";
  maxHeight?: number;
}

/**
 * Where the panel goes for a cell at `cell` in column `column` (0 = the
 * grid's first). Exported for the unit test — jsdom has no layout, so the
 * rectangle math is checked here with numbers rather than through a render.
 */
export function placeMonthMorePanel(
  cell: { left: number; right: number; top: number },
  column: number,
  width: number,
  height: number,
  gap = EDGE_GAP,
): MonthMorePanelPlacement {
  let side: "left" | "right" = column === 0 ? "right" : "left";
  let x = side === "left" ? cell.left - width - gap : cell.right + gap;
  // A window too narrow to hold the panel on the left of this cell: use the
  // right rather than covering the cell from the window's edge.
  if (side === "left" && x < gap) {
    side = "right";
    x = cell.right + gap;
  }
  const clamped = clampToViewport({ x, y: cell.top }, width, height, gap);
  return { ...clamped, side };
}

export interface MonthMorePanelProps {
  /** The "他 N 件" button that opened the panel. */
  anchor: HTMLElement;
  /** The items the cell folded away, in the cell's order. */
  items: MonthGridItem[];
  /** Already-translated heading — names the day (§6.4). */
  title: string;
  /** Already-translated accessible name for the close button. */
  closeLabel: string;
  /**
   * An item was pressed. `pos` is in viewport coordinates, for the bubble the
   * host opens there; `focus` asks that bubble to take focus (keyboard press).
   */
  onItemActivate: (
    id: string,
    pos: { x: number; y: number },
    opts: { focus: boolean },
  ) => void;
  onClose: () => void;
  /** Panel width in px (default 248). */
  width?: number;
}

export function MonthMorePanel({
  anchor,
  items,
  title,
  closeLabel,
  onItemActivate,
  onClose,
  width = PANEL_WIDTH,
}: MonthMorePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  const cell = anchor.closest<HTMLElement>("[data-month-cell]") ?? anchor;
  const column = Number(cell.dataset.monthColumn ?? "1");
  const rect = cell.getBoundingClientRect();
  const { top, left, side, maxHeight } = placeMonthMorePanel(
    rect,
    column,
    width,
    measuredHeight ?? EST_HEIGHT,
  );

  useLayoutEffect(() => {
    const height = panelRef.current?.offsetHeight;
    if (height != null && height !== measuredHeight) setMeasuredHeight(height);
  }, [measuredHeight, items]);

  // Focus moves in with the panel: the first item, or the close button when
  // every hidden row is a holiday (which has nothing to press). Once, on
  // open — a re-render while the user is arrowing through must not pull focus
  // back to the top.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const first =
      panel.querySelector<HTMLElement>("[data-month-more-item]") ??
      panel.querySelector<HTMLElement>("[data-month-more-close]");
    first?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const inPanel = (target: EventTarget | null) =>
      target instanceof Node && !!panelRef.current?.contains(target);
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || isImeComposing(e)) return;
      anchor.focus({ preventScroll: true });
      onClose();
    };
    const handleDown = (e: MouseEvent) => {
      // The anchor is left to its own click, which the host reads as a toggle.
      if (inPanel(e.target) || anchor.contains(e.target as Node)) return;
      onClose();
    };
    const handleScroll = (e: Event) => {
      // The panel's own list scrolls when it is capped; that is not the page.
      if (inPanel(e.target)) return;
      onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  // Up / Down walk the list, Home / End jump to its ends. Tab still works;
  // this only saves a screen of Tab presses on a busy day.
  const handleListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const buttons = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>("[data-month-more-item]"),
    );
    if (buttons.length === 0) return;
    e.preventDefault();
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? buttons.length - 1
          : e.key === "ArrowDown"
            ? Math.min(at + 1, buttons.length - 1)
            : Math.max(at - 1, 0);
    buttons[next]?.focus();
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      data-month-more-panel={cell.dataset.monthCell}
      data-month-more-side={side}
      className="fixed z-[60] flex flex-col overflow-hidden rounded-lumen-md border border-lumen-border bg-lumen-bg shadow-lumen-lg"
      style={{ top, left, width, maxHeight }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-lumen-border py-1 pl-3 pr-1">
        <p className="min-w-0 truncate text-xs font-semibold text-lumen-text">
          {title}
        </p>
        <button
          type="button"
          data-month-more-close
          aria-label={closeLabel}
          onClick={() => {
            anchor.focus({ preventScroll: true });
            onClose();
          }}
          className={cn(
            "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text",
            CELL_FOCUS,
          )}
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <ul
        onKeyDown={handleListKey}
        className="flex min-h-0 flex-col gap-0.5 overflow-y-auto p-1.5"
      >
        {items.map((it) => (
          <li key={it.id} className="flex">
            {it.variant === "holiday" ? (
              // #1626: drawn, not operated — the same span the cell uses.
              <span
                title={it.title}
                style={tagFaceStyle(it.tagColor)}
                className="block w-full truncate rounded px-1.5 py-1 text-xs font-medium"
              >
                {it.title}
              </span>
            ) : (
              <button
                type="button"
                data-month-more-item={it.id}
                title={it.title}
                onClick={(e) => {
                  // A keyboard press arrives as a click with no pointer
                  // (detail 0, coordinates 0/0), so the bubble is placed from
                  // the row instead of from the window's corner.
                  const keyboard = e.detail === 0;
                  const r = e.currentTarget.getBoundingClientRect();
                  const pos = keyboard
                    ? { x: r.left, y: r.bottom }
                    : { x: e.clientX, y: e.clientY };
                  onClose();
                  onItemActivate(it.id, pos, { focus: keyboard });
                }}
                style={tagFaceStyle(it.tagColor)}
                className={cn(
                  "w-full min-w-0 cursor-pointer rounded px-1.5 py-1 text-left text-xs font-medium",
                  it.variant === "task"
                    ? "flex items-center gap-1"
                    : "block truncate",
                  CELL_FOCUS,
                  !it.tagColor && chipFaceClasses(it.variant ?? "event"),
                  it.variant === "task" &&
                    it.completed &&
                    "line-through opacity-55",
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
            )}
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
