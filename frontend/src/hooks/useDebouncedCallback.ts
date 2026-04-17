import { useRef, useCallback, useEffect } from "react";

export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number,
): ((...args: TArgs) => void) & { flush: () => void; cancel: () => void } {
  type T = (...args: TArgs) => void;
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingArgsRef = useRef<Parameters<T> | undefined>(undefined);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
      if (pendingArgsRef.current) {
        callbackRef.current(...pendingArgsRef.current);
        pendingArgsRef.current = undefined;
      }
    }
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
      pendingArgsRef.current = undefined;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      pendingArgsRef.current = args;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined;
        pendingArgsRef.current = undefined;
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  ) as T & { flush: () => void; cancel: () => void };

  debounced.flush = flush;
  debounced.cancel = cancel;

  return debounced;
}
