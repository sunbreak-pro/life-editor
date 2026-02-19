import { useContext } from "react";
import { UndoRedoContext } from "./UndoRedoContext";
import type { UndoRedoContextValue } from "./UndoRedoContext";

export function useUndoRedo(): UndoRedoContextValue {
  const ctx = useContext(UndoRedoContext);
  if (!ctx) {
    throw new Error("useUndoRedo must be used within UndoRedoProvider");
  }
  return ctx;
}
