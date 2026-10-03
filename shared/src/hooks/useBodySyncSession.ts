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
 *    The base only moves once the editor reports the replacement APPLIED: the
 *    editor re-checks at that moment, and typing that landed in between (an
 *    IME composition being committed, typically) turns it into a conflict
 *    instead of being overwritten — or, worse, being saved on top of a base
 *    that already claims the other side's version.
 *    Our own save's echo is told apart by version: the save's answer already
 *    moved our base to the version the echo carries (NOTE-SYNC-2).
 *  - The server's version moving while something IS pending — or a refused
 *    save whose server body really differs — is a conflict. Saving stops, and
 *    the host shows the choice: keep mine / take theirs / keep both (D-2).
 *  - A conflict still open when the editor goes away (the user switched notes)
 *    is settled as "keep both", so neither side's text is lost.
 *  - On open, the body is checked against the server once. The host's body and
 *    version are two separate memories, and a save that never landed can leave
 *    them describing different writes; saving against that pair would pass
 *    the check while replacing a body nobody here has seen.
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

/**
 * A body the editor should switch to, keyed by `seq` so a repeat applies.
 * Unforced = "only if nothing was typed since": the editor asks `canApply`
 * at the moment it would apply and reports the outcome through `onSettled`.
 */
export interface BodyReplacement {
  content: string;
  seq: number;
  force: boolean;
  canApply: () => boolean;
  onSettled: (applied: boolean) => void;
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
  /** Bumped whenever the base moves on our side; a stale read is dropped. */
  const baseGenRef = useRef(0);
  /** An unforced replacement is out with the editor, not yet settled. */
  const replacingRef = useRef(false);
  /** The one-time check of the opened body against the server. */
  const mountCheckRef = useRef(true);
  /**
   * That check has not answered yet. Saves wait for it: a save sent first
   * would be made against the very pair the check exists to vouch for, and
   * on a slow line the 800ms debounce easily beats the read.
   */
  const mountPendingRef = useRef(true);
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

  const replaceEditor = (
    content: string,
    unforced?: {
      canApply: () => boolean;
      onSettled: (applied: boolean) => void;
    },
  ) => {
    if (disposedRef.current) return;
    seqRef.current += 1;
    setReplacement({
      content,
      seq: seqRef.current,
      force: unforced === undefined,
      canApply: unforced?.canApply ?? (() => true),
      onSettled: unforced?.onSettled ?? (() => {}),
    });
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
      baseGenRef.current += 1;
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
      baseGenRef.current += 1;
      // Anything newer that arrived while the banner was up is looked at
      // once this choice has settled (a save's `finally`, or right away).
      remoteNewsRef.current = true;
      if (choice === "theirs") {
        pendingRef.current = null;
        cleanRevRef.current = dirtyRevRef.current;
        replaceEditor(open.theirs.content);
        optionsRef.current.onAdopted?.(open.theirs.content);
        ops.current.checkRemote();
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

    /** The check on open answered (or failed): let held saves go. */
    mountSettled() {
      if (!mountPendingRef.current) return;
      mountPendingRef.current = false;
      const held = pendingRef.current;
      if (held !== null && !conflictRef.current) {
        ops.current.enqueue(held, dirtyRevRef.current);
      }
      ops.current.checkRemote();
    },

    checkRemote() {
      const mountCheck = mountCheckRef.current;
      if (!mountCheck && !remoteNewsRef.current) return;
      if (disposedRef.current) return;
      // Held, not dropped, while a save, a replacement or the check on open
      // is out: its outcome moves the base, and the news is judged against it.
      if (savingRef.current > 0 || conflictRef.current || replacingRef.current)
        return;
      if (!mountCheck && mountPendingRef.current) return;
      remoteNewsRef.current = false;
      mountCheckRef.current = false;
      const remote = remoteRef.current;
      if (!mountCheck) {
        if (remote === null) return;
        if (stampsEqual(remote, baseRef.current.updatedAt)) return;
      }
      const gen = ++checkGenRef.current;
      const baseGen = baseGenRef.current;
      void optionsRef.current
        .fetchCurrent()
        .then((current) => {
          if (disposedRef.current) return;
          if (gen !== checkGenRef.current) return;
          if (current === null) return;
          // A save landed while this read was out: the read may predate it,
          // and our own older body would pass for a write from elsewhere.
          if (baseGenRef.current !== baseGen) return;
          // A save started meanwhile; its own answer settles the version.
          if (savingRef.current > 0 || conflictRef.current) return;
          const base = baseRef.current;
          const sameBody = sameDocContent(current.content, base.content);
          if (stampsEqual(current.updatedAt, base.updatedAt)) {
            if (sameBody || !mountCheck) return;
            // Same version, different body: the opened pair does not belong
            // together (see the header). There is no common base to merge
            // from, so "keep both" keeps every block of each side.
            baseRef.current = { content: "", updatedAt: base.updatedAt };
            ops.current.enterConflict(current);
            return;
          }
          if (sameBody) {
            baseRef.current = {
              content: base.content,
              updatedAt: current.updatedAt,
            };
            return;
          }
          if (isDirty()) {
            ops.current.enterConflict(current);
            return;
          }
          const rev = dirtyRevRef.current;
          // replaceEditor numbers this replacement next.
          const mySeq = seqRef.current + 1;
          replacingRef.current = true;
          replaceEditor(current.content, {
            canApply: () =>
              dirtyRevRef.current === rev &&
              savingRef.current === 0 &&
              pendingRef.current === null &&
              conflictRef.current === null,
            onSettled: (applied) => {
              replacingRef.current = false;
              if (disposedRef.current) return;
              // Superseded by a later replacement (a choice in the banner):
              // that one owns the outcome.
              if (seqRef.current !== mySeq) return;
              if (applied) {
                baseRef.current = current;
                baseGenRef.current += 1;
                optionsRef.current.onAdopted?.(current.content);
                ops.current.checkRemote();
                return;
              }
              // Typed in between: the replacement did not go in, and the
              // base still names the version that typing was built on.
              if (!conflictRef.current) ops.current.enterConflict(current);
            },
          });
        })
        .catch(reportError)
        .finally(() => {
          if (mountCheck) ops.current.mountSettled();
        });
    },
  });

  /*
   * Mount / unmount. The body resets `disposedRef` because StrictMode runs a
   * cleanup and a second setup on every mount in development: without the
   * reset the session would think it had already been unmounted and stop
   * following the server, raising the banner, and checking the opened body —
   * exactly what the dev-server checks of this feature would look at.
   * Declared before the remote effect so the second setup has reset it by the
   * time that effect checks.
   */
  useEffect(() => {
    disposedRef.current = false;
    const current = ops.current;
    return () => {
      disposedRef.current = true;
      const open = conflictRef.current;
      if (open) current.settleOnDeparture(open);
    };
  }, []);

  useEffect(() => {
    remoteRef.current = options.remoteUpdatedAt;
    remoteNewsRef.current = true;
    ops.current.checkRemote();
  }, [options.remoteUpdatedAt]);

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
    // Held until the check on open answers — except on the way out, where
    // nothing would ever release it.
    if (mountPendingRef.current && !disposedRef.current) return;
    ops.current.enqueue(body, dirtyRevRef.current);
  }, []);

  const resolve = useCallback((choice: BodyConflictChoice) => {
    ops.current.resolve(choice);
  }, []);

  return { markDirty, commit, conflict, replacement, resolve };
}
