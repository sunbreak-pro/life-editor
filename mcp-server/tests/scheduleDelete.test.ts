import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSupabaseStub,
  fromTables,
  inFilter,
  type QueryCall,
  type StubRow,
  type StubTables,
  type SupabaseStub,
} from "./supabaseStub.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock and read
// the real supabase module before the stub exists.
const { deleteScheduleItem } =
  await import("../src/handlers/scheduleHandlers.js");
const { rejection } = await import("./rejection.js");

/*
 * delete_schedule_item on an occurrence of a repeating event (#1669).
 *
 * The bug: the tool soft-deleted every event, and the generator's "is this day
 * already there?" check is the partial UNIQUE on events_payload
 * (routine_item_id, source_date) WHERE routine_item_id IS NOT NULL AND
 * is_deleted_cache = false — a trashed occurrence drops out of it, so the app
 * generated the same day again (known-issue 017). The app never deletes an
 * occurrence plainly; it asks this / future / all and runs a different write
 * for each (shared planRepeatScopeChoice → web useRepeatMutations). These
 * tests hold the MCP tool to the same three writes.
 *
 * The stub does not apply writes (see supabaseStub.ts), so `afterWrites`
 * replays the recorded updates onto a copy of the fixture rows. That is what
 * lets a test ask the generator's question about the state the call LEFT
 * rather than about the call's wording.
 */

const TODAY = "2026-09-17";

const meta = (id: string, role: string, over: StubRow = {}): StubRow => ({
  id,
  role,
  title: id,
  is_deleted: false,
  deleted_at: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...over,
});

const event = (id: string, date: string, over: StubRow = {}): StubRow => ({
  item_id: id,
  start_at: date,
  source_date: date,
  start_time: "19:00",
  end_time: "20:00",
  is_all_day: false,
  done: false,
  completed_at: null,
  is_dismissed: false,
  memo: null,
  routine_item_id: "routine-1",
  is_deleted_cache: false,
  ...over,
});

const tables = (): StubTables => ({
  items_meta: [
    meta("routine-1", "routine"),
    meta("si-past-done", "event"),
    meta("si-past", "event"),
    meta("si-today", "event"),
    meta("si-later-done", "event"),
    meta("si-oneoff", "event"),
  ],
  events_payload: [
    event("si-past-done", "2026-09-10", { done: true }),
    event("si-past", "2026-09-15"),
    event("si-today", TODAY),
    event("si-later-done", "2026-09-20", { done: true }),
    event("si-oneoff", TODAY, { routine_item_id: null, source_date: null }),
  ],
});

/** The fixture rows with every awaited update applied, in order. */
function afterWrites(start: StubTables, writes: QueryCall[]): StubTables {
  const next: StubTables = {
    items_meta: start.items_meta.map((r) => ({ ...r })),
    events_payload: start.events_payload.map((r) => ({ ...r })),
  };
  for (const w of writes) {
    expect(w.op).toBe("update"); // nothing here inserts or hard-deletes
    const key = w.table === "items_meta" ? "id" : "item_id";
    const ids = inFilter(w, key) ?? [w.filters[key]];
    for (const row of next[w.table]) {
      const matches =
        ids.includes(row[key]) &&
        Object.entries(w.filters).every(
          ([col, value]) => col === key || row[col] === value,
        );
      if (matches) Object.assign(row, w.values);
    }
  }
  // The 0008 trigger: items_meta.is_deleted is mirrored into the payload.
  for (const payload of next.events_payload) {
    const m = next.items_meta.find((r) => r.id === payload.item_id);
    payload.is_deleted_cache = m?.is_deleted === true;
  }
  return next;
}

/** The generator's dedup: does a live row still hold this routine's day? */
function slotHeld(state: StubTables, routineId: string, date: string) {
  return state.events_payload.some(
    (r) =>
      r.routine_item_id === routineId &&
      r.source_date === date &&
      r.is_deleted_cache === false,
  );
}

const trashed = (state: StubTables, id: string) =>
  state.items_meta.find((r) => r.id === id)?.is_deleted === true;
const payloadOf = (state: StubTables, id: string) =>
  state.events_payload.find((r) => r.item_id === id);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("delete_schedule_item on a one-off event", () => {
  it("still soft-deletes it, scope or no scope", async () => {
    for (const scope of [undefined, "this", "all"] as const) {
      const start = tables();
      stub = createSupabaseStub(fromTables(start));

      const result = await deleteScheduleItem({ id: "si-oneoff", scope });

      expect(result).toEqual({
        success: true,
        id: "si-oneoff",
        softDeleted: true,
      });
      const writes = stub.writes();
      expect(writes).toHaveLength(1);
      expect(writes[0].filters).toEqual({ id: "si-oneoff", role: "event" });
      expect(writes[0].values).toMatchObject({ is_deleted: true });
    }
  });
});

describe("delete_schedule_item on an occurrence of a repeating event", () => {
  it("refuses without a scope and writes nothing, asking for one", async () => {
    stub = createSupabaseStub(fromTables(tables()));

    const error = await rejection(deleteScheduleItem({ id: "si-today" }));

    expect(error.message).toContain("routine-1");
    expect(error.message).toMatch(/Ask the user/);
    expect(error.message).toMatch(/"this".*"future".*"all"/);
    expect(stub.writes()).toEqual([]);
  });

  it('"this" dismisses the day, so the generator does not make it again', async () => {
    const start = tables();
    stub = createSupabaseStub(fromTables(start));

    const result = await deleteScheduleItem({ id: "si-today", scope: "this" });

    expect(result).toMatchObject({
      success: true,
      id: "si-today",
      scope: "this",
      dismissed: true,
      routineId: "routine-1",
    });
    const state = afterWrites(start, stub.writes());
    expect(trashed(state, "si-today")).toBe(false);
    expect(payloadOf(state, "si-today")?.is_dismissed).toBe(true);
    expect(slotHeld(state, "routine-1", TODAY)).toBe(true);
    // The series itself keeps running.
    expect(trashed(state, "routine-1")).toBe(false);
    // §10.2: the payload edit is announced through the meta bump.
    const bump = stub
      .writes()
      .find((w) => w.table === "items_meta" && w.filters.id === "si-today");
    expect(bump?.values).toHaveProperty("updated_at");
  });

  it("a plain soft delete would have freed the slot — the regression this guards", () => {
    const start = tables();
    const softDelete: QueryCall = {
      table: "items_meta",
      op: "update",
      values: { is_deleted: true },
      filters: { id: "si-today", role: "event" },
      bounds: {},
      or: [],
      orders: [],
      executed: true,
    };
    expect(slotHeld(afterWrites(start, [softDelete]), "routine-1", TODAY)).toBe(
      false,
    );
  });

  it('"future" trashes undone days from the anchor, detaches the rest, trashes the routine', async () => {
    const start = tables();
    stub = createSupabaseStub(fromTables(start));

    const result = await deleteScheduleItem({
      id: "si-past",
      scope: "future",
    });

    expect(result).toMatchObject({
      success: true,
      scope: "future",
      routineId: "routine-1",
      routineSoftDeleted: true,
      trashedOccurrenceIds: ["si-past", "si-today"],
      detachedOccurrenceIds: ["si-later-done", "si-past-done"],
    });
    const state = afterWrites(start, stub.writes());
    expect(trashed(state, "routine-1")).toBe(true);
    expect(trashed(state, "si-past")).toBe(true);
    expect(trashed(state, "si-today")).toBe(true);
    // Earlier and completed days survive as one-off records, cut loose so
    // emptying the trash cannot purge them with the routine.
    for (const id of ["si-past-done", "si-later-done"]) {
      expect(trashed(state, id)).toBe(false);
      expect(payloadOf(state, id)).toMatchObject({
        routine_item_id: null,
        source_date: null,
      });
    }
    // The routine is trashed, so the generator has nothing to generate from.
    // A one-off event on the same day is untouched.
    expect(trashed(state, "si-oneoff")).toBe(false);
  });

  it('"future" refuses a day after today and writes nothing', async () => {
    const start = tables();
    start.events_payload.push(event("si-next-week", "2026-09-24"));
    start.items_meta.push(meta("si-next-week", "event"));
    stub = createSupabaseStub(fromTables(start));

    const error = await rejection(
      deleteScheduleItem({ id: "si-next-week", scope: "future" }),
    );

    expect(error.message).toMatch(/after today/);
    expect(stub.writes()).toEqual([]);
  });

  it('"all" trashes the routine with every live occurrence', async () => {
    const start = tables();
    stub = createSupabaseStub(fromTables(start));

    const result = await deleteScheduleItem({ id: "si-today", scope: "all" });

    expect(result).toMatchObject({
      success: true,
      scope: "all",
      routineId: "routine-1",
      routineSoftDeleted: true,
    });
    const state = afterWrites(start, stub.writes());
    expect(trashed(state, "routine-1")).toBe(true);
    for (const id of ["si-past-done", "si-past", "si-today", "si-later-done"]) {
      expect(trashed(state, id)).toBe(true);
    }
    expect(trashed(state, "si-oneoff")).toBe(false);
  });
});
