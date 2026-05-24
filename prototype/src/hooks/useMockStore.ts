import { useSyncExternalStore } from "react";
import { getState, subscribe } from "../lib/mockStore";
import type { MockState } from "../lib/types";

export function useMockStore<T>(selector: (s: MockState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(getState()),
  );
}
