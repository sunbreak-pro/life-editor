import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Hold an action back briefly so a follow-up gesture can cancel it (#355).
 *
 * The motivating case is click vs. double-click. The browser has no way to
 * tell them apart up front: a double-click fires `click` on its FIRST press
 * and only reveals itself later (`click`, `click`, `dblclick`). Anything the
 * single-click handler does immediately is therefore visible for a moment on
 * every double-click — the Schedule bubble popover flashed open and shut
 * before the detail overlay took over.
 *
 * `defer` schedules the work and `cancel` drops it if it has not run yet, so
 * the double-click handler can claim the gesture. A second `defer` supersedes
 * a pending one (the last gesture wins), and unmount cancels — a popover
 * opening after its host left the screen would be both wrong and a leak.
 *
 * Deliberately NOT a debounce: there is no trailing re-fire and no per-key
 * bookkeeping. Callers that need "run at most every N ms" want something else.
 */
export function useDeferredAction(delayMs: number): {
  defer: (fn: () => void) => void;
  cancel: () => void;
} {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const defer = useCallback(
    (fn: () => void) => {
      cancel();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        fn();
      }, delayMs);
    },
    [cancel, delayMs],
  );

  useEffect(() => cancel, [cancel]);

  return useMemo(() => ({ defer, cancel }), [defer, cancel]);
}
