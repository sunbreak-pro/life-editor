// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseRoutinesService } from "../src/services/SupabaseDataService";
import type { RoutineNode } from "../src/types/routine";

/*
 * convertEventToRoutine (#296) — the Event→Repeats conversion. The old UI
 * flow was delete-then-recreate with unordered fire-and-forget writes, so a
 * failed routine INSERT (or the FK race) soft-deleted the seed event with
 * no replacement — the reported "item vanishes" data loss. The service now
 * sequences: createRoutine AWAITED → attach the seed (routine_item_id +
 * source_date) → meta bump; on attach failure the routine is rolled back
 * and the seed is untouched.
 *
 * The attach is CONDITIONAL since #407 (`.is("routine_item_id", null)` +
 * read-back): a second conversion racing the same seed matches zero rows,
 * rolls its own routine back and rethrows — the winning routine keeps the
 * seed. Pre-#407 the unconditional UPDATE re-pointed the seed and stranded
 * the first routine live with no referencing seed (a generator zombie).
 *
 * The BUMP reads its rows back too since #1140, which is what makes it the
 * role gate for the whole method — see the case at the bottom.
 *
 * createRoutine itself is stubbed (own coverage elsewhere); the mock client
 * records update/delete writes so the tests pin the sequencing contract.
 */

interface WriteRecord {
  table: string;
  mode: "update" | "delete";
  patch: Record<string, unknown> | null;
  /** The FIRST `.eq()` — the row address. */
  filter: { col: string; val: unknown };
  /**
   * Every `.eq()` in chain order. #996 added a second one (the role guard) to
   * the items_meta bump, so the address alone no longer describes the write.
   */
  filters: Array<{ col: string; val: unknown }>;
  /** The `.is()` filter the #407 conditional attach adds (attach only). */
  isFilter?: { col: string; val: unknown };
}

/** A live-or-dead row of wiki_tag_assignments (#1632). */
interface AssignmentRow {
  id: string;
  item_id: string;
  tag_id: string;
  is_display_color: boolean;
  is_deleted: boolean;
}

function makeClient(
  opts: {
    attachError?: string;
    seedAlreadyAttached?: boolean;
    /** #1140: the seed's items_meta row is no longer `role='event'`. */
    seedNoLongerAnEvent?: boolean;
    /** #1632: the wiki_tag_assignments rows the move reads. */
    assignments?: AssignmentRow[];
    /** #1632: the move's UPDATE fails. */
    tagMoveError?: string;
  } = {},
) {
  const writes: WriteRecord[] = [];
  const client = {
    from: (table: string) => ({
      /*
       * #1632 read path: the tag move selects the seed's live rows, then the
       * routine's. Actually filtered rather than answered with a constant, so
       * a case can put a tag on the destination and reach the duplicate
       * branch.
       */
      select: () => {
        const eqs: Array<{ col: string; val: unknown }> = [];
        const chain = {
          eq: (col: string, val: unknown) => {
            eqs.push({ col, val });
            return chain;
          },
          then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
            resolve({
              data: (opts.assignments ?? []).filter((r) =>
                eqs.every(
                  (f) =>
                    (r as unknown as Record<string, unknown>)[f.col] === f.val,
                ),
              ),
              error: null,
            }),
        };
        return chain;
      },
      update: (patch: Record<string, unknown>) => {
        const rec: WriteRecord = {
          table,
          mode: "update",
          patch,
          filter: { col: "", val: undefined },
          filters: [],
        };
        // Two consumer shapes, and BOTH now read their rows back: the
        // items_meta bump chains `.eq().eq().select()` (#996 role guard +
        // #1140 row-count check) and the events_payload attach chains
        // `.is().select()` (#407 conditional attach) — so every link has to
        // return the same chainable object.
        const chain = {
          eq: (col: string, val: unknown) => {
            rec.filters.push({ col, val });
            if (rec.filters.length === 1) {
              rec.filter = { col, val };
              writes.push(rec);
            }
            return chain;
          },
          // Reached only by the bump — the attach's `.select()` hangs off the
          // `.is()` link below, which returns its own object.
          select: () =>
            Promise.resolve(
              opts.seedNoLongerAnEvent
                ? { data: [], error: null }
                : { data: [{ id: rec.filter.val }], error: null },
            ),
          is: (isCol: string, isVal: unknown) => {
            rec.isFilter = { col: isCol, val: isVal };
            return {
              select: () =>
                Promise.resolve(
                  opts.attachError
                    ? { data: null, error: { message: opts.attachError } }
                    : opts.seedAlreadyAttached
                      ? { data: [], error: null }
                      : { data: [{ item_id: rec.filter.val }], error: null },
                ),
            };
          },
          // #1632: the tag move addresses its rows by id list and awaits the
          // result directly, so this chain both records and resolves.
          in: (col: string, val: unknown) => {
            rec.filters.push({ col, val });
            if (rec.filters.length === 1) {
              rec.filter = { col, val };
              writes.push(rec);
            }
            return chain;
          },
          then: (
            resolve: (v: { error: { message: string } | null }) => unknown,
          ) =>
            resolve(
              opts.tagMoveError && table === "wiki_tag_assignments"
                ? { error: { message: opts.tagMoveError } }
                : { error: null },
            ),
        };
        return chain;
      },
      /*
       * Chainable, exactly like `update` above — and it has to be. #1098 gave
       * the rollback a second `.eq()` (the role guard), and the old mock
       * returned a bare Promise from the first one, so the chain died on
       * `.eq is not a function`. That TypeError would never have surfaced:
       * the rollback runs inside a catch that hands anything thrown to
       * logServiceError (a console.warn tests/setup.ts does not fail on), and
       * the write record had already been pushed by the first `.eq()`. Both
       * rollback cases below would have stayed green while the rollback did
       * nothing at all.
       */
      delete: () => {
        const rec: WriteRecord = {
          table,
          mode: "delete",
          patch: null,
          filter: { col: "", val: undefined },
          filters: [],
        };
        const chain = {
          eq: (col: string, val: unknown) => {
            rec.filters.push({ col, val });
            if (rec.filters.length === 1) {
              rec.filter = { col, val };
              writes.push(rec);
            }
            return chain;
          },
          then: (
            resolve: (v: { error: { message: string } | null }) => unknown,
          ) => resolve({ error: null }),
        };
        return chain;
      },
    }),
  } as unknown as SupabaseClient;
  return { client, writes };
}

const ROUTINE: RoutineNode = {
  id: "routine-1",
  title: "Stretch",
  startTime: "07:00",
  endTime: "07:30",
  isArchived: false,
  isVisible: true,
  isDeleted: false,
  deletedAt: null,
  order: 0,
  frequencyType: "daily",
  frequencyDays: [],
  frequencyInterval: null,
  frequencyStartDate: null,
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
};

const INIT = { title: "Stretch", sourceDate: "2026-07-19" };

describe("convertEventToRoutine (#296)", () => {
  it("creates the routine FIRST, then attaches the seed and bumps its meta — seed never deleted", async () => {
    const { client, writes } = makeClient();
    const svc = new SupabaseRoutinesService(client);
    const createRoutine = vi
      .spyOn(svc, "createRoutine")
      .mockResolvedValue(ROUTINE);

    const got = await svc.convertEventToRoutine("event-1", "routine-1", INIT);

    expect(got).toBe(ROUTINE);
    expect(createRoutine).toHaveBeenCalledTimes(1);

    // Attach: the seed's payload gains the routine link + its own day as
    // source_date (claims the (routine, source_date) partial-UNIQUE slot).
    const attach = writes.find((w) => w.table === "events_payload");
    expect(attach).toBeDefined();
    expect(attach!.mode).toBe("update");
    expect(attach!.patch).toMatchObject({
      routine_item_id: "routine-1",
      source_date: "2026-07-19",
    });
    expect(attach!.filter).toEqual({ col: "item_id", val: "event-1" });
    // #407: the attach only lands while the seed is still unattached.
    expect(attach!.isFilter).toEqual({ col: "routine_item_id", val: null });

    // The seed's items_meta.updated_at is bumped (DB-Q2 LWW cursor — the
    // payload row carries no own updated_at).
    const bump = writes.find(
      (w) => w.table === "items_meta" && w.mode === "update",
    );
    expect(bump).toBeDefined();
    expect(bump!.filter).toEqual({ col: "id", val: "event-1" });
    expect(typeof bump!.patch!.updated_at).toBe("string");
    // #996: the seed is addressed by id AND role, so a seed converted to a
    // Todo since the host read it is missed rather than bumped.
    expect(bump!.filters).toEqual([
      { col: "id", val: "event-1" },
      { col: "role", val: "event" },
    ]);

    // Nothing is ever deleted on the happy path.
    expect(writes.filter((w) => w.mode === "delete")).toHaveLength(0);
  });

  it("rolls the routine back and rethrows when the attach fails — seed untouched", async () => {
    const { client, writes } = makeClient({ attachError: "boom" });
    const svc = new SupabaseRoutinesService(client);
    vi.spyOn(svc, "createRoutine").mockResolvedValue(ROUTINE);

    await expect(
      svc.convertEventToRoutine("event-1", "routine-1", INIT),
    ).rejects.toThrow(/attach/);

    // Rollback hard-deletes the just-created ROUTINE row only — the seed
    // event is never targeted by any delete.
    const dels = writes.filter((w) => w.mode === "delete");
    expect(dels).toHaveLength(1);
    expect(dels[0].table).toBe("items_meta");
    expect(dels[0].filter).toEqual({ col: "id", val: "routine-1" });
    // #1098: same shape as the #996 assertion on the meta bump above — the id
    // alone no longer describes the address, so the role rides in the WHERE.
    expect(dels[0].filters).toEqual([
      { col: "id", val: "routine-1" },
      { col: "role", val: "routine" },
    ]);
  });

  it("rolls back and rethrows when the seed already belongs to a routine (#407 double-conversion guard)", async () => {
    const { client, writes } = makeClient({ seedAlreadyAttached: true });
    const svc = new SupabaseRoutinesService(client);
    vi.spyOn(svc, "createRoutine").mockResolvedValue(ROUTINE);

    await expect(
      svc.convertEventToRoutine("event-1", "routine-1", INIT),
    ).rejects.toThrow(/already belongs/);

    // The losing conversion must not survive: pre-#407 its routine stayed
    // LIVE with no referencing seed and kept generating occurrences. Only
    // the loser routine is deleted; the seed (owned by the winning routine)
    // is never targeted.
    const dels = writes.filter((w) => w.mode === "delete");
    expect(dels).toHaveLength(1);
    expect(dels[0].table).toBe("items_meta");
    expect(dels[0].filter).toEqual({ col: "id", val: "routine-1" });
    expect(dels[0].filters).toEqual([
      { col: "id", val: "routine-1" },
      { col: "role", val: "routine" },
    ]);
  });

  /*
   * #1140. The bump is the conversion's ONLY role check — the attach filters
   * on item_id and `.is("routine_item_id", null)` and never looks at the
   * role. So when the bump only checked `mErr`, a seed already re-roled to
   * 'task' by convertEventToTodo missed it in silence and the attach bound
   * the new routine to the stray events_payload row that a half-finished
   * conversion leaves behind. The call returned a RoutineNode; what it had
   * actually built was a routine referenced by a role='task' row, which
   * permanentDeleteRoutine's `role='event'` sweep can never clear — the 0011
   * composite FK is NO ACTION, so the purge was refused forever.
   *
   * The assertion that matters most is the one about the attach: refusing
   * after the attach landed would leave the wedge in place and merely report
   * it.
   */
  it("refuses a seed that is no longer an event, before the attach can wedge a purge (#1140)", async () => {
    const { client, writes } = makeClient({ seedNoLongerAnEvent: true });
    const svc = new SupabaseRoutinesService(client);
    vi.spyOn(svc, "createRoutine").mockResolvedValue(ROUTINE);

    await expect(
      svc.convertEventToRoutine("event-1", "routine-1", INIT),
    ).rejects.toThrow(/meta bump: seed event-1 is not a live "event" item/);

    // The attach never ran: nothing on events_payload was written, so the
    // stray payload row keeps its NULL routine link and references nothing.
    expect(writes.filter((w) => w.table === "events_payload")).toHaveLength(0);

    // And the routine created a moment ago is rolled back, so the refusal
    // does not leave a live routine no seed points at (the #407 zombie).
    const dels = writes.filter((w) => w.mode === "delete");
    expect(dels).toHaveLength(1);
    expect(dels[0].filters).toEqual([
      { col: "id", val: "routine-1" },
      { col: "role", val: "routine" },
    ]);
  });

  it("propagates a createRoutine failure without touching anything", async () => {
    const { client, writes } = makeClient();
    const svc = new SupabaseRoutinesService(client);
    vi.spyOn(svc, "createRoutine").mockRejectedValue(
      new Error("insert failed"),
    );

    await expect(
      svc.convertEventToRoutine("event-1", "routine-1", INIT),
    ).rejects.toThrow("insert failed");

    // No attach, no rollback — the routine never existed.
    expect(writes).toHaveLength(0);
  });
});

/*
 * #1632. The seed keeps its id through the conversion (#296), but the editor's
 * tag field switches its read to the ROUTINE id the moment the row has one
 * (ScheduleEventEditor's `routineId ?? item.id`). So a conversion that leaves
 * the assignments on the seed shows an empty tag field while the tag side
 * still lists the seed as tagged — one thing tagged once, counted in two
 * places and visible in neither correctly.
 *
 * The POSITION of the move is the part worth pinning. It is the last step,
 * after the attach, because `wiki_tag_assignments.item_id` references
 * items_meta ON DELETE CASCADE: a rollback firing after a landed move would
 * not merely undo the conversion, it would delete the user's tags.
 */
describe("convertEventToRoutine — the seed's tags follow it into the series (#1632)", () => {
  const seedTags = (): AssignmentRow[] => [
    {
      id: "ta-1",
      item_id: "event-1",
      tag_id: "tag-a",
      is_display_color: false,
      is_deleted: false,
    },
    {
      id: "ta-2",
      item_id: "event-1",
      tag_id: "tag-b",
      is_display_color: true,
      is_deleted: false,
    },
  ];

  const tagWrites = (writes: WriteRecord[]): WriteRecord[] =>
    writes.filter((w) => w.table === "wiki_tag_assignments");

  it("moves the live assignments onto the routine, after the attach has landed", async () => {
    const { client, writes } = makeClient({ assignments: seedTags() });
    const svc = new SupabaseRoutinesService(client);
    vi.spyOn(svc, "createRoutine").mockResolvedValue(ROUTINE);

    await svc.convertEventToRoutine("event-1", "routine-1", INIT);

    const moves = tagWrites(writes);
    expect(moves).toHaveLength(2);
    for (const u of moves) {
      expect(u.patch!.item_id).toBe("routine-1");
      expect(typeof u.patch!.updated_at).toBe("string");
    }
    // The display-colour pick (#1580) travels with its row: the write does
    // not mention the column, so the flag survives the move.
    const coloured = moves.find((u) =>
      (u.filter.val as string[]).includes("ta-2"),
    );
    expect("is_display_color" in coloured!.patch!).toBe(false);

    // After the attach — see the header. A move that ran first would be
    // inside the rollback's blast radius.
    const attachIdx = writes.findIndex((w) => w.table === "events_payload");
    for (const u of moves) {
      expect(writes.indexOf(u)).toBeGreaterThan(attachIdx);
    }
  });

  it("keeps the landed conversion when the move fails", async () => {
    const { client, writes } = makeClient({
      assignments: seedTags(),
      tagMoveError: "boom",
    });
    const svc = new SupabaseRoutinesService(client);
    vi.spyOn(svc, "createRoutine").mockResolvedValue(ROUTINE);

    // The repeat IS on by this point: the attach landed and the seed's
    // payload references the routine, so the 0011 composite FK (NO ACTION)
    // would refuse the rollback anyway. Reporting a failure here would
    // describe a conversion that did happen.
    await expect(
      svc.convertEventToRoutine("event-1", "routine-1", INIT),
    ).resolves.toBe(ROUTINE);

    // No rollback: the tags stay where they are — reachable from the tag
    // side — rather than being lost from both.
    expect(writes.filter((w) => w.mode === "delete")).toHaveLength(0);
  });

  it("never touches the tags when the attach fails", async () => {
    const { client, writes } = makeClient({
      assignments: seedTags(),
      attachError: "boom",
    });
    const svc = new SupabaseRoutinesService(client);
    vi.spyOn(svc, "createRoutine").mockResolvedValue(ROUTINE);

    await expect(
      svc.convertEventToRoutine("event-1", "routine-1", INIT),
    ).rejects.toThrow(/attach/);

    // The rollback hard-deletes the routine, and the cascade would take every
    // assignment pointing at it with it. Nothing points at it.
    expect(tagWrites(writes)).toHaveLength(0);
  });
});
