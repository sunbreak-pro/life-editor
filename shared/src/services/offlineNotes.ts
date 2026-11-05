import type { DataService } from "./DataService";
import type { OwnerResolver, DroppedTodos } from "./offlineDataService";
import type { NoteBodySaveResult, NoteNode } from "../types/note";
import {
  patchDomainSnapshot,
  readDomainSnapshot,
} from "../state/domainSnapshotStore";
import {
  forgetNoteBody,
  readNoteBody,
  rememberNoteBody,
} from "../state/noteBodyStore";
import {
  coalesceNoteBody,
  isOfflineFailure,
  OUTBOX_OPEN_TIMEOUT_MS,
  OUTBOX_READ_TIMEOUT_MS,
  queueNote,
  readNoteEntries,
  removeOutboxEntry,
  requestOutboxSend,
  settleSentNote,
  withTimeout,
  type NoteOutboxEntry,
} from "../state/outbox";
import { reportNoteSeparated } from "../state/noteSendEvents";
import { mergeDocBlocks, sameDocContent } from "../utils/blockMerge";

/*
 * Notes behind the outbox (#2337 — plan 2026-10-21-offline-cache.md P2c).
 *
 * Offline, a note can be created, and a pinned note or one created offline can
 * have its body edited. Everything else keeps failing as it did. A note with a
 * password is never held: its text stays off the device.
 *
 * `noteOverrides` is the write and read half, and `sendNoteEntry` is the sender's.
 * While an entry waits, it IS the note on this device: reads answer from it, and
 * a later save goes into it even with the network back, because a save sent past
 * it would then be overwritten by the older body in the box. A note cannot take a
 * password while an entry waits: its text would stay on the device.
 *
 * Reading one note waits for a cold box (`heldEntry`). Answering from the server
 * instead would open the older body, and the next save would replace the entry
 * with it, past every version check. A box that has already failed to answer gets
 * the short budget, so it costs one slow read and not one per note.
 *
 * The base comes from `noteBodyStore`, under the version the editor names, and it
 * has to be read before anything awaits: the hook's own effect replaces that slot
 * with the body being saved as soon as it renders. A landed save stores its pair
 * there for the same reason. With no base there is nothing to merge from, so the
 * send keeps the server's version and saves this body as a note of its own.
 *
 * What a send can find on the server (the plan's conflict rules, in order):
 * - the version it expected: saved;
 * - a newer version: a three-way merge, sent against that version;
 * - a newer version that changed the same blocks, or none at all: the server
 *   stays as it is, and this body becomes a separate note.
 *
 * The separate note's id comes from the entry's opId and `rev`, so sending the
 * same text again after a lost response finds the first copy. A later `rev` holds
 * text the first copy does not have, so it is a note of its own. The time in its
 * title is the first edit's, in this device's time zone. It is only a label. The
 * title uses the approved literal: the sender has no host copy to translate with,
 * and a stored title does not follow the language afterwards anyway.
 */

/** A merge may be overtaken again; after this many the body is kept apart. */
const MAX_SEND_TRIES = 3;

export type NoteSendTarget = Pick<
  DataService,
  "createNoteIfAbsent" | "sendNoteBody" | "getNoteBodySnapshotUnified"
>;

function withoutMark(node: NoteNode): NoteNode {
  const row = { ...node };
  delete row.createdOffline;
  return row;
}

export function dropNoteFromSnapshot(id: string): void {
  patchDomainSnapshot<NoteNode[]>("notes", (rows) =>
    rows.filter((n) => n.id !== id),
  );
}

/** What an open or a reload should see of a waiting note. */
function heldNode({ kind, baseUpdatedAt, payload }: NoteOutboxEntry): NoteNode {
  const node = {
    ...payload.node,
    updatedAt: baseUpdatedAt ?? payload.node.updatedAt,
  };
  return kind === "note.create" ? { ...node, createdOffline: true } : node;
}

function savedAs(
  entry: NoteOutboxEntry,
  expected: string | null,
): NoteBodySaveResult {
  return {
    status: "saved",
    updatedAt: entry.baseUpdatedAt ?? expected ?? entry.payload.node.updatedAt,
  };
}

export function noteOverrides(
  inner: DataService,
  owner: OwnerResolver,
  dropped: DroppedTodos,
  self: () => DataService | null,
): Partial<DataService> {
  let boxFailed = false;
  /** The online paths must not hang on a box that does not answer. */
  const readEntries = async (
    budgetMs: number = OUTBOX_READ_TIMEOUT_MS,
  ): Promise<NoteOutboxEntry[] | null> => {
    const userId = await owner();
    if (userId === null) return null;
    try {
      const rows = await withTimeout(readNoteEntries(userId), budgetMs);
      boxFailed = false;
      return rows;
    } catch {
      if (budgetMs > OUTBOX_READ_TIMEOUT_MS) boxFailed = true;
      return null;
    }
  };
  /** Past the open's own limit: see the file header. */
  const heldEntry = async (id: string): Promise<NoteOutboxEntry | undefined> =>
    (
      await readEntries(
        boxFailed
          ? OUTBOX_READ_TIMEOUT_MS
          : OUTBOX_OPEN_TIMEOUT_MS + OUTBOX_READ_TIMEOUT_MS,
      )
    )?.find((e) => e.itemId === id);

  /** The stored list row: the one fact source that survives an offline reload. */
  const listRow = (id: string): NoteNode | undefined =>
    readDomainSnapshot<NoteNode[]>("notes", self(), undefined)?.data.find(
      (n) => n.id === id,
    );

  const dropEntry = async (entry: NoteOutboxEntry): Promise<void> => {
    const userId = await owner();
    if (userId === null) return;
    await removeOutboxEntry(userId, entry.opId);
    dropped.add(entry.itemId);
    dropNoteFromSnapshot(entry.itemId);
    if (entry.attempts === 0) return;
    // A send got part-way: tidied when the network allows.
    void inner
      .permanentDeleteNoteUnified(entry.itemId)
      .catch((e: unknown) => console.warn("[outbox] tidy", e));
  };

  /**
   * A read must not make a waiting note vanish, and a row marked earlier loses
   * its mark, or the row itself if the server refused it.
   */
  const withWaiting = async (rows: NoteNode[]): Promise<NoteNode[]> => {
    const held = await readEntries();
    if (held === null) return rows;
    const creates = held.filter((e) => e.kind === "note.create");
    const waitingIds = new Set(creates.map((e) => e.itemId));
    const kept = rows.flatMap((n) => {
      if (n.createdOffline !== true || waitingIds.has(n.id)) return [n];
      return dropped.has(n.id) ? [] : [withoutMark(n)];
    });
    const known = new Set(kept.map((n) => n.id));
    const waiting = creates
      .filter((e) => !known.has(e.itemId))
      .map((e) => ({ ...heldNode(e), content: "" }));
    return waiting.length > 0 ? [...waiting, ...kept] : kept;
  };

  return {
    async listNotesUnified() {
      return withWaiting(await inner.listNotesUnified());
    },

    async fetchNoteChanges(cursor, base) {
      const read = await inner.fetchNoteChanges(cursor, base);
      return read && { ...read, data: await withWaiting(read.data) };
    },

    async getNoteUnified(id) {
      const held = await heldEntry(id);
      return held ? heldNode(held) : inner.getNoteUnified(id);
    },

    async getNoteBodySnapshotUnified(id) {
      const held = await heldEntry(id);
      if (!held) return inner.getNoteBodySnapshotUnified(id);
      const { content, updatedAt } = heldNode(held);
      return { content, updatedAt };
    },

    /** The read after a password is checked: the waiting body is the newer one. */
    async getNoteBodyUnified(id) {
      const held = await heldEntry(id);
      return held ? held.payload.node.content : inner.getNoteBodyUnified(id);
    },

    async setNotePasswordUnified(id, password) {
      if (await heldEntry(id)) {
        throw new Error("setNotePasswordUnified: the note waits in the outbox");
      }
      return inner.setNotePasswordUnified(id, password);
    },

    async createNoteUnified(node) {
      try {
        const created = await inner.createNoteUnified(node);
        dropped.delete(created.id);
        return created;
      } catch (error) {
        if (
          !isOfflineFailure(error) ||
          node.type !== "note" ||
          node.hasPassword === true
        )
          throw error;
        const userId = await owner();
        if (userId === null) throw error;
        const entry = await queueNote(userId, "note.create", node, {
          updatedAt: null,
        }).catch(() => {
          throw error;
        });
        dropped.delete(node.id);
        const row = { ...heldNode(entry), content: "" };
        patchDomainSnapshot<NoteNode[]>("notes", (rows) =>
          rows.some((n) => n.id === node.id) ? rows : [row, ...rows],
        );
        requestOutboxSend();
        return heldNode(entry);
      }
    },

    async saveNoteBodyUnified(id, content, expected) {
      // Before any await: see the file header.
      const base = expected === null ? null : readNoteBody(self(), id, expected);
      const row = listRow(id);
      const userId = await owner();
      // A password from another device: its text stays off this one.
      if (userId !== null && row?.hasPassword !== true) {
        const held = await withTimeout(
          coalesceNoteBody(userId, id, content),
          OUTBOX_READ_TIMEOUT_MS,
        ).catch(() => null);
        if (held) {
          requestOutboxSend();
          return savedAs(held, expected);
        }
      }
      try {
        const result = await inner.saveNoteBodyUnified(id, content, expected);
        if (result.status === "saved" && row?.hasPassword !== true) {
          rememberNoteBody(self(), id, result.updatedAt, content);
        }
        return result;
      } catch (error) {
        const mayWait =
          row !== undefined &&
          row.hasPassword !== true &&
          (row.isPinned || row.createdOffline === true);
        if (!mayWait || userId === null || !isOfflineFailure(error))
          throw error;
        const entry = await queueNote(
          userId,
          "note.body",
          { ...withoutMark(row), content },
          base === null
            ? { updatedAt: null }
            : { updatedAt: expected, content: base },
        ).catch(() => {
          throw error;
        });
        requestOutboxSend();
        return savedAs(entry, expected);
      }
    },

    /**
     * A body written to a waiting note joins its entry. Anything else cannot be
     * written to a note that is not on the server yet, and saying so beats a
     * silent no-op: the write's caller reports the failure.
     */
    async updateNoteUnified(id, updates) {
      const held = await heldEntry(id);
      const bodyOnly =
        Object.keys(updates).length === 1 && updates.content !== undefined;
      if (held && bodyOnly) {
        const userId = await owner();
        const next =
          userId === null
            ? null
            : await coalesceNoteBody(userId, id, updates.content ?? "");
        if (next) {
          requestOutboxSend();
          return heldNode(next);
        }
        // The send finished between the read and now: the note is on the server.
        return inner.updateNoteUnified(id, updates);
      }
      if (held?.kind === "note.create") {
        throw new Error("updateNoteUnified: the note waits in the outbox");
      }
      const updated = await inner.updateNoteUnified(id, updates);
      // The next offline save asks the stored row whether the note is pinned.
      if (updates.isPinned !== undefined) {
        const isPinned = updates.isPinned;
        patchDomainSnapshot<NoteNode[]>("notes", (rows) =>
          rows.map((n) => (n.id === id ? { ...n, isPinned } : n)),
        );
      }
      return updated;
    },

    /** A waiting note with text cannot go to a Trash that has no row for it. */
    async softDeleteNoteUnified(id) {
      const held = await heldEntry(id);
      if (held?.kind !== "note.create") return inner.softDeleteNoteUnified(id);
      if (!sameDocContent(held.payload.node.content, "")) {
        throw new Error("softDeleteNoteUnified: the note waits in the outbox");
      }
      await dropEntry(held);
    },

    /** The undo of a create: the entry goes, and nothing needs the network. */
    async permanentDeleteNoteUnified(id) {
      const held = await heldEntry(id);
      if (held?.kind !== "note.create") {
        return inner.permanentDeleteNoteUnified(id);
      }
      await dropEntry(held);
    },
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD HH:mm` in this device's time zone. */
function localStamp(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function separateNoteOf(entry: NoteOutboxEntry): NoteNode {
  const { title, content, isPinned, color, icon } = entry.payload.node;
  return {
    id: `note-${entry.opId}-${entry.rev}`,
    type: "note",
    title: `${title}（オフライン編集 ${localStamp(entry.createdAt)}）`,
    content,
    parentId: null,
    order: 0,
    isPinned,
    isDeleted: false,
    ...(color !== undefined && { color }),
    ...(icon !== undefined && { icon }),
    createdAt: entry.createdAt,
    updatedAt: entry.createdAt,
  };
}

/**
 * Sends one claimed entry and settles it. Throws what the server said, for the
 * caller to classify. A retryable throw leaves the entry waiting.
 */
export async function sendNoteEntry(
  inner: NoteSendTarget,
  ownerId: string,
  entry: NoteOutboxEntry,
): Promise<void> {
  const id = entry.itemId;
  const mine = entry.payload.node.content;
  const retried = entry.attempts > 1;

  const finish = async (base: {
    updatedAt: string | null;
    content?: string;
  }): Promise<void> => {
    await settleSentNote(ownerId, entry, base);
    forgetNoteBody(id);
    patchDomainSnapshot<NoteNode[]>("notes", (rows) =>
      rows.map((n) => (n.id === id ? withoutMark(n) : n)),
    );
  };

  /*
   * `stale` is a version the server has already left. An edit that arrived during
   * this send is then refused next time, and merged against `mine` as its base,
   * which is what keeps what the server holds now.
   */
  const keepApart = async (
    reason: "conflict" | "gone",
    found?: { base: string; theirs: { content: string; updatedAt: string } },
    stale: string | null = null,
  ): Promise<void> => {
    const copy = separateNoteOf(entry);
    await inner.createNoteIfAbsent(copy, { ownerId, retried });
    await finish(
      stale === null ? { updatedAt: null } : { updatedAt: stale, content: mine },
    );
    reportNoteSeparated(
      id,
      { title: copy.title, reason },
      found && { ...found, mine },
    );
  };

  const sendBody = async (base: string, from: string): Promise<void> => {
    let expected = from;
    let body = mine;
    let theirs = { content: base, updatedAt: from };
    for (let i = 0; i < MAX_SEND_TRIES; i++) {
      const result = await inner.sendNoteBody(id, body, expected, { ownerId });
      if (result.status === "saved") {
        return finish({
          // After a merge the old version stays on purpose: see `keepApart`.
          updatedAt: body === mine ? result.updatedAt : expected,
          content: mine,
        });
      }
      if (result.status === "missing") return keepApart("gone");
      theirs = result.current;
      if (sameDocContent(theirs.content, mine)) {
        return finish({ updatedAt: theirs.updatedAt, content: mine });
      }
      expected = theirs.updatedAt;
      if (sameDocContent(theirs.content, base)) {
        body = mine; // A rename or a pin moved the version, not the text.
        continue;
      }
      const merge = mergeDocBlocks(base, mine, theirs.content);
      if (merge.hasConflict) {
        return keepApart("conflict", { base, theirs }, from);
      }
      body = merge.merged;
    }
    return keepApart("conflict", { base, theirs }, from);
  };

  /** With no version to compare against, only an equal body can count as sent. */
  const compareOnly = async (
    current: { content: string; updatedAt: string } | null,
  ): Promise<void> => {
    if (current === null) return keepApart("gone");
    if (sameDocContent(current.content, mine)) {
      return finish({ updatedAt: current.updatedAt, content: mine });
    }
    return keepApart("conflict", { base: "", theirs: current });
  };

  if (entry.kind === "note.create") {
    const { created, current } = await inner.createNoteIfAbsent(
      withoutMark(entry.payload.node),
      { ownerId, retried },
    );
    if (created && current !== null) {
      return finish({ updatedAt: current.updatedAt, content: mine });
    }
    // The row was there: an earlier attempt landed, its answer lost.
    if (
      current !== null &&
      !sameDocContent(current.content, mine) &&
      entry.triedBodies?.some((body) => sameDocContent(current.content, body))
    ) {
      return sendBody(current.content, current.updatedAt);
    }
    return compareOnly(current);
  }
  if (entry.baseContent === undefined || entry.baseUpdatedAt === null) {
    return compareOnly(await inner.getNoteBodySnapshotUnified(id));
  }
  return sendBody(entry.baseContent, entry.baseUpdatedAt);
}
