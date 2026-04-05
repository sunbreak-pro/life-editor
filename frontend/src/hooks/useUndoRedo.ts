import { UndoRedoContext } from "../context/UndoRedoContextValue";
import { createContextHook } from "./createContextHook";

export const useUndoRedo = createContextHook(UndoRedoContext, "useUndoRedo");
