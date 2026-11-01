import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyNode } from "../types/daily";
import type { NoteNode } from "../types/note";
import type { TodoNode } from "../types/todoTree";
import {
  DAILIES_PAYLOAD_LIGHT_COLUMNS,
  rowsToDailyNodeLight,
  type DailiesPayloadLightRow,
  type ItemsMetaDailyRow,
} from "./dailiesUnifiedMapper";
import { ITEMS_META_COLUMNS, type ItemsMetaRow } from "./itemsMeta";
import {
  NOTES_PAYLOAD_LIST_COLUMNS,
  isLegacyNoteFolderRow,
  isNoteTemplateRow,
  rowsToNoteNodeLite,
  type ItemsMetaNoteRow,
  type NotesPayloadListRow,
} from "./notesUnifiedMapper";
import {
  POSTGREST_PAGE_SIZE,
  fetchAllPages,
  fetchByIdChunks,
} from "./postgrestFetchAll";
import {
  TASKS_PAYLOAD_COLUMNS,
  isLegacyFolderRow,
  rowsToTodoNode,
  type TasksPayloadRow,
} from "./todoMapper";
import { logServiceError } from "../utils/logError";

/*
 * The delta read (#2333, plan 2026-10-21-offline-cache.md P1b): fetch only what
 * moved since the last read and lay it over the list that read produced.
 *
 * `items_meta.changed_at` and `items_meta_tombstones` (migration 0045) are
 * written by the server's clock, so a device with a wrong clock cannot make a
 * write look older than the cursor, which is why `updated_at` is not the basis.
 *
 * What keeps it correct:
 *
 * - The cursor is a server-clock value and belongs to ONE list. It lives in the
 *   same snapshot entry as that list (`domainSnapshotStore`), so the two reach
 *   IndexedDB in one write. A cursor saved apart from a debounced list could
 *   end up newer than the list and lose those changes for good.
 * - Each read goes back CHANGE_OVERLAP_MS, because `clock_timestamp()` follows
 *   statement order and not commit order. `seen` names the rows of that overlap
 *   that were already applied, so a revalidation with no news reads no payload.
 * - Writes are meta first, payload second (two requests), so a row read straight
 *   after its meta moved may carry the old payload, and the later payload write
 *   does not move `changed_at`. A row enters `seen` only after this device has
 *   read it again SETTLE_MS after first observing that `changed_at` (`settling`
 *   holds when that was). Both ends of that span are the device's clock, so
 *   however far it is from the server's, the span is real. Device time is never
 *   compared with a server stamp and never reaches `at`.
 * - The newest stamp is no stand-in for "server now" when settling, because the
 *   newest row stays inside the overlap and would never settle. It only rules
 *   rows out: one over CHANGE_OVERLAP_MS older than a stamp this read returned
 *   is long past its payload write, so the read in progress has the final
 *   payload. That is also why `settling` never needs a row outside the overlap.
 * - The full reads do not select `changed_at`, and the cursor comes from its own
 *   small query that may fail. Web deploys on merge, so production can run this
 *   code before `supabase db push`; there every list must keep working.
 */

export const CHANGE_OVERLAP_MS = 60_000;
export const SETTLE_MS = 15_000;
/** Rows the cursor query may name in `seen`; any beyond it are read once more. */
const CURSOR_ROWS = 100;
export const FULL_READ_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const FULL_READ_EVERY_STARTS = 20;
const START_COUNT_KEY = "life-editor:app-start-count";

/** A row still read again on each delta. Both clocks stay in their own field. */
export interface SettlingRow {
  /** The server stamp this observation is of. A new stamp starts over. */
  changedAt: string;
  /** Device clock when this device first observed that stamp. */
  firstAt: number;
}

export interface ChangeCursor {
  /** Newest server timestamp this list has accounted for. */
  at: string;
  /** Overlap rows already applied: id to the `changed_at` that was read. */
  seen: Record<string, string>;
  /** Overlap rows whose payload may still be on its way. */
  settling: Record<string, SettlingRow>;
  /**
   * Device clock at the last FULL read. A delta carries it over unchanged, so
   * FULL_READ_MAX_AGE_MS is an upper bound even on a device used every day.
   */
  readAt: number;
}

export interface ChangesRead<T> {
  data: T;
  cursor: ChangeCursor;
}

type ChangedMeta = ItemsMetaRow<string> & { changed_at: string };

export interface Tombstone {
  id: string;
  deleted_at: string;
}

export interface ItemChanges {
  metas: readonly ChangedMeta[];
  tombstones: readonly Tombstone[];
}

/** What a domain's full read does, restated for the rows that moved. */
export interface ChangeDomain<
  TMeta,
  TPayload extends { item_id: string },
  TNode extends { id: string },
> {
  role: string;
  payloadTable: string;
  payloadColumns: string;
  keep?: (payload: TPayload) => boolean;
  toDomain: (meta: TMeta, payload: TPayload) => TNode;
}

export const DAILY_CHANGES: ChangeDomain<
  ItemsMetaDailyRow,
  DailiesPayloadLightRow,
  DailyNode
> = {
  role: "daily",
  payloadTable: "dailies_payload",
  payloadColumns: DAILIES_PAYLOAD_LIGHT_COLUMNS,
  toDomain: rowsToDailyNodeLight,
};

export const NOTE_CHANGES: ChangeDomain<
  ItemsMetaNoteRow,
  NotesPayloadListRow,
  NoteNode
> = {
  role: "note",
  payloadTable: "notes_payload",
  payloadColumns: NOTES_PAYLOAD_LIST_COLUMNS,
  // The same exclusions as SupabaseNotesUnifiedReads.listLite.
  keep: (p) => !isLegacyNoteFolderRow(p) && !isNoteTemplateRow(p),
  toDomain: rowsToNoteNodeLite,
};

/** Live todos only: since #2326 the tree does not hold the trashed half. */
export const TODO_CHANGES: ChangeDomain<
  ItemsMetaRow,
  TasksPayloadRow,
  TodoNode
> = {
  role: "task",
  payloadTable: "tasks_payload",
  payloadColumns: TASKS_PAYLOAD_COLUMNS,
  keep: (p) => !isLegacyFolderRow(p), // as fetchTodoTree does
  toDomain: rowsToTodoNode,
};

/** True when `a` is later than `b`. Postgres stamps carry microseconds. */
function isLater(a: string, b: string): boolean {
  const ms = Date.parse(a) - Date.parse(b);
  return ms !== 0 ? ms > 0 : a > b;
}

/**
 * Sort the overlap's rows into applied and still settling. `now` must be taken
 * before the payload read it describes: a row only counts as settled when that
 * read started SETTLE_MS after the row was first observed.
 */
function settle(
  rows: ReadonlyArray<{ id: string; changed_at: string }>,
  at: string,
  now: number,
  previous: ChangeCursor | undefined,
): Pick<ChangeCursor, "seen" | "settling"> {
  const from = Date.parse(at) - CHANGE_OVERLAP_MS;
  const seen: ChangeCursor["seen"] = {};
  const settling: ChangeCursor["settling"] = {};
  for (const { id, changed_at: changedAt } of rows) {
    if (Date.parse(changedAt) <= from) continue;
    const known = previous?.settling[id];
    // A clock set back since then starts the span over, rather than leaving the
    // row read again for however long the clock was moved.
    const firstAt =
      known?.changedAt === changedAt && known.firstAt <= now
        ? known.firstAt
        : now;
    if (previous?.seen[id] === changedAt || now - firstAt >= SETTLE_MS) {
      seen[id] = changedAt;
    } else {
      settling[id] = { changedAt, firstAt };
    }
  }
  return { seen, settling };
}

/**
 * The position `rows` and `deleted` put a list at. Without `previous` this is a
 * full read's cursor. With it, it is the next position of a delta: never earlier
 * than `previous.at`, so an empty delta stays where it was, and `readAt` is
 * carried over. Null when nothing has ever been written, which simply means a
 * full read next time.
 */
export function cursorFrom(
  rows: ReadonlyArray<{ id: string; changed_at: string }>,
  deleted: ReadonlyArray<{ deleted_at: string }>,
  now: number,
  previous?: ChangeCursor,
): ChangeCursor | null {
  let at = previous?.at ?? null;
  for (const stamp of [
    ...rows.map((r) => r.changed_at),
    ...deleted.map((t) => t.deleted_at),
  ]) {
    if (at === null || isLater(stamp, at)) at = stamp;
  }
  if (at === null) return null;
  return {
    at,
    ...settle(rows, at, now, previous),
    readAt: previous?.readAt ?? now,
  };
}

/** Which ids the tombstones take out of a list. */
function tombstonedIds(
  { metas, tombstones }: ItemChanges,
  seen: Readonly<Record<string, string>>,
): Set<string> {
  const dead = new Set<string>();
  if (tombstones.length === 0) return dead;
  const metaById = new Map(metas.map((m) => [m.id, m]));
  for (const t of tombstones) {
    // A row re-created under the same id (daily-YYYY-MM-DD) leaves a tombstone
    // beside a live row, and the overlap delivers an old tombstone again later.
    // The row wins when its changed_at is newer than the delete. Re-creating it
    // stamps a changed_at after deleted_at, inside the same window, so a row
    // missing from the changes does not exist now. A list's updatedAt must not
    // decide this: it is the device's clock, and one running fast would keep a
    // deleted row on the list.
    const known = metaById.get(t.id)?.changed_at ?? seen[t.id];
    if (known === undefined || !isLater(known, t.deleted_at)) dead.add(t.id);
  }
  return dead;
}

/**
 * Lay the changes over `list`. Pure, and the same result as a full read for
 * every id it touches: a row of another role, a soft-deleted row, a meta whose
 * payload is missing (R2 orphan) and a row `keep` refuses all leave the list.
 * Sorted by id like the full read, so ties in a screen's own sort stay stable.
 */
export function applyItemChanges<
  TMeta,
  TPayload extends { item_id: string },
  TNode extends { id: string },
>(
  domain: ChangeDomain<TMeta, TPayload, TNode>,
  list: readonly TNode[],
  changes: ItemChanges,
  payloads: readonly TPayload[],
  seen: Readonly<Record<string, string>> = {},
): TNode[] {
  const next = new Map(list.map((n) => [n.id, n]));
  const dead = tombstonedIds(changes, seen);
  for (const id of dead) next.delete(id);
  const payloadById = new Map(payloads.map((p) => [p.item_id, p]));
  for (const meta of changes.metas) {
    if (seen[meta.id] === meta.changed_at || dead.has(meta.id)) continue;
    const payload = payloadById.get(meta.id);
    const stays =
      meta.role === domain.role &&
      !meta.is_deleted &&
      payload !== undefined &&
      (domain.keep?.(payload) ?? true);
    if (stays) next.set(meta.id, domain.toDomain(meta as TMeta, payload));
    else next.delete(meta.id);
  }
  return [...next.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

/*
 * Migration 0045 not pushed yet: no such column, no such table, or the same two
 * from PostgREST's schema cache. Remembered per client, so a session asks once
 * instead of failing a request on every read; a reload asks again. Only these
 * codes: another PGRST code such as PGRST301 (an expired JWT) says nothing about
 * the schema, and remembering it would turn the delta off until a reload.
 */
const UNAPPLIED_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);
const unapplied = new WeakSet<SupabaseClient>();

function isUnapplied(error: { code?: string } | null): boolean {
  return UNAPPLIED_CODES.has(error?.code ?? "");
}

/*
 * The cursor request under way, per client. The domains start together, and a
 * cursor taken a moment before a read is still a cursor from before that read.
 */
const cursorReads = new WeakMap<SupabaseClient, Promise<ChangeCursor | null>>();

/**
 * Where a full read starting now will leave its list. Call it BEFORE the read:
 * a change landing during the read then stays after the cursor and is read
 * again, where a cursor taken from the read's own rows would skip it. Null
 * sends the next read through the full path; it never fails the caller. Callers
 * that overlap share one request, and so one answer, which nothing mutates.
 */
export function readChangeCursor(
  client: SupabaseClient,
): Promise<ChangeCursor | null> {
  if (unapplied.has(client)) return Promise.resolve(null);
  const running = cursorReads.get(client);
  if (running !== undefined) return running;
  const read = askChangeCursor(client).finally(() => {
    cursorReads.delete(client);
  });
  cursorReads.set(client, read);
  return read;
}

async function askChangeCursor(
  client: SupabaseClient,
): Promise<ChangeCursor | null> {
  const [metas, tombstones] = await Promise.all([
    client
      .from("items_meta")
      .select("id, changed_at")
      .order("changed_at", { ascending: false })
      .limit(CURSOR_ROWS),
    client
      .from("items_meta_tombstones")
      .select("deleted_at")
      .order("deleted_at", { ascending: false })
      .limit(1),
  ]);
  if (isUnapplied(metas.error) || isUnapplied(tombstones.error)) {
    unapplied.add(client);
    return null;
  }
  if (metas.error || tombstones.error) return null;
  return cursorFrom(metas.data ?? [], tombstones.data ?? [], Date.now());
}

/**
 * The delta read for one domain, applied to `base`: the list `cursor` belongs
 * to (the snapshot), never React state holding optimistic edits. This client's
 * own writes come back here because their `changed_at` is after the cursor.
 *
 * Null sends this read through the full path: the migration is not there (and
 * will be skipped from now on), the change queries failed, or the changes do
 * not fit one page. A failed payload read throws, for the hook to fall back.
 */
export async function fetchItemChanges<
  TMeta,
  TPayload extends { item_id: string },
  TNode extends { id: string },
>(
  client: SupabaseClient,
  domain: ChangeDomain<TMeta, TPayload, TNode>,
  cursor: ChangeCursor,
  base: readonly TNode[],
): Promise<ChangesRead<TNode[]> | null> {
  if (unapplied.has(client)) return null;
  const since = new Date(
    Date.parse(cursor.at) - CHANGE_OVERLAP_MS,
  ).toISOString();
  let missing = false;
  const watched = <R extends { error: { code?: string } | null }>(
    query: PromiseLike<R>,
  ): PromiseLike<R> =>
    query.then((result) => {
      if (isUnapplied(result.error)) missing = true;
      return result;
    });

  let changes: ItemChanges;
  try {
    const [metas, tombstones] = await Promise.all([
      fetchAllPages<ChangedMeta>(
        (from, to) =>
          watched(
            client
              .from("items_meta")
              .select(`${ITEMS_META_COLUMNS}, changed_at`)
              .gt("changed_at", since)
              .order("id")
              .range(from, to),
          ),
        "fetchItemChanges items_meta",
      ),
      fetchAllPages<Tombstone>(
        (from, to) =>
          watched(
            client
              .from("items_meta_tombstones")
              .select("id, deleted_at")
              .gt("deleted_at", since)
              .order("id")
              .range(from, to),
          ),
        "fetchItemChanges items_meta_tombstones",
      ),
    ]);
    changes = { metas, tombstones };
  } catch (e) {
    if (missing) unapplied.add(client);
    else logServiceError("itemChanges", "delta", e);
    return null;
  }

  // Pages are offsets, so a write during the pull can shift a row past the page
  // boundary. A full read heals on the next read, but here the cursor would move
  // past the lost row for good.
  if (
    changes.metas.length >= POSTGREST_PAGE_SIZE ||
    changes.tombstones.length >= POSTGREST_PAGE_SIZE
  ) {
    return null;
  }

  // After the rows came back and before their payloads are asked for, so a row
  // first observed here counts from no earlier than its meta write, and a row
  // settling here has its payload read SETTLE_MS later or more.
  const now = Date.now();
  const dead = tombstonedIds(changes, cursor.seen);
  const ids = changes.metas
    .filter(
      (m) =>
        m.role === domain.role &&
        !m.is_deleted &&
        cursor.seen[m.id] !== m.changed_at &&
        !dead.has(m.id),
    )
    .map((m) => m.id);
  const payloads = await fetchByIdChunks<TPayload>(ids, (chunk) =>
    fetchAllPages(
      (from, to) =>
        client
          .from(domain.payloadTable)
          .select(domain.payloadColumns)
          .in("item_id", chunk)
          .order("item_id")
          .range(from, to),
      `fetchItemChanges ${domain.payloadTable}`,
    ),
  );
  return {
    data: applyItemChanges(domain, base, changes, payloads, cursor.seen),
    cursor:
      cursorFrom(changes.metas, changes.tombstones, now, cursor) ?? cursor,
  };
}

/*
 * The safety net: a full read when the last FULL read is over a week old (old
 * tombstones may be swept one day, and a payload-only write never moves
 * `changed_at`), and on every 20th app start, once per domain.
 */
let fullReadStart: boolean | null = null;
const fullReadDone = new Set<string>();

function isFullReadStart(): boolean {
  if (fullReadStart !== null) return fullReadStart;
  let count = 0;
  try {
    count = (Number(localStorage.getItem(START_COUNT_KEY)) || 0) + 1;
    localStorage.setItem(START_COUNT_KEY, String(count));
  } catch {
    // No storage: the age check above is all there is.
  }
  fullReadStart = count > 0 && count % FULL_READ_EVERY_STARTS === 0;
  return fullReadStart;
}

export function isFullReadDue(key: string, cursor: ChangeCursor): boolean {
  if (Date.now() - cursor.readAt > FULL_READ_MAX_AGE_MS) return true;
  return isFullReadStart() && !fullReadDone.has(key);
}

export function noteFullRead(key: string): void {
  fullReadDone.add(key);
}

/** Forget this page's start. For test isolation: a new start in the next test. */
export function resetFullReadPolicy(): void {
  fullReadStart = null;
  fullReadDone.clear();
}
