import { createContext } from "react";
import type { UndoRedoLike } from "../hooks/useTodoTreeHistory";
import type { UndoConfirmGate } from "../utils/undoRedo/UndoRedoManager";

/*
 * UndoRedo context (Issue #304). The value implements UndoRedoLike so it can
 * be injected straight into the domain API hooks that push commands
 * (useTodoTreeAPI et al.), backed by a single GLOBAL history stack.
 *
 * The `domain` argument on undo/redo/canUndo/canRedo/clear is accepted for
 * UndoRedoLike compatibility but IGNORED — there is one shared stack, so the
 * header drives it with the no-arg forms (`undo()`, `canUndo()`), while a
 * domain hook that calls `undo("todoTree")` reverses the same global top. The
 * params are widened to optional here so the header can omit them.
 */
export interface UndoRedoContextValue extends UndoRedoLike {
  undo: (domain?: string) => void;
  redo: (domain?: string) => void;
  canUndo: (domain?: string) => boolean;
  canRedo: (domain?: string) => boolean;
  clear: (domain?: string) => void;
  /**
   * Register (or clear) the question asked before a command carrying a
   * `confirm` spec runs — #1638's repeat-scope dialog. The Schedule host owns
   * that dialog, so it registers while mounted and clears on unmount.
   */
  setConfirmGate: (gate: UndoConfirmGate | null) => void;
  /**
   * Drop the snapshot commands this domain pushed (#1727). Called by a domain
   * provider on unmount; commands that name their rows by id survive, so a
   * section switch no longer costs the user their history.
   */
  expireDomain: (domain: string) => void;
  /**
   * Offer (or withdraw) the focused body editor's history — #1690. The editor
   * registers on focus and clears on blur and on unmount; only one is ever
   * offered, because only one thing has focus.
   */
  setEditorHistory: (history: EditorHistory | null) => void;
  /**
   * The offer, or null when no body editor has focus. The header buttons read
   * this and drive it instead of the app stack, so they agree with Ctrl+Z.
   */
  editorHistory: EditorHistory | null;
}

/**
 * A body editor's OWN history, offered to the header while that editor has
 * focus (#1690).
 *
 * Two histories exist and always did: TipTap keeps its own for the text in a
 * note / daily / todo body, and `useGlobalShortcuts` deliberately lets Ctrl+Z
 * reach it rather than the app stack while a field is focused. The header
 * buttons had no such rule, so pressing Undo while typing reversed some other
 * screen's write — a schedule drag, say — and the two controls disagreed
 * about what "undo" meant.
 *
 * `subscribe` exists because the flags are not React state: an editor's
 * can-undo changes on every transaction, and the header reads it through
 * `useSyncExternalStore` so the buttons grey out in step with the typing.
 */
export interface EditorHistory {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Fires on every editor transaction. Returns the unsubscribe. */
  subscribe: (onChange: () => void) => () => void;
}

export const UndoRedoContext = createContext<UndoRedoContextValue | null>(null);
