/*
 * Placement for the editor's floating suggestion menus ("[[" item links and "/"
 * blocks). Both used to be pinned straight under the caret:
 *
 *     popup.style.top = `${rect.bottom + window.scrollY + 6}px`
 *
 * which is fine on a desktop window and wrong on a phone (#471). Two reasons:
 * the visible area is only the part of the page the soft keyboard has not
 * covered, and a caret sitting in the lower half of a tall bottom sheet leaves
 * no room below it at all — the menu opened underneath the keyboard, where it
 * could neither be read nor tapped.
 *
 * So the menu is placed against the VISIBLE area instead of the window:
 * `visualViewport` is the browser's own measurement of what the user can
 * actually see (it shrinks when the keyboard opens, and offsets when the page
 * is pinch-scrolled), with `window.inner*` as the fallback for anything that
 * does not implement it. When the menu does not fit below the caret it flips
 * above, and either way it is capped to the space on that side so it scrolls
 * internally instead of running off the screen.
 *
 * The geometry is a pure function so it can be tested without a layout — jsdom
 * has none (rules/frontend.md §テスト環境の制約), and this is exactly the kind
 * of arithmetic that silently breaks.
 */

/** Caret box, in client coordinates (what ProseMirror's clientRect returns). */
export interface CaretRect {
  top: number;
  bottom: number;
  left: number;
}

/**
 * The visible area, in the SAME client coordinates as the caret: on mobile the
 * soft keyboard covers the bottom of the layout viewport, so this is narrower
 * than `window.innerHeight` while typing.
 */
export interface VisibleArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SuggestionMenuPlacement {
  /** Client-coordinate offsets for the popup's top-left corner. */
  top: number;
  left: number;
  /** Cap for the menu's own scroller so it never exceeds the visible area. */
  maxHeight: number;
  side: "below" | "above";
}

/** Caret ↔ menu breathing room. */
const GAP = 6;
/** Keep-out margin against the edges of the visible area. */
const EDGE = 8;
/**
 * Floor for the cap. A menu squeezed to 40px is useless, and a caret can sit
 * with almost nothing on either side; better to overhang slightly (the menu
 * scrolls) than to render a sliver.
 */
const MIN_HEIGHT = 96;

/**
 * Where to put a suggestion menu of `menu` size for a caret at `caret`, given
 * the currently `visible` area. Prefers below the caret (the desktop behaviour
 * everyone is used to) and flips above only when the menu does not fit below
 * and there is genuinely more room above.
 */
export function placeSuggestionMenu({
  caret,
  menu,
  visible,
}: {
  caret: CaretRect;
  menu: { width: number; height: number };
  visible: VisibleArea;
}): SuggestionMenuPlacement {
  const spaceBelow = visible.bottom - EDGE - (caret.bottom + GAP);
  const spaceAbove = caret.top - GAP - (visible.top + EDGE);
  const side: "below" | "above" =
    menu.height <= spaceBelow || spaceAbove <= spaceBelow ? "below" : "above";

  const space = side === "below" ? spaceBelow : spaceAbove;
  const maxHeight = Math.max(MIN_HEIGHT, space);
  // Height the menu will actually occupy once capped. Used for the "above"
  // offset so a capped menu cannot be pushed off the top of the screen.
  const height = Math.min(menu.height, maxHeight);

  // Clamped into the visible area: with the floor above, a caret pinned to the
  // very edge would otherwise place the menu just outside it — off the top, or
  // back under the keyboard. Covering part of the caret is the lesser evil,
  // because a menu you cannot see is the same as no menu.
  const rawTop =
    side === "below" ? caret.bottom + GAP : caret.top - GAP - height;
  const top = Math.max(
    visible.top + EDGE,
    Math.min(rawTop, visible.bottom - EDGE - height),
  );

  // Horizontal: start at the caret, then pull back so the whole menu fits. The
  // left edge wins ties — on a narrow screen a menu wider than the viewport
  // should overflow to the right, where it can still be scrolled to, not off
  // the left where it cannot.
  const rightLimit = visible.right - EDGE - menu.width;
  const leftLimit = visible.left + EDGE;
  const left = Math.max(leftLimit, Math.min(caret.left, rightLimit));

  return { top, left, maxHeight, side };
}

/** Read the visible area from `visualViewport`, falling back to the window. */
export function readVisibleArea(): VisibleArea {
  const vv = window.visualViewport;
  if (!vv) {
    return {
      top: 0,
      bottom: window.innerHeight,
      left: 0,
      right: window.innerWidth,
    };
  }
  // offsetTop/offsetLeft are the visual viewport's offset WITHIN the layout
  // viewport, which is the coordinate space client rects live in — so these
  // stay directly comparable to the caret rect.
  return {
    top: vv.offsetTop,
    bottom: vv.offsetTop + vv.height,
    left: vv.offsetLeft,
    right: vv.offsetLeft + vv.width,
  };
}

export interface SuggestionPopup {
  /** The absolutely-positioned container the menu renderer is appended to. */
  readonly el: HTMLDivElement;
  /** Re-place the popup for the current caret rect (no-op without a rect). */
  position: (rect: DOMRect | null | undefined) => void;
  /** Remove the popup and stop listening for viewport changes. */
  destroy: () => void;
}

/**
 * Mount a popup container on `document.body` and keep it placed against the
 * visible area. `onMaxHeight` receives the cap for the menu's scroller — the
 * caller forwards it to the menu component, which is why placement is not
 * purely a style write.
 *
 * The viewport listeners are what make the keyboard case work: the caret does
 * not move when the keyboard opens (the layout viewport is unchanged), only the
 * visible area shrinks — so without them a menu opened before the keyboard
 * appeared would stay behind it.
 */
export function createSuggestionPopup(
  onMaxHeight: (maxHeight: number) => void,
): SuggestionPopup {
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.zIndex = "60";
  // Marks the live popup for tests (and for anyone inspecting the DOM): the menu
  // itself is portalled here from the editor, so there is otherwise nothing to
  // tell this container apart from any other absolutely-positioned div.
  el.dataset.suggestionMenu = "true";
  document.body.appendChild(el);

  let lastRect: DOMRect | null = null;
  let lastMaxHeight: number | null = null;

  const position = (rect: DOMRect | null | undefined) => {
    if (rect) lastRect = rect;
    if (!lastRect) return;
    const placement = placeSuggestionMenu({
      caret: lastRect,
      menu: { width: el.offsetWidth, height: el.offsetHeight },
      visible: readVisibleArea(),
    });
    el.style.left = `${placement.left + window.scrollX}px`;
    el.style.top = `${placement.top + window.scrollY}px`;
    // Only on a real change: this runs on every keystroke while the menu is
    // open, and the cap is a React prop — re-sending the same number would
    // re-render the menu for nothing.
    if (placement.maxHeight !== lastMaxHeight) {
      lastMaxHeight = placement.maxHeight;
      onMaxHeight(placement.maxHeight);
    }
  };

  const onViewportChange = () => position(null);
  window.visualViewport?.addEventListener("resize", onViewportChange);
  window.visualViewport?.addEventListener("scroll", onViewportChange);

  return {
    el,
    position,
    destroy: () => {
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
      el.remove();
    },
  };
}
