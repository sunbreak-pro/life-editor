import { useSyncExternalStore } from "react";
import { useUndoRedoContext } from "@life-editor/shared";

/*
 * useLatestHistory (#2141) — the undo/redo pair every control shows: the
 * header (HeaderUndoRedo) and the phone's "More" sheet (MobileShellActions).
 * Ctrl+Z outside a body calls the same `undoLatest` without the flags.
 */

const noSubscription = () => () => {};

/*
 * The flags move with two things the context value does not: every body
 * transaction, and focus entering or leaving the body. Both arrive through the
 * offered handle's own subscription, read with useSyncExternalStore so the
 * re-render stays with the controls rather than bumping the whole context on
 * each keystroke. App-stack changes already re-render through the context.
 */
export function useLatestHistory(): {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
} {
  const ctx = useUndoRedoContext();
  const subscribe = ctx.editorHistory?.subscribe ?? noSubscription;
  const canUndo = useSyncExternalStore(subscribe, ctx.canUndoLatest);
  const canRedo = useSyncExternalStore(subscribe, ctx.canRedoLatest);
  return { canUndo, canRedo, undo: ctx.undoLatest, redo: ctx.redoLatest };
}
