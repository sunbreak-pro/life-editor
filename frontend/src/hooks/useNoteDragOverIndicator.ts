import { useContext, useCallback, useSyncExternalStore } from "react";
import { NoteDragOverStoreContext } from "./useNoteTreeDnd";

const noopSubscribe = (_listener: () => void) => () => {};

export function useNoteDragOverIndicator(
  nodeId: string,
): "above" | "below" | "inside" | null {
  const store = useContext(NoteDragOverStoreContext);

  const subscribe = store?.subscribe ?? noopSubscribe;
  const rawGetSnapshot = store?.getSnapshot;

  const getSnapshot = useCallback(() => {
    const info = rawGetSnapshot?.();
    if (!info || info.overId !== nodeId) return null;
    return info.position;
  }, [nodeId, rawGetSnapshot]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
