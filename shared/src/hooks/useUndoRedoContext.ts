import { UndoRedoContext } from "../context/UndoRedoContextValue";
import { createContextHook } from "./createContextHook";
import { createOptionalContextHook } from "./createOptionalContextHook";

/** Required UndoRedo context (throws outside an UndoRedoProvider). */
export const useUndoRedoContext = createContextHook(
  UndoRedoContext,
  "useUndoRedoContext",
);

/**
 * Optional UndoRedo context — returns null when no provider is mounted (tests /
 * standalone). Domain providers use this to auto-connect to the global stack
 * without a hard dependency (fall back to the no-op history when absent).
 */
export const useUndoRedoOptional = createOptionalContextHook(UndoRedoContext);
