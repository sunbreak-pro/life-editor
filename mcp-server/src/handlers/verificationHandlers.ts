import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import {
  assertDateKey,
  assertTimeOfDay,
  localDayUtcRange,
  localToday,
} from "../utils/localDate.js";
import type { ItemRole } from "../utils/items.js";
import {
  assertVerificationMode,
  forgetItems,
  ledgerPath,
  readLedger,
  recordRun,
  type SeededItem,
  type SeedRun,
} from "../utils/verification.js";
import { createTodo } from "./todoHandlers.js";
import { createNote } from "./noteHandlers.js";
import { createScheduleItem } from "./scheduleHandlers.js";

/*
 * Verification harness — put a state in, read the DB's answer, take it back
 * out again (#700 Step 2).
 *
 * Today a change is checked one of two ways: vitest (types and pure logic) or
 * chat-main driving a real browser — and the browser pass runs one at a time,
 * since the dev server binds a single port (CLAUDE.md §7.4). The middle is
 * missing: arranging a specific day's data, then asking the DB what actually
 * landed. That is what these three tools are for, and they leave the browser
 * pass with only the part a browser is needed for — what the screen looks like.
 *
 * The three:
 *   seed_verification_state    — build a day out of todos / events / notes
 *   read_verification_state    — the stored rows, both halves of the 2-row
 *                                model, with nothing hidden
 *   cleanup_verification_state — delete exactly what was seeded, from the
 *                                ledger, not from the operator's memory
 *
 * Isolation and the ledger are documented in ../utils/verification.ts; the
 * short version is that separation is the RLS policy on a dedicated account
 * (D-20260812-shared-fix-3), and every tool here refuses to run unless the
 * process has been declared the verification one.
 *
 * Seeding goes through the ORDINARY write handlers (createTodo /
 * createScheduleItem / createNote) rather than writing rows directly. A
 * fixture built by a private path would be a fixture of that path — the
 * orphan recovery, the §10.2 updated_at bump and the column defaults have to
 * be the same ones real data gets, or the state under test is not the state
 * users have.
 */

/** Kinds that can be seeded. See below for why `daily` is absent. */
type SeedKind = "task" | "event" | "note";

const PAYLOAD_TABLE: Record<SeedKind, string> = {
  task: "tasks_payload",
  event: "events_payload",
  note: "notes_payload",
};

const SEED_ROLE: Record<SeedKind, ItemRole> = {
  task: "task",
  event: "event",
  note: "note",
};

/*
 * `daily` is deliberately not seedable. A DailyNode's id is derived from its
 * date (`daily-<YYYY-MM-DD>`), so a seeded daily is indistinguishable from
 * one the account already wrote — and cleanup, which deletes by id, would
 * take the real entry with it. Todos, events and notes all get random ids, so
 * a seeded row can never collide with an existing one.
 */

interface SeedItemArg {
  kind: SeedKind;
  title?: string;
  content?: string;
  /** todo only. */
  status?: string;
  /** event: clock time. todo: sets scheduled_at on the seeded day. */
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
  /** event only. */
  memo?: string;
}

/**
 * A day with the overlaps and leftovers that break layout code: two events
 * running over each other, an all-day banner, a finished todo, an open one,
 * and a todo with no date at all.
 *
 * The Issue's example asks for a REPEATING event here. This server has no
 * routine write path (routines are a generation template — CLAUDE.md §4), so
 * the 09:00 entry is a plain event standing in for a generated occurrence.
 * It looks the same on the calendar; it is not the same row, and anything
 * testing routine generation itself needs more than this preset.
 */
const BUSY_DAY: SeedItemArg[] = [
  {
    kind: "event",
    title: "定例（繰り返し想定）",
    start_time: "09:00",
    end_time: "10:00",
  },
  {
    kind: "event",
    title: "重なっている予定",
    start_time: "09:30",
    end_time: "10:30",
  },
  { kind: "event", title: "終日の予定", is_all_day: true },
  {
    kind: "task",
    title: "完了済みの Todo",
    status: "done",
    start_time: "11:00",
  },
  {
    kind: "task",
    title: "未着手の Todo",
    status: "not_started",
    start_time: "14:00",
  },
  { kind: "task", title: "日付なしの Todo", status: "not_started" },
];

const PRESETS: Record<string, SeedItemArg[]> = { busy_day: BUSY_DAY };

/**
 * A local clock time on `date` as a UTC instant, for the timestamptz columns
 * todos use. Same local-time convention as utils/localDate.ts — a UTC-based
 * conversion would drop a 09:00 JST todo onto the previous day.
 */
function localInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

/**
 * A label on the title, for the human who opens the verification account and
 * wants to see at a glance what is fixture. It is NOT the isolation — that is
 * the RLS policy (option B in #700, separation by id prefix, was rejected
 * precisely because a forgotten label is invisible). Nothing reads it back.
 */
function seededTitle(raw: string | undefined, fallback: string): string {
  return `[verify] ${raw ?? fallback}`;
}

/** The ledger entry for a row just written — id from the create handler. */
function ledgerEntry(kind: SeedKind, id: string, title: string): SeededItem {
  return {
    id,
    role: SEED_ROLE[kind],
    payloadTable: PAYLOAD_TABLE[kind],
    title,
  };
}

async function seedOne(
  item: SeedItemArg,
  date: string,
  index: number,
): Promise<SeededItem> {
  const title = seededTitle(item.title, `${item.kind} ${index + 1}`);

  if (item.kind === "event") {
    const created = await createScheduleItem({
      date,
      title,
      start_time: item.start_time,
      end_time: item.end_time,
      is_all_day: item.is_all_day,
      memo: item.memo,
    });
    return ledgerEntry("event", created.id, title);
  }

  if (item.kind === "note") {
    const created = await createNote({ title, content: item.content });
    return ledgerEntry("note", created.id, title);
  }

  // A todo lands on the seeded day when it is given a time or marked all-day;
  // with neither it is an undated backlog todo, which is a state worth being
  // able to arrange too.
  let scheduledAt: string | undefined;
  let scheduledEndAt: string | undefined;
  if (item.is_all_day) {
    scheduledAt = localDayUtcRange(date).startIso;
  } else if (item.start_time) {
    assertTimeOfDay(item.start_time, "start_time");
    scheduledAt = localInstant(date, item.start_time);
    if (item.end_time) {
      assertTimeOfDay(item.end_time, "end_time");
      scheduledEndAt = localInstant(date, item.end_time);
    }
  }

  const created = await createTodo({
    title,
    status: item.status,
    content: item.content,
    scheduled_at: scheduledAt,
    scheduled_end_at: scheduledEndAt,
    is_all_day: item.is_all_day,
  });
  return ledgerEntry("task", created.id, title);
}

export async function seedVerificationState(args: {
  date?: string;
  preset?: string;
  items?: SeedItemArg[];
  label?: string;
}) {
  assertVerificationMode("seed_verification_state");

  const date = assertDateKey(args.date ?? localToday());

  const fromPreset = args.preset ? PRESETS[args.preset] : undefined;
  if (args.preset && !fromPreset) {
    throw new Error(
      `Unknown preset "${args.preset}" (available: ${Object.keys(PRESETS).join(", ")})`,
    );
  }
  const items = [...(fromPreset ?? []), ...(args.items ?? [])];
  if (items.length === 0) {
    throw new Error(
      "Nothing to seed: pass preset and/or items (an empty seed run would " +
        "leave a ledger entry describing no rows).",
    );
  }

  const runId = `verify-${randomUUID()}`;
  const seeded: SeededItem[] = [];

  try {
    for (const [index, item] of items.entries()) {
      seeded.push(await seedOne(item, date, index));
    }
  } finally {
    // Recorded even when a later item throws: the rows already written are
    // out there, and a half-finished run that cleanup cannot see is the exact
    // leftover this tool exists to prevent.
    if (seeded.length > 0) {
      recordRun({
        runId,
        label: args.label ?? null,
        date,
        createdAt: new Date().toISOString(),
        items: seeded,
      });
    }
  }

  return {
    runId,
    date,
    label: args.label ?? null,
    seeded,
    ledgerPath: ledgerPath(),
    cleanup: `cleanup_verification_state { "run_id": "${runId}" }`,
  };
}

interface MetaRow {
  id: string;
  role: string;
  title: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const READ_META_COLUMNS =
  "id, role, title, is_deleted, deleted_at, created_at, updated_at";

/**
 * `<role>_payload` table per role. Spelled out rather than derived from the
 * role name: `daily` pluralises to `dailies_payload`, so the obvious
 * `${role}s_payload` would query a table that does not exist — and only for
 * the one role this file cannot seed, which is where nobody would look.
 */
const ROLE_PAYLOAD_TABLE: Record<string, string | undefined> = {
  task: "tasks_payload",
  event: "events_payload",
  routine: "routines_payload",
  note: "notes_payload",
  daily: "dailies_payload",
};

export interface StoredItem {
  id: string;
  role: string;
  meta: MetaRow;
  /**
   * null = a meta row with no payload: an orphan, and the shape
   * db-conventions §10.5 recovery exists to prevent. Worth seeing.
   */
  payload: Record<string, unknown> | null;
}

export interface ReadResult {
  query: { run_id?: string; date?: string; id?: string; label?: string | null };
  items: StoredItem[];
  /** Ids asked for that have no items_meta row at all — hard-deleted or never real. */
  missing: string[];
}

/**
 * Every stored column of one item, both rows of the 2-row model in one
 * object. Soft-deleted items are INCLUDED and flagged: "the UI stopped
 * showing it" and "the row is gone" are different outcomes, and a tool that
 * hid the first could not tell them apart.
 */
async function readItems(
  ids: string[],
): Promise<{ items: StoredItem[]; missing: string[] }> {
  if (ids.length === 0) return { items: [], missing: [] };

  const { client } = await getSupabase();
  const { data: metaRows, error: mErr } = await client
    .from("items_meta")
    .select(READ_META_COLUMNS)
    .in("id", ids);
  if (mErr) throw new Error(`read items_meta: ${mErr.message}`);
  const metas = (metaRows ?? []) as unknown as MetaRow[];

  // One query per payload table actually present, rather than per item.
  const byTable = new Map<string, string[]>();
  for (const meta of metas) {
    const table = ROLE_PAYLOAD_TABLE[meta.role];
    if (!table) throw new Error(`Unknown role "${meta.role}" on ${meta.id}`);
    byTable.set(table, [...(byTable.get(table) ?? []), meta.id]);
  }

  const payloadById = new Map<string, Record<string, unknown>>();
  for (const [table, tableIds] of byTable) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .in("item_id", tableIds);
    if (error) throw new Error(`read ${table}: ${error.message}`);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      payloadById.set(row.item_id as string, row);
    }
  }

  const found = new Set(metas.map((m) => m.id));
  return {
    items: metas.map((meta) => ({
      id: meta.id,
      role: meta.role,
      meta,
      payload: payloadById.get(meta.id) ?? null,
    })),
    missing: ids.filter((id) => !found.has(id)),
  };
}

/** Ids of everything sitting on one local day (events + scheduled todos). */
async function idsOnDate(date: string): Promise<string[]> {
  const { client } = await getSupabase();
  const { startIso, endIso } = localDayUtcRange(date);

  // A single day stays far below the PostgREST 1000-row cap, so these read
  // in one page — same assumption scheduleHandlers.fetchEvents makes.
  const [events, todos] = await Promise.all([
    client.from("events_payload").select("item_id").eq("start_at", date),
    client
      .from("tasks_payload")
      .select("item_id")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso),
  ]);
  if (events.error)
    throw new Error(`read events_payload: ${events.error.message}`);
  if (todos.error)
    throw new Error(`read tasks_payload: ${todos.error.message}`);

  const rows = [
    ...((events.data ?? []) as { item_id: string }[]),
    ...((todos.data ?? []) as { item_id: string }[]),
  ];
  return [...new Set(rows.map((r) => r.item_id))];
}

export async function readVerificationState(args: {
  run_id?: string;
  date?: string;
  id?: string;
}): Promise<ReadResult> {
  assertVerificationMode("read_verification_state");

  // An explicit null counts as "not supplied" here for the same reason the
  // schema validator treats it that way on an optional property (#669) — a
  // caller filling every field with null still asked for exactly one thing.
  const given = [args.run_id, args.date, args.id].filter(
    (value) => typeof value === "string" && value !== "",
  ).length;
  if (given !== 1) {
    throw new Error(
      "Pass exactly one of run_id, date or id (given: " +
        `${given}). Answering for a different selector than the one asked ` +
        "for is the failure mode this refuses.",
    );
  }

  if (args.id) {
    return { query: { id: args.id }, ...(await readItems([args.id])) };
  }

  if (args.date) {
    const date = assertDateKey(args.date);
    return { query: { date }, ...(await readItems(await idsOnDate(date))) };
  }

  const run = readLedger().runs.find((r) => r.runId === args.run_id);
  if (!run) {
    throw new Error(
      `Unknown run_id "${args.run_id}" — not in the ledger at ${ledgerPath()}. ` +
        "It may already have been cleaned up.",
    );
  }
  return {
    query: { run_id: run.runId, date: run.date, label: run.label },
    ...(await readItems(run.items.map((item) => item.id))),
  };
}

/**
 * Hard-delete one seeded item: payload row first, then its meta parent.
 *
 * Hard, not soft — a soft delete would leave the row in the account's Trash,
 * which is still a leftover. The order matters because the payload's
 * composite FK to `items_meta(id, role)` is NO ACTION (db-conventions §10.3):
 * dropping the meta row first is a constraint violation.
 */
async function hardDelete(item: SeededItem): Promise<void> {
  const { client } = await getSupabase();

  const { error: pErr } = await client
    .from(item.payloadTable)
    .delete()
    .eq("item_id", item.id);
  if (pErr) throw new Error(`delete ${item.payloadTable}: ${pErr.message}`);

  const { error: mErr } = await client
    .from("items_meta")
    .delete()
    .eq("id", item.id)
    .eq("role", item.role);
  if (mErr) throw new Error(`delete items_meta: ${mErr.message}`);
}

export interface CleanupResult {
  dryRun: boolean;
  deleted: number;
  failures: Array<{ id: string; error: string }>;
  /** Populated on a dry run — what a real run would have deleted. */
  wouldDelete: SeedRun[];
  /** Runs still holding rows afterwards, i.e. work left to do. */
  remainingRuns: Array<{ runId: string; date: string; pending: number }>;
  ledgerPath: string;
  accountNote: string;
}

/**
 * The line about the account is not advice. `user_id` has no FK to
 * `auth.users` (D-20260812-shared-fix-3), so deleting the verification
 * account leaves its rows in place with nobody able to see or remove them —
 * rows first, account second, and this is where that order is stated.
 */
function accountNoteFor(pendingRuns: number): string {
  return pendingRuns === 0
    ? "Ledger empty — every seeded row is gone. Retiring the verification account is safe now (rows first, account second)."
    : `${pendingRuns} run(s) still hold rows. Do NOT delete the verification account yet: its rows would survive it, unreachable.`;
}

export async function cleanupVerificationState(args: {
  run_id?: string;
  dry_run?: boolean;
}): Promise<CleanupResult> {
  assertVerificationMode("cleanup_verification_state");

  const ledger = readLedger();
  const runs = args.run_id
    ? ledger.runs.filter((run) => run.runId === args.run_id)
    : ledger.runs;

  if (args.run_id && runs.length === 0) {
    throw new Error(
      `Unknown run_id "${args.run_id}" — not in the ledger at ${ledgerPath()}. ` +
        "It may already have been cleaned up.",
    );
  }

  if (args.dry_run) {
    return {
      dryRun: true,
      deleted: 0,
      failures: [],
      wouldDelete: runs,
      remainingRuns: ledger.runs.map((run) => ({
        runId: run.runId,
        date: run.date,
        pending: run.items.length,
      })),
      ledgerPath: ledgerPath(),
      accountNote: accountNoteFor(ledger.runs.length),
    };
  }

  let deleted = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const run of runs) {
    const removed: string[] = [];
    for (const item of run.items) {
      try {
        await hardDelete(item);
        removed.push(item.id);
        deleted += 1;
      } catch (err) {
        failures.push({
          id: item.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    // Per run, so a failure partway through still shortens the list of rows
    // the next attempt has to redo.
    forgetItems(run.runId, removed);
  }

  const remaining = readLedger().runs;
  return {
    dryRun: false,
    deleted,
    failures,
    wouldDelete: [],
    remainingRuns: remaining.map((run) => ({
      runId: run.runId,
      date: run.date,
      pending: run.items.length,
    })),
    ledgerPath: ledgerPath(),
    accountNote: accountNoteFor(remaining.length),
  };
}
