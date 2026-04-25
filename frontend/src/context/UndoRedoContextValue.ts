import { createContext } from "react";
import type { Editor } from "@tiptap/react";
import type { UndoDomain, UndoCommand } from "../utils/undoRedo/types";

export interface UndoRedoContextValue {
  push: (domain: UndoDomain, command: UndoCommand) => void;
  undo: (domain: UndoDomain) => Promise<void>;
  redo: (domain: UndoDomain) => Promise<void>;
  canUndo: (domain: UndoDomain) => boolean;
  canRedo: (domain: UndoDomain) => boolean;
  clear: (domain: UndoDomain) => void;
  setActiveDomain: (domain: UndoDomain | null) => void;
  getActiveDomain: () => UndoDomain | null;
  /* Multi-domain support */
  undoLatest: (domains: UndoDomain[]) => Promise<void>;
  redoLatest: (domains: UndoDomain[]) => Promise<void>;
  canUndoAny: (domains: UndoDomain[]) => boolean;
  canRedoAny: (domains: UndoDomain[]) => boolean;
  setActiveDomains: (domains: UndoDomain[] | null) => void;
  getActiveDomains: () => UndoDomain[] | null;
  /* TipTap editor integration — header Undo can route to active editor's own history */
  setActiveEditor: (editor: Editor | null) => void;
  getActiveEditor: () => Editor | null;
}

export const UndoRedoContext = createContext<UndoRedoContextValue | null>(null);
