/*
 * historyOrder (#2141) — which of two histories holds the NEWER step.
 *
 * Two histories exist side by side: the app stack (UndoRedoManager — tags,
 * schedule drags, todo moves) and a body editor's own TipTap history. While
 * the body has focus the header drives the body alone (#1690). Once focus has
 * left — the phone's keyboard closed, say — the header has to choose between
 * them, and the rule is "newer first" (D-20261008-main-3): type "abc", tag the
 * note, press Undo twice → the tag comes off, then "abc" goes.
 *
 * "Newer" needs one clock both sides read, so every step either history takes
 * on is stamped from the counter below. A step keeps its stamp when it moves
 * between that history's undo and redo sides, which is what makes the redo
 * rule work: the step undone LAST is the oldest stamp left on either redo top.
 */

let lastSeq = 0;

/** A stamp later than every stamp handed out before it. */
export function nextHistorySeq(): number {
  lastSeq += 1;
  return lastSeq;
}

export type HistorySide = "app" | "editor";

/**
 * The side whose undo top is newer, or null when both are empty. Each
 * argument is that side's top stamp, or null when it has nothing to undo.
 */
export function pickUndoSide(
  app: number | null,
  editor: number | null,
): HistorySide | null {
  if (app === null) return editor === null ? null : "editor";
  if (editor === null) return "app";
  return editor > app ? "editor" : "app";
}

/**
 * The side whose redo top was undone most recently — the OLDER stamp, since
 * undo always took the newest step left. Null when both are empty.
 */
export function pickRedoSide(
  app: number | null,
  editor: number | null,
): HistorySide | null {
  if (app === null) return editor === null ? null : "editor";
  if (editor === null) return "app";
  return editor < app ? "editor" : "app";
}

/**
 * What one editor transaction was, as far as its history is concerned.
 * - `history`: an undo or redo run by the history itself
 * - `recorded`: a document change the history recorded (typing, a paste)
 * - `other`: anything else (a selection move, an unrecorded replacement)
 */
export type EditorTransactionKind = "history" | "recorded" | "other";

/**
 * Stamps for one editor's history, kept in step with it from the outside.
 *
 * prosemirror-history does not say what a transaction did to it, only how
 * deep each side is afterwards (`undoDepth` / `redoDepth`) and whether the
 * transaction was its own undo/redo. That is enough: a history transaction
 * that shortens the undo side moved one step to redo, one that lengthens it
 * moved a step back. A recorded change that deepens the undo side is a new
 * step; one that leaves the depths alone was folded into the top step (TipTap
 * groups keystrokes that arrive close together), so that step is re-stamped —
 * it now ends later than anything else.
 *
 * Anything else (a depth cap trimming the bottom, a history reset) is
 * reconciled by trimming or padding at the OLD end, with stamp 0 — older than
 * every real step, so it never jumps ahead of the app stack.
 */
export class EditorHistoryOrder {
  private undoSeqs: number[];
  private redoSeqs: number[];

  constructor(undoDepth = 0, redoDepth = 0) {
    this.undoSeqs = new Array<number>(undoDepth).fill(0);
    this.redoSeqs = new Array<number>(redoDepth).fill(0);
  }

  /** Record one transaction, given the depths it left behind. */
  observe(
    undoDepth: number,
    redoDepth: number,
    kind: EditorTransactionKind,
  ): void {
    const u = this.undoSeqs;
    const r = this.redoSeqs;
    if (kind === "history") {
      if (undoDepth === u.length - 1 && redoDepth === r.length + 1) {
        r.push(u.pop() as number);
        return;
      }
      if (undoDepth === u.length + 1 && redoDepth === r.length - 1) {
        u.push(r.pop() as number);
        return;
      }
    } else if (kind === "recorded") {
      if (undoDepth === u.length + 1) {
        u.push(nextHistorySeq());
      } else if (undoDepth === u.length && undoDepth > 0) {
        u[u.length - 1] = nextHistorySeq();
      }
    }
    fit(u, undoDepth);
    fit(r, redoDepth);
  }

  /** The newest undo step's stamp, or null when there is nothing to undo. */
  undoSeq(): number | null {
    return this.undoSeqs.length > 0
      ? this.undoSeqs[this.undoSeqs.length - 1]
      : null;
  }

  /** The next redo step's stamp, or null when there is nothing to redo. */
  redoSeq(): number | null {
    return this.redoSeqs.length > 0
      ? this.redoSeqs[this.redoSeqs.length - 1]
      : null;
  }
}

/** Trim or pad at the old end (index 0) until the length matches. */
function fit(seqs: number[], depth: number): void {
  if (seqs.length > depth) seqs.splice(0, seqs.length - depth);
  while (seqs.length < depth) seqs.unshift(0);
}
