import { useCallback, useEffect, useRef, useState } from "react";
import { stampsEqual } from "../utils/updatedAtStamp";
import {
  mergeDocBlocks,
  sameDocContent,
  type BlockMergeResult,
} from "../utils/blockMerge";

/*
 * useBodySyncSession — keep ONE open document body in step with the server
 * while someone types into it (#2057).
 *
 * The note editor is built once per open and never re-reads the stored body,
 * and it used to save its whole buffer without asking which version that
 * buffer came from. A body written elsewhere while the note was open (MCP
 * `update_note`, another device) was therefore overwritten by the next
 * autosave, with no error anywhere. This hook is the missing half of the
 * editor: it remembers the version the buffer is based on and decides what
 * happens when the server's version moves.
 *
 *  - A save names the version it is based on. If the server has moved on, the
 *    save is refused and comes back with what is there now (D-4).
 *  - A refused save whose server body equals our base is not a conflict — a
 *    rename or a pin moved the version, not the text. It is retried against
 *    the new version without bothering anyone.
 *  - The server's version moving while nothing is pending (nothing typed since
 *    the last save landed) replaces the editor's body with the new one (D-1).
 *    Our own save's echo is told apart by version: the save's answer already
 *    moved our base to the version the echo carries (NOTE-SYNC-2).
 *  - The server's version moving while something IS pending — or a refused
 *    save whose server body really differs — is a conflict. Saving stops, and
 *    the host shows the choice: keep mine / take theirs / keep both (D-2).
 *  - A conflict still open when the editor goes away (the user switched notes)
 *    is settled as "keep both", so neither side's text is lost.
 *
 * Generic on purpose (NOTE-SYNC-6): nothing here knows about notes. The
 * host supplies how to save, how to read the current version, and how to read
 * the editor; the Daily / Template / Todo bodies can take the same hook later.
 *
 * One hook instance = one document. Mount it under the same key as the editor
 * it serves, so a different document starts a fresh session.
 */

export interface BodyVersion {
  content: string;
  /** The server version this content belongs to; null = not known yet. */
  updatedAt: string | null;
}

export interface BodyRemote {
  content: string;
  updatedAt: string;
}

export type BodySaveOutcome =
  | { status: "saved"; updatedAt: string }
  | { status: "conflict"; current: BodyRemote }
  | { status: "missing" };

export interface BodyConflict {
  /** The body both sides last had in common. */
  base: string;
  /** The editor's body when the conflict was found. */
  mine: string;
  /** What the server holds. */
  theirs: BodyRemote;
  /** Block-level comparison of the three, for the difference view. */
  merge: BlockMergeResult;
}

/** A body the editor should switch to, keyed by `seq` so a repeat applies. */
export interface BodyReplacement {
  content: string;
  seq: number;
}

export type BodyConflictChoice = "mine" | "theirs" | "both";

export interface UseBodySyncSessionOptions {
  /** The body the editor opened with, and its version. Read once. */
  initial: BodyVersion;
  /**
   * The newest server version the host has heard of (a list reload, say).
   * When it differs from the base, the session reads the current body.
   */
  remoteUpdatedAt: string | null;
  save: (
    content: string,
    expectedUpdatedAt: string | null,
  ) => Promise<BodySaveOutcome>;
  /** The body and version on the server now; null = gone. */
  fetchCurrent: () => Promise<BodyRemote | null>;
  /** The editor's current body, including keystrokes not yet committed. */
  readEditor: () => string | null;
  /** A save landed. */
  onSaved?: (content: string) => void;
  /** The editor now shows a body that came from elsewhere. */
  onAdopted?: (content: string) => void;
  onError?: (error: unknown) => void;
}

export interface BodySyncSession {
  /** Something was typed (call on every change, before the debounce). */
  markDirty: () => void;
  /** The debounced body to persist. */
  commit: (content: string) => void;
  conflict: BodyConflict | null;
  replacement: BodyReplacement | null;
  resolve: (choice: BodyConflictChoice) => void;
}

/** A refused save is retried this many times when only the version moved. */
const MAX_VERSION_RETRIES = 3;

export function useBodySyncSession(
  options: UseBodySyncSessionOptions,
): BodySyncSession {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const baseRef = useRef<BodyVersion>(options.initial);
  /** Bumped on every local change; `cleanRev` is the one the base matches. */
  const dirtyRevRef = useRef(0);
  const cleanRevRef = useRef(0);
  /** Saves in flight. A remote check waits for them to settle. */
  const savingRef = useRef(0);
  /** Saves run one after another, each against the version the last left. */
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  /** The last committed body that has not landed yet. */
  const pendingRef = useRef<string | null>(null);
  const conflictRef = useRef<BodyConflict | null>(null);
  const remoteRef = useRef<string | null>(options.remoteUpdatedAt);
  /**
   * A remote version arrived that has not been looked at yet. Only NEW news
   * triggers a read: re-checking after every save would compare against a
   * remote stamp the host has not caught up on yet, and read the server back
   * once per keystroke-save for nothing.
   */
  const remoteNewsRef = useRef(false);
  const checkGenRef = useRef(0);
  const seqRef = useRef(0);
  const disposedRef = useRef(false);
  /** The conflict settled as "both" on the way out; see `commit`. */
  const departedConflictRef = useRef<BodyConflict | null>(null);

  const [conflict, setConflict] = useState<BodyConflict | null>(null);
  const [replacement, setReplacement] = useState<BodyReplacement | null>(null);

  const isDirty = () =>
    dirtyRevRef.current !== cleanRevRef.current ||
    savingRef.current > 0 ||
    pendingRef.current !== null;

  const replaceEditor = (content: string) => {
    if (disposedRef.current) return;
    seqRef.current += 1;
    setReplacement({ content, seq: seqRef.current });
  };

  const reportError = (e: unknown) => optionsRef.current.onError?.(e);

  // The functions below call each other in a cycle (a save can find a
  // conflict, settling a conflict saves, a finished save re-checks the
  // remote), so they live on one ref-held object rather than in a chain of
  // useCallbacks that would each need the others as deps.
  const ops = useRef({
    enqueue(content: string, rev: number) {
      const run = chainRef.current.then(() =>
        ops.current.runSave(content, rev),
      );
      chainRef.current = run.catch(() => {});
    },

    async runSave(content: string, rev: number) {
      savingRef.current += 1;
      try {
        let expected = baseRef.current.updatedAt;
        for (let attempt = 0; attempt <= MAX_VERSION_RETRIES; attempt++) {
          const result = await optionsRef.current.save(content, expected);
          if (result.status === "saved") {
            ops.current.landed(content, result.updatedAt, rev);
            return;
          }
          if (result.status === "missing") {
            reportError(new Error("The document no longer exists."));
            return;
          }
          const current = result.current;
          // Only the version moved (a rename, a pin) — same text, new stamp.
          if (sameDocContent(current.content, baseRef.current.content)) {
            baseRef.current = {
              content: baseRef.current.content,
              updatedAt: current.updatedAt,
            };
            expected = current.updatedAt;
            continue;
          }
          // Somewhere else already wrote exactly what we were about to.
          if (sameDocContent(current.content, content)) {
            ops.current.landed(content, current.updatedAt, rev);
            return;
          }
          ops.current.enterConflict(current);
          return;
        }
        reportError(new Error("The save kept being refused."));
      } catch (e) {
        reportError(e);
      } finally {
        savingRef.current -= 1;
        ops.current.checkRemote();
      }
    },

    landed(content: string, updatedAt: string, rev: number) {
      baseRef.current = { content, updatedAt };
      if (dirtyRevRef.current === rev) cleanRevRef.current = rev;
      if (pendingRef.current === content) pendingRef.current = null;
      optionsRef.current.onSaved?.(content);
    },

    enterConflict(theirs: BodyRemote) {
      const base = baseRef.current.content;
      const mine =
        (disposedRef.current ? null : optionsRef.current.readEditor()) ??
        pendingRef.current ??
        base;
      const found: BodyConflict = {
        base,
        mine,
        theirs,
        merge: mergeDocBlocks(base, mine, theirs.content),
      };
      if (disposedRef.current) {
        ops.current.settleOnDeparture(found);
        return;
      }
      conflictRef.current = found;
      setConflict(found);
    },

    resolve(choice: BodyConflictChoice) {
      const open = conflictRef.current;
      if (!open) return;
      conflictRef.current = null;
      setConflict(null);
      const mine =
        optionsRef.current.readEditor() ?? pendingRef.current ?? open.mine;
      // Every choice continues from the server's version.
      baseRef.current = {
        content: open.theirs.content,
        updatedAt: open.theirs.updatedAt,
      };
      if (choice === "theirs") {
        pendingRef.current = null;
        cleanRevRef.current = dirtyRevRef.current;
        replaceEditor(open.theirs.content);
        optionsRef.current.onAdopted?.(open.theirs.content);
        return;
      }
      if (choice === "mine") {
        pendingRef.current = mine;
        ops.current.enqueue(mine, dirtyRevRef.current);
        return;
      }
      const merged = mergeDocBlocks(
        open.base,
        mine,
        open.theirs.content,
      ).merged;
      dirtyRevRef.current += 1;
      pendingRef.current = merged;
      replaceEditor(merged);
      ops.current.enqueue(merged, dirtyRevRef.current);
    },

    /** "Keep both" without a screen to ask on (see the file header). */
    settleOnDeparture(open: BodyConflict) {
      const mine = pendingRef.current ?? open.mine;
      const merged = mergeDocBlocks(
        open.base,
        mine,
        open.theirs.content,
      ).merged;
      departedConflictRef.current = open;
      conflictRef.current = null;
      baseRef.current = {
        content: open.theirs.content,
        updatedAt: open.theirs.updatedAt,
      };
      pendingRef.current = merged;
      ops.current.enqueue(merged, dirtyRevRef.current);
    },

    checkRemote() {
      if (!remoteNewsRef.current || disposedRef.current) return;
      // Held, not dropped, while a save is out: its answer moves the base,
      // and the news is judged against that.
      if (savingRef.current > 0 || conflictRef.current) return;
      remoteNewsRef.current = false;
      const remote = remoteRef.current;
      if (remote === null) return;
      if (stampsEqual(remote, baseRef.current.updatedAt)) return;
      const gen = ++checkGenRef.current;
      void optionsRef.current
        .fetchCurrent()
        .then((current) => {
          if (gen !== checkGenRef.current || disposedRef.current) return;
          if (current === null) return;
          // A save started meanwhile; its own answer settles the version.
          if (savingRef.current > 0 || conflictRef.current) return;
          if (stampsEqual(current.updatedAt, baseRef.current.updatedAt)) return;
          if (sameDocContent(current.content, baseRef.current.content)) {
            baseRef.current = {
              content: baseRef.current.content,
              updatedAt: current.updatedAt,
            };
            return;
          }
          if (!isDirty()) {
            baseRef.current = current;
            replaceEditor(current.content);
            optionsRef.current.onAdopted?.(current.content);
            return;
          }
          ops.current.enterConflict(current);
        })
        .catch(reportError);
    },
  });

  useEffect(() => {
    remoteRef.current = options.remoteUpdatedAt;
    remoteNewsRef.current = true;
    ops.current.checkRemote();
  }, [options.remoteUpdatedAt]);

  useEffect(() => {
    const current = ops.current;
    return () => {
      disposedRef.current = true;
      const open = conflictRef.current;
      if (open) current.settleOnDeparture(open);
    };
  }, []);

  const markDirty = useCallback(() => {
    dirtyRevRef.current += 1;
  }, []);

  const commit = useCallback((content: string) => {
    // The editor flushes its last keystrokes on the way out — possibly after
    // the conflict was already settled as "both". Those keystrokes are mine
    // too, so they are merged with theirs again rather than written over it.
    const departed = departedConflictRef.current;
    const body = departed
      ? mergeDocBlocks(departed.base, content, departed.theirs.content).merged
      : content;
    pendingRef.current = body;
    if (conflictRef.current) return; // held until the user chooses
    ops.current.enqueue(body, dirtyRevRef.current);
  }, []);

  const resolve = useCallback((choice: BodyConflictChoice) => {
    ops.current.resolve(choice);
  }, []);

  return { markDirty, commit, conflict, replacement, resolve };
}
