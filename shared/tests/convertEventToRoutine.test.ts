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
 * createRoutine itself is stubbed (own coverage elsewhere); the mock client
 * records update/delete writes so the tests pin the sequencing contract.
 */

interface WriteRecord {
  table: string;
  mode: "update" | "delete";
  patch: Record<string, unknown> | null;
  filter: { col: string; val: unknown };
}

function makeClient(opts: { attachError?: string } = {}) {
  const writes: WriteRecord[] = [];
  const client = {
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => {
          writes.push({ table, mode: "update", patch, filter: { col, val } });
          if (table === "events_payload" && opts.attachError) {
            return Promise.resolve({ error: { message: opts.attachError } });
          }
          return Promise.resolve({ error: null });
        },
      }),
      delete: () => ({
        eq: (col: string, val: unknown) => {
          writes.push({
            table,
            mode: "delete",
            patch: null,
            filter: { col, val },
          });
          return Promise.resolve({ error: null });
        },
      }),
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

    // The seed's items_meta.updated_at is bumped (DB-Q2 LWW cursor — the
    // payload row carries no own updated_at).
    const bump = writes.find(
      (w) => w.table === "items_meta" && w.mode === "update",
    );
    expect(bump).toBeDefined();
    expect(bump!.filter).toEqual({ col: "id", val: "event-1" });
    expect(typeof bump!.patch!.updated_at).toBe("string");

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
