/*
 * What a send from the outbox tells the screen about a note (#2337). The sender
 * runs without any screen, from SyncContext, so nothing can be handed to it.
 *
 * A separate note deserves a notice even if it was made before anyone listened
 * (the send at app start), so notices wait for the first listener. A conflict
 * only means something to an editor open on that note right now, so one nobody
 * hears is dropped: the separate note already holds the text.
 */

export interface NoteSeparatedNotice {
  /** The separate note's title. */
  title: string;
  reason: "conflict" | "gone";
}

export interface NoteSendConflict {
  base: string;
  mine: string;
  theirs: { content: string; updatedAt: string };
}

let waiting: NoteSeparatedNotice[] = [];
const noticeListeners = new Set<(notice: NoteSeparatedNotice) => void>();
const conflictListeners = new Map<
  string,
  Set<(conflict: NoteSendConflict) => void>
>();

export function reportNoteSeparated(
  noteId: string,
  notice: NoteSeparatedNotice,
  conflict?: NoteSendConflict,
): void {
  if (noticeListeners.size === 0) waiting.push(notice);
  for (const listener of noticeListeners) listener(notice);
  if (conflict === undefined) return;
  for (const listener of conflictListeners.get(noteId) ?? []) {
    listener(conflict);
  }
}

export function subscribeNoteSeparated(
  listener: (notice: NoteSeparatedNotice) => void,
): () => void {
  noticeListeners.add(listener);
  const held = waiting;
  waiting = [];
  for (const notice of held) listener(notice);
  return () => {
    noticeListeners.delete(listener);
  };
}

export function subscribeNoteConflicts(
  noteId: string,
  listener: (conflict: NoteSendConflict) => void,
): () => void {
  const listeners = conflictListeners.get(noteId) ?? new Set();
  listeners.add(listener);
  conflictListeners.set(noteId, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) conflictListeners.delete(noteId);
  };
}
