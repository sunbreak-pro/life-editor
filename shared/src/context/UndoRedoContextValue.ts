import { createContext } from "react";
import type { UndoRedoLike } from "../hooks/useTaskTreeHistory";

/*
 * UndoRedo context (Issue #304). The value implements UndoRedoLike so it can
 * be injected straight into the domain API hooks that push commands
 * (useTaskTreeAPI et al.), backed by a single GLOBAL history stack.
 *
 * The `domain` argument on undo/redo/canUndo/canRedo/clear is accepted for
 * UndoRedoLike compatibility but IGNORED — there is one shared stack, so the
 * header drives it with the no-arg forms (`undo()`, `canUndo()`), while a
 * domain hook that calls `undo("taskTree")` reverses the same global top. The
 * params are widened to optional here so the header can omit them.
 */
export interface UndoRedoContextValue extends UndoRedoLike {
  undo: (domain?: string) => void;
  redo: (domain?: string) => void;
  canUndo: (domain?: string) => boolean;
  canRedo: (domain?: string) => boolean;
  clear: (domain?: string) => void;
}

export const UndoRedoContext = createContext<UndoRedoContextValue | null>(null);
