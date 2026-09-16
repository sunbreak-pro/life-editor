// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseRoutinesService } from "../src/services/SupabaseDataService";

/*
 * detachRoutine (#185 Step 3) — the "turn the repeat off" path. Unlike
 * softDeleteRoutine (which trashes EVERY live occurrence), detach must keep
 * the user's life record: only FUTURE, INCOMPLETE, still-LIVE occurrences are
 * soft-deleted; past occurrences (completed or not) and completed future ones
 * survive. The routine itself is then soft-deleted WITHOUT cascading to those
 * survivors. Every write bumps items_meta.updated_at (DB-Q2 LWW cursor).
 *
 * The test drives the real service against a hand-rolled Supabase query-
 * builder mock that reproduces the two behaviours detachRoutine relies on:
 * chained `.eq()/.gte()/.range()` SELECT filtering on events_payload, and
 * `.update().in()/.eq()` UPDATE recording on items_meta.
 */

interface EventRow {
  item_id: string;
  routine_item_id: string;
  is_deleted_cache: boolean;
  done: boolean;
  start_at: string; // YYYY-MM-DD
}

interface UpdateRecord {
  table: string;
  patch: Record<string, unknown>;
  filter: { op: "in" | "eq"; col: string; val: unknown };
}

interface Filter {
  op: "eq" | "gte" | "in";
  col: string;
  val: unknown;
}

/** A live-or-dead row of wiki_tag_assignments (#1632). */
interface AssignmentRow {
  id: string;
  item_id: string;
  tag_id: string;
  is_display_color: boolean;
  is_deleted: boolean;
}

/** A single-use, thenable PostgREST builder mock. */
class Builder implements PromiseLike<{ data?: unknown; error: unknown }> {
  mode: "select" | "update" | null = null;
  patch: Record<string, unknown> = {};
  filters: Filter[] = [];
  rangeArgs: [number, number] | null = null;

  constructor(
    private readonly table: string,
    private readonly events: EventRow[],
    private readonly updates: UpdateRecord[],
    private readonly assignments: AssignmentRow[],
  ) {}

  select(): this {
    this.mode = "select";
    return this;
  }
  update(patch: Record<string, unknown>): this {
    this.mode = "update";
    this.patch = patch;
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filters.push({ op: "eq", col, val });
    return this;
  }
  gte(col: string, val: unknown): this {
    this.filters.push({ op: "gte", col, val });
    return this;
  }
  in(col: string, val: unknown): this {
    this.filters.push({ op: "in", col, val });
    return this;
  }
  order(): this {
    return this;
  }
  range(from: number, to: number): this {
    this.rangeArgs = [from, to];
    return this;
  }

  private resolve(): { data?: unknown; error: unknown } {
    if (this.mode === "select") {
      // #1632: the tag move reads this table twice (source then destination)
      // before the routine is trashed. Its own table, because filtering the
      // EVENT rows by `item_id` would answer "no tags" for every case and the
      // suite could not tell a working move from a missing one.
      if (this.table === "wiki_tag_assignments") {
        const live = this.assignments.filter((r) =>
          this.filters.every((f) => {
            const cell = (r as unknown as Record<string, unknown>)[f.col];
            return f.op === "eq" ? cell === f.val : true;
          }),
        );
        return {
          data: live.map((r) => ({
            id: r.id,
            tag_id: r.tag_id,
            is_display_color: r.is_display_color,
          })),
          error: null,
        };
      }
      let rows = this.events.filter((r) =>
        this.filters.every((f) => {
          const cell = (r as unknown as Record<string, unknown>)[f.col];
          if (f.op === "eq") return cell === f.val;
          if (f.op === "gte") return (cell as string) >= (f.val as string);
          return true;
        }),
      );
      // Deterministic order by the unique tiebreaker the code .order()s on.
      rows = rows.slice().sort((a, b) => (a.item_id < b.item_id ? -1 : 1));
      if (this.rangeArgs) {
        const [from, to] = this.rangeArgs;
        rows = rows.slice(from, to + 1);
      }
      // Return the columns detachRoutine selects (item_id + partition fields).
      return {
        data: rows.map((r) => ({
          item_id: r.item_id,
          start_at: r.start_at,
          done: r.done,
        })),
        error: null,
      };
    }
    // update — record the mutation for assertions.
    const filter = this.filters.find((f) => f.op === "in" || f.op === "eq");
    if (filter) {
      this.updates.push({
        table: this.table,
        patch: this.patch,
        filter: {
          op: filter.op as "in" | "eq",
          col: filter.col,
          val: filter.val,
        },
      });
    }
    return { error: null };
  }

  then<TResult1 = { data?: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data?: unknown;
          error: unknown;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

function makeClient(events: EventRow[], assignments: AssignmentRow[] = []) {
  const updates: UpdateRecord[] = [];
  const client = {
    from: (table: string) => new Builder(table, events, updates, assignments),
  } as unknown as SupabaseClient;
  return { client, updates };
}

const TODAY = "2026-07-12";
const ROUTINE = "routine-1";

function seed(): EventRow[] {
  return [
    // survives — past, incomplete
    {
      item_id: "e-past",
      routine_item_id: ROUTINE,
      is_deleted_cache: false,
      done: false,
      start_at: "2026-07-01",
    },
    // survives — past, completed
    {
      item_id: "e-pastdone",
      routine_item_id: ROUTINE,
      is_deleted_cache: false,
      done: true,
      start_at: "2026-07-02",
    },
    // DELETED — today, incomplete
    {
      item_id: "e-today",
      routine_item_id: ROUTINE,
      is_deleted_cache: false,
      done: false,
      start_at: TODAY,
    },
    // DELETED — future, incomplete
    {
      item_id: "e-future",
      routine_item_id: ROUTINE,
      is_deleted_cache: false,
      done: false,
      start_at: "2026-07-20",
    },
    // survives — future, completed
    {
      item_id: "e-futuredone",
      routine_item_id: ROUTINE,
      is_deleted_cache: false,
      done: true,
      start_at: "2026-07-25",
    },
    // survives — future incomplete but already trashed
    {
      item_id: "e-gone",
      routine_item_id: ROUTINE,
      is_deleted_cache: true,
      done: false,
      start_at: "2026-07-21",
    },
    // survives — belongs to a different routine
    {
      item_id: "e-other",
      routine_item_id: "routine-2",
      is_deleted_cache: false,
      done: false,
      start_at: "2026-07-20",
    },
  ];
}

/** items_meta soft-delete UPDATEs (is_deleted:true) targeting occurrence ids. */
function softDeletedIds(updates: UpdateRecord[]): string[] {
  const out: string[] = [];
  for (const u of updates) {
    if (
      u.table === "items_meta" &&
      u.filter.op === "in" &&
      u.patch.is_deleted === true
    ) {
      out.push(...(u.filter.val as string[]));
    }
  }
  return out.sort();
}

describe("detachRoutine — future/incomplete occurrence pruning", () => {
  it("soft-deletes only today-onward incomplete live occurrences (a)", async () => {
    const { client, updates } = makeClient(seed());
    const svc = new SupabaseRoutinesService(client);

    const result = await svc.detachRoutine(ROUTINE, TODAY);

    // Returned ids + the actual soft-delete UPDATE both = exactly the
    // future/today + incomplete + live occurrences.
    expect([...result.deletedScheduleItemIds].sort()).toEqual([
      "e-future",
      "e-today",
    ]);
    expect(softDeletedIds(updates)).toEqual(["e-future", "e-today"]);

    // Survivors are NEVER soft-deleted.
    for (const survivor of ["e-past", "e-pastdone", "e-futuredone"]) {
      expect(softDeletedIds(updates)).not.toContain(survivor);
    }
    // Trashed + other-routine rows are never referenced at all.
    const touched = new Set<string>();
    for (const u of updates) {
      if (u.filter.op === "in")
        for (const v of u.filter.val as string[]) touched.add(v);
      else touched.add(u.filter.val as string);
    }
    expect(touched.has("e-gone")).toBe(false);
    expect(touched.has("e-other")).toBe(false);
  });

  it("detaches (NULLs) surviving live occurrences and bumps their updated_at", async () => {
    const { client, updates } = makeClient(seed());
    const svc = new SupabaseRoutinesService(client);

    await svc.detachRoutine(ROUTINE, TODAY);

    // events_payload link cleared for exactly the live survivors.
    const payloadEdit = updates.find((u) => u.table === "events_payload");
    expect(payloadEdit).toBeDefined();
    expect(payloadEdit!.patch.routine_item_id).toBeNull();
    expect(payloadEdit!.patch.source_date).toBeNull();
    expect([...(payloadEdit!.filter.val as string[])].sort()).toEqual([
      "e-futuredone",
      "e-past",
      "e-pastdone",
    ]);

    // The sibling items_meta bump (updated_at only, NOT a soft-delete) carries
    // the LWW signal for that payload edit over the same ids (DB-Q2).
    const bump = updates.find(
      (u) =>
        u.table === "items_meta" &&
        u.filter.op === "in" &&
        !("is_deleted" in u.patch),
    );
    expect(bump).toBeDefined();
    expect(typeof bump!.patch.updated_at).toBe("string");
    expect([...(bump!.filter.val as string[])].sort()).toEqual([
      "e-futuredone",
      "e-past",
      "e-pastdone",
    ]);

    // Trashed survivor is not re-touched; other routine untouched.
    const touched = new Set<string>();
    for (const u of updates) {
      if (u.filter.op === "in")
        for (const v of u.filter.val as string[]) touched.add(v);
      else touched.add(u.filter.val as string);
    }
    expect(touched.has("e-gone")).toBe(false);
    expect(touched.has("e-other")).toBe(false);
  });

  it("soft-deletes the routine itself with NO cascade to survivors (b)", async () => {
    const { client, updates } = makeClient(seed());
    const svc = new SupabaseRoutinesService(client);

    await svc.detachRoutine(ROUTINE, TODAY);

    // The routine row is soft-deleted via eq id (a single targeted row).
    const routineUpdate = updates.find(
      (u) => u.filter.op === "eq" && u.filter.val === ROUTINE,
    );
    expect(routineUpdate).toBeDefined();
    expect(routineUpdate!.table).toBe("items_meta");
    expect(routineUpdate!.patch.is_deleted).toBe(true);

    // Exactly four writes, none of which soft-deletes a survivor:
    //   (1) soft-delete future/incomplete occurrences
    //   (2) NULL the survivors' events_payload link
    //   (3) bump the survivors' items_meta.updated_at
    //   (4) soft-delete the routine row
    expect(updates).toHaveLength(4);
    for (const survivor of ["e-past", "e-pastdone", "e-futuredone"]) {
      expect(softDeletedIds(updates)).not.toContain(survivor);
    }
  });

  it("bumps items_meta.updated_at on every meta write (DB-Q2)", async () => {
    const { client, updates } = makeClient(seed());
    const svc = new SupabaseRoutinesService(client);

    await svc.detachRoutine(ROUTINE, TODAY);

    const metaWrites = updates.filter((u) => u.table === "items_meta");
    expect(metaWrites.length).toBeGreaterThan(0);
    for (const u of metaWrites) {
      expect(typeof u.patch.updated_at).toBe("string");
    }
    // Soft-delete writes additionally set is_deleted + deleted_at.
    for (const u of metaWrites) {
      if (u.patch.is_deleted === true) {
        expect(typeof u.patch.deleted_at).toBe("string");
      }
    }
  });

  it("pins keepItemIds as detached survivors instead of deleting them (#296)", async () => {
    // The repeat-off editor pins the occurrence the user is editing —
    // today's incomplete row, which the plain partition would delete.
    const { client, updates } = makeClient(seed());
    const svc = new SupabaseRoutinesService(client);

    const result = await svc.detachRoutine(ROUTINE, TODAY, {
      keepItemIds: ["e-today"],
    });

    // Only the OTHER future/incomplete occurrence is deleted.
    expect([...result.deletedScheduleItemIds].sort()).toEqual(["e-future"]);
    expect(softDeletedIds(updates)).toEqual(["e-future"]);

    // The pinned row joins the detach partition: link NULLed + meta bumped.
    const payloadEdit = updates.find((u) => u.table === "events_payload");
    expect(payloadEdit).toBeDefined();
    expect(payloadEdit!.patch.routine_item_id).toBeNull();
    expect([...(payloadEdit!.filter.val as string[])].sort()).toEqual([
      "e-futuredone",
      "e-past",
      "e-pastdone",
      "e-today",
    ]);

    // The routine itself is still soft-deleted (repeat is OFF).
    const routineUpdate = updates.find(
      (u) => u.filter.op === "eq" && u.filter.val === ROUTINE,
    );
    expect(routineUpdate?.patch.is_deleted).toBe(true);
  });

  it("detaches survivors + soft-deletes the routine when there are no future occurrences", async () => {
    // Only past + completed occurrences: nothing to soft-delete, but the
    // survivors must still be cut loose and the routine detached.
    const events: EventRow[] = [
      {
        item_id: "e-past",
        routine_item_id: ROUTINE,
        is_deleted_cache: false,
        done: false,
        start_at: "2026-07-01",
      },
      {
        item_id: "e-futuredone",
        routine_item_id: ROUTINE,
        is_deleted_cache: false,
        done: true,
        start_at: "2026-07-30",
      },
    ];
    const { client, updates } = makeClient(events);
    const svc = new SupabaseRoutinesService(client);

    const result = await svc.detachRoutine(ROUTINE, TODAY);

    expect(result.deletedScheduleItemIds).toEqual([]);
    // No soft-delete of an occurrence.
    expect(softDeletedIds(updates)).toEqual([]);
    // Three writes: payload NULL + meta bump (survivors) + routine soft-delete.
    expect(updates).toHaveLength(3);
    const routineUpdate = updates.find(
      (u) => u.filter.op === "eq" && u.filter.val === ROUTINE,
    );
    expect(routineUpdate?.patch.is_deleted).toBe(true);
    const payloadEdit = updates.find((u) => u.table === "events_payload");
    expect(payloadEdit?.patch.routine_item_id).toBeNull();
    expect([...(payloadEdit!.filter.val as string[])].sort()).toEqual([
      "e-futuredone",
      "e-past",
    ]);
  });
});

/*
 * #1632, the way back. Turning a repeat off leaves the pinned occurrence on
 * the calendar as a one-off, and the editor's tag field goes back to reading
 * the ITEM id the moment `routineId` is gone — so tags left on the routine
 * disappear from the field while the tag side keeps listing the series.
 * convertEventToRoutine does the same move in the other direction.
 */
describe("detachRoutine — tags hand back to the pinned survivor (#1632)", () => {
  const seedTags = (): AssignmentRow[] => [
    {
      id: "ta-1",
      item_id: ROUTINE,
      tag_id: "tag-a",
      is_display_color: false,
      is_deleted: false,
    },
    {
      id: "ta-2",
      item_id: ROUTINE,
      tag_id: "tag-b",
      is_display_color: true,
      is_deleted: false,
    },
    // Removed by the user at some point — reviving it would put a tag back
    // that they took off.
    {
      id: "ta-dead",
      item_id: ROUTINE,
      tag_id: "tag-c",
      is_display_color: false,
      is_deleted: true,
    },
  ];

  const tagWrites = (updates: UpdateRecord[]): UpdateRecord[] =>
    updates.filter((u) => u.table === "wiki_tag_assignments");

  it("moves the live ones onto the survivor while it is still a live item", async () => {
    const { client, updates } = makeClient(seed(), seedTags());
    const svc = new SupabaseRoutinesService(client);

    await svc.detachRoutine(ROUTINE, TODAY, { keepItemIds: ["e-today"] });

    const moves = tagWrites(updates);
    expect(moves).toHaveLength(2);

    const plain = moves.find((u) =>
      (u.filter.val as string[]).includes("ta-1"),
    );
    expect(plain!.patch).toMatchObject({
      item_id: "e-today",
      is_display_color: false,
    });

    // The display-colour pick (#1580) keeps its flag: the write does not
    // mention the column, so the row carries it across unchanged.
    const coloured = moves.find((u) =>
      (u.filter.val as string[]).includes("ta-2"),
    );
    expect(coloured!.patch.item_id).toBe("e-today");
    expect("is_display_color" in coloured!.patch).toBe(false);

    for (const u of moves) {
      expect(u.filter.val as string[]).not.toContain("ta-dead");
      expect(typeof u.patch.updated_at).toBe("string");
    }

    // Order is load-bearing: the routine's own soft-delete comes after, so
    // the rows never land on an item that is already in the trash.
    const routineIdx = updates.findIndex(
      (u) => u.filter.op === "eq" && u.filter.val === ROUTINE,
    );
    for (const u of moves) {
      expect(updates.indexOf(u)).toBeLessThan(routineIdx);
    }
  });

  it("moves nothing when the caller pinned no single survivor", async () => {
    // The scope dialog's "delete / future" detach has no seed to hand the
    // tags to; picking one would be inventing an owner.
    const { client, updates } = makeClient(seed(), seedTags());
    const svc = new SupabaseRoutinesService(client);

    await svc.detachRoutine(ROUTINE, TODAY);

    expect(tagWrites(updates)).toHaveLength(0);
  });

  it("drops rather than moves a tag the survivor already carries", async () => {
    // uq_wta_item_tag allows one LIVE (item, tag) row, and two rows for one
    // tag would make the tag side count the same thing twice anyway.
    const { client, updates } = makeClient(seed(), [
      ...seedTags(),
      {
        id: "ta-own",
        item_id: "e-today",
        tag_id: "tag-a",
        is_display_color: false,
        is_deleted: false,
      },
    ]);
    const svc = new SupabaseRoutinesService(client);

    await svc.detachRoutine(ROUTINE, TODAY, { keepItemIds: ["e-today"] });

    const moves = tagWrites(updates);
    const dropped = moves.find((u) => u.patch.is_deleted === true);
    expect(dropped).toBeDefined();
    expect(dropped!.filter.val).toEqual(["ta-1"]);
    // The survivor's own row is never rewritten.
    for (const u of moves) {
      expect(u.filter.val as string[]).not.toContain("ta-own");
    }
    // The tag the survivor does NOT have still moves.
    const moved = moves.find((u) => u.patch.item_id === "e-today");
    expect(moved!.filter.val).toEqual(["ta-2"]);
  });
});
