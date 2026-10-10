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
   * Offer the on-screen body editor's history — #1690, widened by #2141. The
   * editor offers on mount and again on focus, so with two bodies on screen
   * the one touched last is the one offered. `null` clears the offer.
   */
  setEditorHistory: (history: EditorHistory | null) => void;
  /**
   * Take back an offer, but only if it is still the current one — an editor
   * unmounting must not clear the offer a newer editor made since (#2141).
   */
  withdrawEditorHistory: (history: EditorHistory) => void;
  /**
   * The offer, or null when no body editor is on screen. Read through the
   * `*Latest` members below rather than driven directly.
   */
  editorHistory: EditorHistory | null;
  /**
   * The ONE undo every control calls — the header pair, Ctrl+Z outside a
   * body, and the phone's "More" sheet (#2141), so the three never disagree.
   *
   * While the offered body has focus it drives that body alone, as Ctrl+Z
   * inside it does (#1690). Otherwise it reverses whichever of the body's
   * history and the app stack holds the NEWER step (D-20261008-main-3).
   */
  undoLatest: () => void;
  /** Mirror of {@link undoLatest}: re-applies the step undone most recently. */
  redoLatest: () => void;
  /** Whether {@link undoLatest} has anything to run, by the same rule. */
  canUndoLatest: () => boolean;
  /** Whether {@link redoLatest} has anything to run, by the same rule. */
  canRedoLatest: () => boolean;
}

/**
 * A body editor's OWN history, offered to the header while that editor is on
 * screen (#1690 offered it on focus only; #2141 keeps it after blur).
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
  /**
   * Undo one step of the body. Puts focus back only when the body already has
   * it — from a blurred body it must not, or a phone reopens its keyboard.
   */
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Whether the body has focus right now. */
  isFocused: () => boolean;
  /** When the body's newest undo step was done, or null (#2141). */
  undoSeq: () => number | null;
  /** When the body's next redo step was undone, or null (#2141). */
  redoSeq: () => number | null;
  /**
   * Fires on every editor transaction and on focus / blur — the routing above
   * depends on both. Returns the unsubscribe.
   */
  subscribe: (onChange: () => void) => () => void;
}

export const UndoRedoContext = createContext<UndoRedoContextValue | null>(null);
