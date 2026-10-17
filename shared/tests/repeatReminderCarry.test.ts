// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SupabaseRoutinesService,
  SupabaseScheduleItemsService,
} from "../src/services/SupabaseDataService";
import { collectRoutineItemsForDates } from "../src/utils/routineScheduleSync";
import type { ScheduleItem } from "../src/types/schedule";

/*
 * #1642 P7 (N-10): turning Repeat on for an event with a reminder.
 *
 * The seed is attached in place (#296), so it kept its own reminder — but the
 * routine was created with `reminderEnabled` / `reminderOffset` left undefined,
 * and bulkCreateScheduleItems dropped the offset even when a template had one.
 * Every generated day after the seed therefore had no reminder.
 *
 * This suite runs the real chain end to end — the conversion's createRoutine,
 * the routine mapper's read-back, the generator, and the bulk create's mapper —
 * over an in-memory PostgREST stand-in that records each INSERT, and reads the
 * reminder off the rows that would reach the DB.
 */

const USER_ID = "user-1";

interface InsertRecord {
  table: string;
  rows: Array<Record<string, unknown>>;
}

/**
 * One thenable builder for every chain these two services issue. INSERT …
 * `.single()` hands its own row back (createRoutine reads it into the node);
 * a read-back UPDATE claims one row (the seed bump and the attach both check
 * that they matched); every plain SELECT is empty (no tags to move, no live
 * pairs for the bulk create's pre-check).
 */
class Builder implements PromiseLike<{ data: unknown; error: null }> {
  private mode: "select" | "insert" | "update" | "delete" | null = null;
  private rows: Array<Record<string, unknown>> = [];
  private wantsSingle = false;
  private readsBack = false;

  constructor(
    private readonly table: string,
    private readonly inserts: InsertRecord[],
  ) {}

  select(): this {
    if (this.mode === null) this.mode = "select";
    else this.readsBack = true;
    return this;
  }
  insert(rows: Record<string, unknown> | Array<Record<string, unknown>>): this {
    this.mode = "insert";
    this.rows = Array.isArray(rows) ? rows : [rows];
    this.inserts.push({ table: this.table, rows: this.rows });
    return this;
  }
  update(): this {
    this.mode = "update";
    return this;
  }
  delete(): this {
    this.mode = "delete";
    return this;
  }
  eq(): this {
    return this;
  }
  in(): this {
    return this;
  }
  is(): this {
    return this;
  }
  order(): this {
    return this;
  }
  range(): this {
    return this;
  }
  single(): this {
    this.wantsSingle = true;
    return this;
  }

  private result(): { data: unknown; error: null } {
    if (this.mode === "insert" && this.wantsSingle)
      return { data: this.rows[0], error: null };
    if (this.mode === "update" && this.readsBack)
      return { data: [{ id: "seed-1", item_id: "seed-1" }], error: null };
    if (this.mode === "select") return { data: [], error: null };
    return { data: null, error: null };
  }

  then<T1 = { data: unknown; error: null }, T2 = never>(
    onfulfilled?:
      ((v: { data: unknown; error: null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }
}

function makeClient() {
  const inserts: InsertRecord[] = [];
  const client = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: USER_ID } }, error: null }),
    },
    from: (table: string) => new Builder(table, inserts),
  } as unknown as SupabaseClient;
  return { client, inserts };
}

function seedEvent(reminderOffset: number | null): ScheduleItem {
  return {
    id: "seed-1",
    date: "2026-10-19",
    title: "Stretch",
    startTime: "07:00",
    endTime: "07:30",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    reminderEnabled: reminderOffset !== null,
    ...(reminderOffset !== null ? { reminderOffset } : {}),
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  };
}

/**
 * Convert the seed into a daily repeat the way the editor does, generate the
 * week after the seed, and bulk-create it. Returns the events_payload rows the
 * generated days would be written as.
 */
async function convertAndGenerate(seed: ScheduleItem) {
  const { client, inserts } = makeClient();
  const routines = new SupabaseRoutinesService(client);
  const items = new SupabaseScheduleItemsService(client);

  const routine = await routines.convertEventToRoutine(seed.id, "routine-1", {
    title: seed.title,
    startTime: seed.startTime,
    endTime: seed.endTime,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: seed.date,
    reminderOffset: seed.reminderOffset ?? null,
    sourceDate: seed.date,
  });

  // The seed day is already the seed's (the attach claimed it), so the
  // generator is asked for the days after it — the non-seed occurrences.
  const generated = collectRoutineItemsForDates(
    new Date(2026, 9, 20),
    new Date(2026, 9, 26),
    [routine],
    new Set([`${routine.id}:${seed.date}`]),
  );
  await items.bulkCreateScheduleItems(generated);

  const routinePayload = inserts.find((i) => i.table === "routines_payload")!
    .rows[0];
  const occurrences = inserts.find((i) => i.table === "events_payload")!.rows;
  return { routine, routinePayload, occurrences };
}

describe("turning Repeat on for an event with a reminder (#1642 P7, N-10)", () => {
  it("gives every non-seed occurrence the seed's reminderOffset", async () => {
    const seed = seedEvent(15);
    const { routine, routinePayload, occurrences } =
      await convertAndGenerate(seed);

    // The template carries the seed's reminder…
    expect(routinePayload).toMatchObject({
      reminder_enabled: true,
      reminder_offset: 15,
    });
    expect(routine.reminderOffset).toBe(seed.reminderOffset);

    // …and so does each generated day, none of them the seed's own.
    expect(occurrences).toHaveLength(7);
    for (const row of occurrences) {
      expect(row.item_id).not.toBe(seed.id);
      expect(row.source_date).not.toBe(seed.date);
      expect(row.reminder_offset_min).toBe(seed.reminderOffset);
    }
  });

  it("leaves the occurrences without a reminder when the seed had none", async () => {
    const { routinePayload, occurrences } = await convertAndGenerate(
      seedEvent(null),
    );

    expect(routinePayload).toMatchObject({
      reminder_enabled: false,
      reminder_offset: null,
    });
    expect(occurrences).toHaveLength(7);
    for (const row of occurrences) expect(row.reminder_offset_min).toBeNull();
  });

  // A routine whose reminder is switched off can still hold an old offset in
  // routines_payload.reminder_offset. The flag is what says "off", and the
  // events side has no flag of its own, so the offset must not be copied.
  it("does not copy an offset the routine has switched off", async () => {
    const { client, inserts } = makeClient();
    const items = new SupabaseScheduleItemsService(client);

    await items.bulkCreateScheduleItems([
      {
        id: "si-1",
        date: "2026-10-20",
        title: "Stretch",
        startTime: "07:00",
        endTime: "07:30",
        routineId: "routine-1",
        reminderEnabled: false,
        reminderOffset: 15,
      },
    ]);

    const row = inserts.find((i) => i.table === "events_payload")!.rows[0];
    expect(row.reminder_offset_min).toBeNull();
  });
});
