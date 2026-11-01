import type { DataService } from "./DataService";
import type { DailyNode } from "../types/daily";
import { mergeDocBlocks, sameDocContent } from "../utils/blockMerge";
import { publishDailyMerge } from "../state/dailyMerges";
import {
  patchDomainSnapshot,
  readDomainSnapshot,
} from "../state/domainSnapshotStore";
import {
  OUTBOX_READ_TIMEOUT_MS,
  classifySendFailure,
  enqueueDailyUpsert,
  failOutboxEntry,
  isMissingFunction,
  isOfflineFailure,
  isSendable,
  readOutbox,
  removeOutboxEntry,
  settleDailyEntry,
  withTimeout,
  type DailyUpsertEntry,
} from "../state/outbox";

/*
 * The Daily half of the outbox (#2336 — plan 2026-10-21-offline-cache.md P2b).
 *
 * WRITING. Offline, or on a network failure, a day's body goes into one entry per
 * date and the hook gets an optimistic row. While an entry waits, every save of
 * that day joins it, online too: save_daily_content compares nothing, so going
 * past the entry would overwrite the other side's text before the merge saw it.
 *
 * THE BASE is what the entry compares against: the body and version this page
 * last read or saved, kept in `KnownDailies`. A list row has a version but no
 * body, and the device clock is no version at all. With no known body there is
 * no base, so the RPC treats a row it finds as a conflict.
 *
 * A DAY BEHIND A PASSWORD is not held: its text does not go to the device, for
 * the same reason `forDevice` blanks it in the cache. The save fails as it did
 * before the outbox, and the editor keeps the text in memory.
 *
 * READING. A read must not take waiting text off the screen, so the reads that
 * reach the open day lay the entries over what they got. Offline, the list falls
 * back to the stored one, because a day created offline has no other way back
 * after a reload, and an editor opened empty on it would replace the text.
 *
 * SENDING. See `deliverDailyEntry`. Time decides nothing: the version only says
 * whether the server moved, and the merge keeps both sides.
 */

/**
 * The body and version this page last read or saved, per account and date. The
 * page outlives a sign-out, and a base from another account's day would carry
 * that account's text into this one's box.
 */
export type KnownDailies = Map<string, DailyNode>;

export function knownDailyKey(userId: string | null, date: string): string {
  return `${userId}:${date}`;
}

/** Merge rounds in one send, before the entry waits for a later run. */
const MAX_MERGE_ROUNDS = 5;

function heldNode(entry: DailyUpsertEntry, from?: DailyNode): DailyNode {
  const { date, content } = entry.payload;
  return {
    ...from,
    id: from?.id ?? entry.itemId,
    date,
    content,
    createdAt: from?.createdAt ?? entry.createdAt,
    updatedAt: entry.baseUpdatedAt ?? entry.createdAt,
    bodyLoaded: true,
  };
}

function overlay(rows: DailyNode[], entries: DailyUpsertEntry[]): DailyNode[] {
  if (entries.length === 0) return rows;
  const waiting = new Map(entries.map((e) => [e.payload.date, e]));
  const laid = rows.map((row) => {
    const entry = waiting.get(row.date);
    if (entry === undefined) return row;
    waiting.delete(row.date);
    return { ...row, content: entry.payload.content, bodyLoaded: true };
  });
  return [...[...waiting.values()].map((e) => heldNode(e)), ...laid];
}

function patchRow(
  date: string,
  patch: (row: DailyNode) => DailyNode,
  added?: DailyNode,
): void {
  patchDomainSnapshot<DailyNode[]>("dailies", (rows) =>
    rows.some((d) => d.date === date)
      ? rows.map((d) => (d.date === date ? patch(d) : d))
      : added
        ? [added, ...rows]
        : rows,
  );
}

export function createOfflineDailyOverrides(
  inner: DataService,
  owner: () => Promise<string | null>,
  known: KnownDailies,
  self: () => DataService,
  onHeld: () => void,
): Partial<DataService> {
  const storedRows = (): DailyNode[] =>
    readDomainSnapshot<DailyNode[]>("dailies", self(), undefined)?.data ?? [];

  /** Every path here also runs online: a box that hangs reads as empty. */
  const waiting = async (): Promise<DailyUpsertEntry[]> => {
    const userId = await owner();
    if (userId === null) return [];
    try {
      const rows = await withTimeout(readOutbox(userId), OUTBOX_READ_TIMEOUT_MS);
      return rows.filter(
        (e): e is DailyUpsertEntry =>
          isSendable(e) && e.kind === "daily.upsert",
      );
    } catch {
      return [];
    }
  };
  const waitingFor = async (date: string) =>
    (await waiting()).find((e) => e.payload.date === date);

  const remember = async (node: DailyNode): Promise<DailyNode> => {
    known.set(knownDailyKey(await owner(), node.date), node);
    return node;
  };
  const lastKnown = async (date: string): Promise<DailyNode | undefined> =>
    known.get(knownDailyKey(await owner(), date));

  const isProtected = async (date: string): Promise<boolean> =>
    (await lastKnown(date))?.hasPassword === true ||
    storedRows().find((d) => d.date === date)?.hasPassword === true;

  const hold = async (date: string, content: string): Promise<DailyNode> => {
    const userId = await owner();
    if (userId === null) throw new Error("outbox: no account to hold for");
    const last = known.get(knownDailyKey(userId, date));
    const stored = storedRows().find((d) => d.date === date);
    const body = last ?? (stored?.bodyLoaded === false ? undefined : stored);
    const entry = await enqueueDailyUpsert(
      userId,
      date,
      content,
      body ? { updatedAt: body.updatedAt, content: body.content } : null,
    );
    const node = heldNode(entry, last ?? stored);
    patchRow(date, (row) => ({ ...row, content, bodyLoaded: true }), node);
    onHeld();
    return node;
  };

  return {
    async upsertDailyByDateUnified(date, content, opts) {
      const protectedDay = await isProtected(date);
      const held = protectedDay ? undefined : await waitingFor(date);
      let failure: unknown;
      if (protectedDay || (held === undefined && navigator.onLine !== false)) {
        try {
          return await remember(
            await inner.upsertDailyByDateUnified(date, content, opts),
          );
        } catch (error) {
          if (protectedDay || !isOfflineFailure(error)) throw error;
          failure = error;
        }
      }
      try {
        return await hold(date, content);
      } catch {
        if (failure !== undefined) throw failure;
        // No box to hold it in: the network's own failure reaches the caller.
        return inner.upsertDailyByDateUnified(date, content, opts);
      }
    },

    async getDailyByDateUnified(date) {
      const before = await waitingFor(date);
      let full: DailyNode | null;
      try {
        full = await inner.getDailyByDateUnified(date);
      } catch (error) {
        if (!isOfflineFailure(error)) throw error;
        const last = await lastKnown(date);
        if (before) return heldNode(before, last);
        if (last) return last;
        throw error;
      }
      if (full) await remember(full);
      else known.delete(knownDailyKey(await owner(), date));
      // Looked at on both sides of the read: an entry sent while it was under
      // way may have left, and the read may be from before it landed.
      const entry = (await waitingFor(date)) ?? before;
      if (entry === undefined) return full;
      return full
        ? { ...full, content: entry.payload.content }
        : heldNode(entry);
    },

    async listDailySummariesUnified() {
      let rows: DailyNode[];
      try {
        rows = await inner.listDailySummariesUnified();
      } catch (error) {
        if (!isOfflineFailure(error) || (await waiting()).length === 0)
          throw error;
        rows = storedRows();
      }
      return overlay(rows, await waiting());
    },

    async fetchDailyChanges(cursor, base) {
      const read = await inner.fetchDailyChanges(cursor, base);
      if (read === null) return null;
      return { ...read, data: overlay(read.data, await waiting()) };
    },

    /*
     * A delete of a day that waits. Never known to be on the server (an offline
     * create being undone): the entry just goes. Otherwise the delete has to
     * reach the server first, so offline it fails as it always has and the entry
     * stays. Once it lands, the unsent text moves to the failed box, because a
     * send now would be refused and the text exists nowhere else.
     */
    async softDeleteDailyUnified(id) {
      const userId = await owner();
      const entry = (await waiting()).find((e) => e.itemId === id);
      if (userId === null || entry === undefined)
        return inner.softDeleteDailyUnified(id);
      if (entry.baseUpdatedAt !== null) {
        await inner.softDeleteDailyUnified(id);
        await failOutboxEntry(userId, entry, "the day was deleted");
        return;
      }
      await removeOutboxEntry(userId, entry.opId);
      patchDomainSnapshot<DailyNode[]>("dailies", (rows) =>
        rows.filter((d) => d.id !== id),
      );
      try {
        await inner.softDeleteDailyUnified(id);
      } catch (error) {
        if (!isOfflineFailure(error)) throw error;
      }
    },

    async setDailyPasswordUnified(id, password) {
      return remember(await inner.setDailyPasswordUnified(id, password));
    },

    async removeDailyPasswordUnified(id, currentPassword) {
      return remember(
        await inner.removeDailyPasswordUnified(id, currentPassword),
      );
    },
  };
}

type DailySend =
  | { kind: "landed"; body: string; updatedAt: string; hasPassword: boolean }
  | { kind: "deleted" }
  | { kind: "busy" };

/**
 * The compare-and-merge loop. The entry's own base and text are the inputs of
 * every round, so nothing merged reaches the device, and a round that loses to
 * yet another write simply merges against the newer body. A body that already
 * holds everything of ours (a send whose answer was lost) is not written again.
 */
async function sendDaily(
  inner: Pick<DataService, "saveDailyIfUnchanged">,
  userId: string,
  entry: DailyUpsertEntry,
): Promise<DailySend> {
  const { date, content: mine } = entry.payload;
  const base = entry.baseContent ?? "";
  let body = mine;
  let expected = entry.baseUpdatedAt;
  for (let round = 0; round < MAX_MERGE_ROUNDS; round++) {
    const answer = await inner.saveDailyIfUnchanged(date, body, expected, {
      ownerId: userId,
    });
    const { updatedAt, hasPassword } = answer;
    if (answer.saved) return { kind: "landed", body, updatedAt, hasPassword };
    if (answer.isDeleted) return { kind: "deleted" };
    const { merged } = mergeDocBlocks(base, mine, answer.content);
    if (sameDocContent(merged, answer.content)) {
      const onServer = sameDocContent(answer.content, mine)
        ? mine
        : answer.content;
      return { kind: "landed", body: onServer, updatedAt, hasPassword };
    }
    body = sameDocContent(merged, mine) ? mine : merged;
    expected = updatedAt;
  }
  return { kind: "busy" };
}

/**
 * One entry, claimed by the sender.
 * - `done`: it landed, or moved to the failed box. Something changed.
 * - `later`: it stays, and the rest of the box goes on. The RPC is not on the
 *   database yet, or the day keeps moving under the merge.
 * - `stop`: nothing can be sent now.
 *
 * It never leaves the box unsent except into the failed box, where its text can
 * be copied. A unique violation, which clears a Todo create as already there,
 * says nothing about whether this text arrived, so here it waits.
 */
export async function deliverDailyEntry(
  inner: Pick<DataService, "saveDailyIfUnchanged">,
  userId: string,
  entry: DailyUpsertEntry,
  known: KnownDailies,
  mergedOps: Set<string>,
): Promise<"done" | "later" | "stop"> {
  const { date, content: sent } = entry.payload;
  let outcome: DailySend;
  try {
    outcome = await sendDaily(inner, userId, entry);
  } catch (e) {
    if (isMissingFunction(e)) return "later";
    const verdict = classifySendFailure(e);
    if (verdict === "retry") return "stop";
    if (verdict === "sent") return "later";
    await failOutboxEntry(userId, entry, String(e));
    return "done";
  }
  if (outcome.kind === "busy") return "later";
  if (outcome.kind === "deleted") {
    await failOutboxEntry(userId, entry, "the day is in the Trash");
    return "done";
  }

  const { body, updatedAt, hasPassword } = outcome;
  const settled = await settleDailyEntry(userId, entry.opId, {
    sent,
    body,
    updatedAt,
    hasPassword,
  });
  const key = knownDailyKey(userId, date);
  known.set(key, {
    ...(known.get(key) ?? heldNode(entry)),
    content: body,
    updatedAt,
    hasPassword,
    bodyLoaded: true,
  });
  if (settled === "cleared") {
    patchRow(date, (row) => ({
      ...row,
      content: body,
      updatedAt,
      hasPassword,
      bodyLoaded: true,
    }));
  }
  // A merged entry that stayed for an edit lands again as plain text: that
  // landing still has to reach the screen, and it is the one the notice is for.
  if (body !== sent) mergedOps.add(entry.opId);
  if (mergedOps.has(entry.opId)) {
    publishDailyMerge({
      date,
      body,
      updatedAt,
      settled: settled === "cleared",
    });
  }
  return "done";
}
