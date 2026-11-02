/*
 * Keeping a link chip's Desktop panel inside what can show it (#2446).
 *
 * The panel hangs from its chip with `position: absolute`, so any ancestor that
 * clips its overflow cuts it off, not only the window. On the Notes screen the
 * editor sits in a scrolling column with the note list to its right: a panel
 * from a chip near that column's right edge ran under the list and made the
 * column scroll sideways. So the right edge to keep to is the nearest of the
 * window's and every clipping ancestor's.
 */

export interface HorizontalBounds {
  left: number;
  right: number;
}

/** The `overflow-x` values that cut a descendant off at the padding box. */
const CLIPPING = new Set(["auto", "scroll", "hidden", "clip"]);
/** The `overflow-y` values that make the other axis clip too. */
const SCROLLING = new Set(["auto", "scroll", "hidden"]);

/**
 * The horizontal span, in viewport pixels, where `el`'s overflow is not cut
 * off: the window, narrowed by the inner box (padding box, scrollbar excluded)
 * of every ancestor whose `overflow-x` clips.
 */
export function visibleBoundsOf(el: Element): HorizontalBounds {
  const view = el.ownerDocument.defaultView;
  let left = 0;
  let right = view ? view.innerWidth : Number.POSITIVE_INFINITY;
  if (!view) return { left, right };
  const doc = el.ownerDocument;
  // An absolute box is clipped only by its containing block and the boxes
  // around that, not by an ancestor in between. Below the breakpoint the chip
  // strip scrolls sideways between the panel and the header row it hangs
  // from, and it does not cut the panel off.
  let node = containingBoxOf(el);
  while (node && node !== doc.documentElement) {
    const style = view.getComputedStyle(node);
    // The body's overflow goes to the window while the root's is visible.
    if (clipsSideways(style) && node !== doc.body) {
      const box = node.getBoundingClientRect();
      const innerLeft = box.left + node.clientLeft;
      left = Math.max(left, innerLeft);
      right = Math.min(right, innerLeft + node.clientWidth);
    }
    // A fixed box is laid out against the window, so nothing above it clips
    // what is inside it. An absolute one skips to its own containing block.
    if (style.position === "fixed") break;
    node =
      style.position === "absolute"
        ? containingBoxOf(node)
        : node.parentElement;
  }
  return { left, right };
}

function containingBoxOf(el: Element): Element | null {
  return (
    (el instanceof HTMLElement ? el.offsetParent : null) ?? el.parentElement
  );
}

function clipsSideways(style: CSSStyleDeclaration): boolean {
  // `display: contents` has no box, and an inline box does not clip: their
  // client width reads 0, which would squeeze the bounds shut.
  if (style.display === "contents" || style.display === "inline") return false;
  // `overflow-y: auto` alone turns a `visible` x into `auto` as well, which is
  // how the Notes column clips. Browsers report that computed value, but a
  // reader that does not still has to treat the box as clipping.
  return CLIPPING.has(style.overflowX) || SCROLLING.has(style.overflowY);
}

/**
 * How far to move a panel sideways so its right edge keeps `gap` from the
 * bounds' right edge. Never so far that its left edge passes the bounds' left
 * edge plus `gap`: when the space is narrower than the panel, its start stays
 * in view. Zero when it already fits.
 */
export function shiftIntoBounds(
  panel: HorizontalBounds,
  bounds: HorizontalBounds,
  gap: number,
): number {
  const past = panel.right - (bounds.right - gap);
  if (past <= 0) return 0;
  return Math.min(0, Math.max(-past, bounds.left + gap - panel.left));
}
