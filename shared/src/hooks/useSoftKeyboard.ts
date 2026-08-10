import { useCallback, useSyncExternalStore } from "react";

/*
 * "Is the soft keyboard covering the screen right now?" (#608)
 *
 * Sibling of `useVisualViewport` (#473), which answers "how big is the visible
 * area" for sizing an overlay. This one answers the yes/no question the narrow
 * shell asks: while the keyboard is up, the bottom tab bar has to get out of
 * the way instead of riding on top of it.
 *
 * The measurement is a shortfall against the tallest visible height seen so
 * far AT THIS WIDTH, which is deliberately independent of what the UA does to
 * the page. Chrome's `resizes-visual` default shrinks only the visual viewport;
 * a layout-resizing UA shrinks both — either way the visible height drops well
 * below its own high-water mark, and nothing else on a phone takes a third of
 * the screen. Comparing against `documentElement.clientHeight` instead looks
 * tempting but is wrong: on mobile the ICB tracks the LARGE viewport (address
 * bar hidden) while the visual viewport sits at the SMALL one, so that
 * subtraction reads ~60-110px of browser chrome as a permanent keyboard.
 *
 * Failure direction is deliberate: mounting while the keyboard is already up
 * seeds the baseline at the shrunk height and answers "closed", so the bar
 * stays visible until the keyboard closes once. A visible bar is recoverable;
 * navigation that vanishes and never comes back is not.
 *
 * Returns false on platforms without the API (jsdom, older browsers) — callers
 * then keep their normal layout rather than acting on a half-measurement.
 *
 * Pure display hook: no DataService / i18n (§3.1 / §6.4).
 */

/**
 * Below this the shortfall is browser chrome (an address bar sliding back in),
 * not a keyboard — phone keyboards take roughly a third of the screen.
 */
const KEYBOARD_MIN_HEIGHT_PX = 150;

/* The browser has one viewport, so every caller shares one measurement. */
let subscriberCount = 0;
let baselineWidth = 0;
let baselineHeight = 0;
let keyboardOpen = false;

function reset(): void {
  baselineWidth = 0;
  baselineHeight = 0;
  keyboardOpen = false;
}

/*
 * Measured from the viewport's own events, never during render: the baseline
 * is history, so a render-time read would make the answer depend on when React
 * happens to call it (#421's react-hooks/immutability guards the same shape).
 */
function measure(): void {
  const vv = typeof window === "undefined" ? null : window.visualViewport;
  if (!vv) return;
  // Pinch-zoom shrinks the visible area exactly like a keyboard does, and it
  // moves `width` too, which would otherwise reset the baseline into a false
  // positive that lasts as long as the user stays zoomed in.
  if ((vv.scale ?? 1) > 1) {
    keyboardOpen = false;
    return;
  }
  if (vv.width !== baselineWidth) {
    // Rotation or a resized window: a height from the old geometry would read
    // as a permanently-open keyboard in the new one.
    baselineWidth = vv.width;
    baselineHeight = 0;
  }
  baselineHeight = Math.max(baselineHeight, vv.height);
  keyboardOpen = baselineHeight - vv.height >= KEYBOARD_MIN_HEIGHT_PX;
}

export function useSoftKeyboard(active = true): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const vv = typeof window === "undefined" ? null : window.visualViewport;
      if (!active || !vv) return () => {};
      // A fresh mount measures from scratch: the baseline only means anything
      // while something is watching, and a stale one would answer for geometry
      // nobody has seen since.
      if (subscriberCount === 0) reset();
      subscriberCount += 1;
      measure();
      // resize = the keyboard opening/closing (or chrome sliding); the visual
      // viewport SCROLLING inside the layout viewport leaves the height alone,
      // so it cannot change this answer.
      const onResize = () => {
        measure();
        onChange();
      };
      vv.addEventListener("resize", onResize);
      return () => {
        subscriberCount -= 1;
        if (subscriberCount === 0) reset();
        vv.removeEventListener("resize", onResize);
      };
    },
    [active],
  );

  const getSnapshot = useCallback(
    () => (active ? keyboardOpen : false),
    [active],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
