import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent,
  type PointerEvent,
} from "react";

/*
 * Long-press on a Notes sidebar row (#2008) — the narrow stand-in for the
 * Desktop right-click (#1677).
 *
 * WHY NOT `contextmenu`. Android Chrome fires one on a long-press, iOS Safari
 * does not, so listening for it would give the gesture to half the phones.
 * Pointer events arrive on both, and they also carry the two ways a press
 * stops being a press:
 *
 *   - the finger travels. More than MOVE_TOLERANCE_PX and it is a scroll or a
 *     drag, so the timer is dropped. A scroll the browser takes over also
 *     sends `pointercancel`, which drops it the same way.
 *   - the finger lifts early. That is a tap, and the row's own click runs as
 *     it always has.
 *
 * The click that can follow a long-press is swallowed in the capture phase,
 * so a heading that opened the editor does not also fold its group. The flag
 * is reset on the next press rather than on that click alone: a platform that
 * sends no click after a hold must not eat the NEXT tap instead.
 *
 * No `pointerType` check: jsdom has no PointerEvent to carry one, and a mouse
 * held down on a narrow window reaching the same editor harms nothing.
 */

/** How long the finger has to stay down — about the platform's own hold. */
export const LONG_PRESS_MS = 500;

/** Travel that turns a press into a scroll or a drag and cancels it. */
const MOVE_TOLERANCE_PX = 10;

export interface LongPressHandlers {
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onClickCapture: (event: MouseEvent) => void;
}

/**
 * Handlers to spread on the pressed element, or undefined when there is no
 * `onLongPress` — the caller then attaches nothing at all.
 */
export function useLongPress<T>(
  onLongPress: ((value: T) => void) | undefined,
  value: T,
): LongPressHandlers | undefined {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  // A row that unmounts mid-press (the list re-sorts under the finger) must
  // not open an editor for it half a second later.
  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      // A secondary button is a right-click, which is not this gesture.
      if (!onLongPress || event.button > 0) return;
      cancel();
      fired.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        origin.current = null;
        fired.current = true;
        onLongPress(value);
      }, LONG_PRESS_MS);
    },
    [onLongPress, value, cancel],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const from = origin.current;
      if (!from) return;
      const travel = Math.hypot(event.clientX - from.x, event.clientY - from.y);
      if (travel > MOVE_TOLERANCE_PX) cancel();
    },
    [cancel],
  );

  const onClickCapture = useCallback((event: MouseEvent) => {
    if (!fired.current) return;
    fired.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return useMemo(
    () =>
      onLongPress
        ? {
            onPointerDown,
            onPointerMove,
            onPointerUp: cancel,
            onPointerCancel: cancel,
            onPointerLeave: cancel,
            onClickCapture,
          }
        : undefined,
    [onLongPress, onPointerDown, onPointerMove, cancel, onClickCapture],
  );
}
