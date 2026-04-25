// Re-export from canonical locations for backward compatibility
export type { UndoDomain, UndoCommand } from "../../../utils/undoRedo/types";
export { MAX_HISTORY_SIZE } from "../../../utils/undoRedo/types";
export { UndoRedoManager } from "../../../utils/undoRedo/UndoRedoManager";
export {
  UndoRedoContext,
  type UndoRedoContextValue,
} from "../../../context/UndoRedoContextValue";
export { UndoRedoProvider } from "../../../context/UndoRedoContext";
export { useUndoRedo } from "../../../hooks/useUndoRedo";
export { useUndoRedoKeyboard } from "./useUndoRedoKeyboard";
export { UndoRedoButtons } from "./UndoRedoButtons";
export { SECTION_UNDO_DOMAINS, getMobileUndoDomains } from "./sectionDomains";
