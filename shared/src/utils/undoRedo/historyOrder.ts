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
 * "Newer" needs one clock both sides read, so both stamp from the counter
 * below, twice per step:
 * - `seq` when the step is DONE. Undo takes the side whose top was done last.
 * - `undoneAt` when the step is UNDONE. Redo takes the side whose top was
 *   undone last. The done stamp cannot answer that: a tag undone before some
 *   later typing was undone still has the older done stamp, yet it was not
 *   the last thing taken back.
 * A step keeps its done stamp across undo and redo, so redoing it puts it
 * back in its old place in the undo order.
 */

let lastSeq = 0;

/** A stamp later than every stamp handed out before it. */
export function nextHistorySeq(): number {
  lastSeq += 1;
  return lastSeq;
}

export type HistorySide = "app" | "editor";

/** The newer of two stamps' sides, or null when both are empty. */
function newer(app: number | null, editor: number | null): HistorySide | null {
  if (app === null) return editor === null ? null : "editor";
  if (editor === null) return "app";
  return editor > app ? "editor" : "app";
}

/**
 * The side whose undo top was done last. Each argument is that side's top
 * DONE stamp, or null when it has nothing to undo.
 */
export function pickUndoSide(
  app: number | null,
  editor: number | null,
): HistorySide | null {
  return newer(app, editor);
}

/**
 * The side whose redo top was undone last. Each argument is that side's top
 * UNDONE stamp, or null when it has nothing to redo.
 */
export function pickRedoSide(
  app: number | null,
  editor: number | null,
): HistorySide | null {
  return newer(app, editor);
}

/**
 * What one editor transaction was, as far as its history is concerned.
 * - `history`: an undo or redo run by the history itself
 * - `recorded`: a document change the history recorded (typing, a paste)
 * - `other`: anything else (a selection move, an unrecorded replacement)
 */
export type EditorTransactionKind = "history" | "recorded" | "other";

interface UndoneStep {
  seq: number;
  undoneAt: number;
}

/**
 * Stamps for one editor's history, kept in step with it from the outside.
 *
 * prosemirror-history does not say what a transaction did to it, only how
 * deep each side is afterwards (`undoDepth` / `redoDepth`) and whether the
 * transaction was its own undo/redo. That is enough:
 * - A history transaction that shortens the undo side by one and lengthens
 *   the redo side by one was an undo; the reverse was a redo. One that only
 *   shortens the undo side was an undo whose changes had all been replaced
 *   from elsewhere — the history drops that step and records nothing to redo.
 * - A recorded change that does not leave the undo side at the same depth is
 *   a new step. Usually the side grows by one; past prosemirror-history's cap
 *   it is trimmed in the same transaction and SHRINKS, so "not the same" is
 *   the test, not "one deeper". One that leaves the depth alone was folded
 *   into the top step (TipTap groups keystrokes that arrive close together),
 *   so that step is re-stamped — it now ends later than anything else.
 *
 * Anything else is reconciled by trimming or padding at the OLD end, with
 * stamp 0 — older than every real step, so it never jumps ahead of the app
 * stack.
 */
export class EditorHistoryOrder {
  private undoSeqs: number[];
  private redoSteps: UndoneStep[];

  constructor(undoDepth = 0, redoDepth = 0) {
    this.undoSeqs = new Array<number>(undoDepth).fill(0);
    this.redoSteps = Array.from({ length: redoDepth }, () => ({
      seq: 0,
      undoneAt: 0,
    }));
  }

  /** Record one transaction, given the depths it left behind. */
  observe(
    undoDepth: number,
    redoDepth: number,
    kind: EditorTransactionKind,
  ): void {
    const u = this.undoSeqs;
    const r = this.redoSteps;
    if (kind === "history") {
      if (undoDepth === u.length - 1 && redoDepth === r.length + 1) {
        r.push({ seq: u.pop() as number, undoneAt: nextHistorySeq() });
        return;
      }
      if (undoDepth === u.length + 1 && redoDepth === r.length - 1) {
        u.push((r.pop() as UndoneStep).seq);
        return;
      }
      if (undoDepth === u.length - 1 && redoDepth === r.length) {
        u.pop();
        return;
      }
    } else if (kind === "recorded" && undoDepth > 0) {
      if (undoDepth === u.length) u[u.length - 1] = nextHistorySeq();
      else u.push(nextHistorySeq());
    }
    fit(u, undoDepth, () => 0);
    fit(r, redoDepth, () => ({ seq: 0, undoneAt: 0 }));
  }

  /** The DONE stamp of the newest undo step, or null when there is none. */
  undoSeq(): number | null {
    return this.undoSeqs.length > 0
      ? this.undoSeqs[this.undoSeqs.length - 1]
      : null;
  }

  /** The UNDONE stamp of the next redo step, or null when there is none. */
  redoSeq(): number | null {
    return this.redoSteps.length > 0
      ? this.redoSteps[this.redoSteps.length - 1].undoneAt
      : null;
  }
}

/** Trim or pad at the old end (index 0) until the length matches. */
function fit<T>(items: T[], depth: number, pad: () => T): void {
  if (items.length > depth) items.splice(0, items.length - depth);
  while (items.length < depth) items.unshift(pad());
}
