import { useSyncExternalStore } from "react";
import { getTimerState, subscribeTimer } from "../lib/timerEngine";
import type { TimerEngineState } from "../lib/timerEngine";

/**
 * Subscribe to a slice of the module-level timer engine. Mirrors `useMockStore`:
 * only components that select a changing slice (e.g. `remainingSec`) re-render on
 * each tick, so the running timer doesn't re-render the rest of the app.
 */
export function useTimer<T>(selector: (s: TimerEngineState) => T): T {
  return useSyncExternalStore(
    subscribeTimer,
    () => selector(getTimerState()),
    () => selector(getTimerState()),
  );
}
