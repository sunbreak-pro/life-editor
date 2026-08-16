import { describe, it, expect } from "vitest";
import {
  assertItemsMetaPair,
  toItemsMetaInsertRow,
  toItemsMetaPatch,
} from "../src/services/itemsMeta";
import { todoUpdatesToPatches } from "../src/services/todoMapper";
import { noteUpdatesToPatches } from "../src/services/notesUnifiedMapper";
import { dailyUpdatesToPatches } from "../src/services/dailiesUnifiedMapper";
import { scheduleItemUpdatesToPatches } from "../src/services/scheduleItemMapper";
import { routineUpdatesToPatches } from "../src/services/routineMapper";

/*
 * #890 — the items_meta half the five role mappers each carried a copy of.
 *
 * The reason this is worth a suite of its own is the failure mode, not the
 * duplication. `items_meta.updated_at` is Sync's LWW cursor and
 * `<role>_payload` has no `updated_at` (db-conventions §10, DB-Q2), so a
 * patch that misses the bump does NOT fail: the write lands locally and the
 * change simply never reaches the other devices. Nothing throws, nothing logs
 * — one domain just goes quietly stale. The role-by-role table below is the
 * guard that every mapper still bumps even when the caller touched only
 * payload columns.
 */

const NOW = "2026-08-16T12:00:00.000Z";

describe("toItemsMetaPatch (#890)", () => {
  it("always bumps updated_at, even for an empty patch", () => {
    expect(toItemsMetaPatch({}, NOW)).toEqual({ updated_at: NOW });
  });

  it("emits only the columns whose key is present", () => {
    expect(toItemsMetaPatch({ title: "T" }, NOW)).toEqual({
      updated_at: NOW,
      title: "T",
    });
  });

  it("normalises a present-but-undefined isDeleted / deletedAt", () => {
    // The shape todo / note / daily relied on: the key is there, so the
    // column is written, with the NOT NULL-safe default.
    expect(
      toItemsMetaPatch({ isDeleted: undefined, deletedAt: undefined }, NOW),
    ).toEqual({ updated_at: NOW, is_deleted: false, deleted_at: null });
  });

  it("leaves a column alone when its key is absent", () => {
    // Events and routines skip an undefined isDeleted by not assigning the
    // key at all — this is what that turns into.
    const patch = toItemsMetaPatch({ deletedAt: null }, NOW);
    expect("is_deleted" in patch).toBe(false);
    expect(patch.deleted_at).toBeNull();
  });

  it("ignores an undefined title or version rather than writing it", () => {
    expect(
      toItemsMetaPatch({ title: undefined, version: undefined }, NOW),
    ).toEqual({ updated_at: NOW });
  });
});

describe("toItemsMetaInsertRow (#890)", () => {
  it("defaults version to 1 and the soft-delete pair to live", () => {
    expect(
      toItemsMetaInsertRow({
        id: "note-1",
        userId: "u1",
        role: "note",
        title: "T",
      }),
    ).toEqual({
      id: "note-1",
      user_id: "u1",
      role: "note",
      title: "T",
      is_deleted: false,
      deleted_at: null,
      version: 1,
    });
  });

  it("carries an explicit version through (the Todos case)", () => {
    expect(
      toItemsMetaInsertRow({
        id: "task-1",
        userId: "u1",
        role: "task",
        title: "T",
        version: 7,
      }).version,
    ).toBe(7);
  });

  it("omits created_at / updated_at so the column DEFAULT owns the first write", () => {
    const row = toItemsMetaInsertRow({
      id: "task-1",
      userId: "u1",
      role: "task",
      title: "T",
    });
    expect("created_at" in row).toBe(false);
    expect("updated_at" in row).toBe(false);
  });
});

describe("assertItemsMetaPair (#890)", () => {
  it("passes a matching pair", () => {
    expect(() =>
      assertItemsMetaPair(
        "todoMapper",
        "task",
        { id: "task-1", role: "task" },
        { item_id: "task-1" },
      ),
    ).not.toThrow();
  });

  it("names the calling mapper when the two rows are different items", () => {
    expect(() =>
      assertItemsMetaPair(
        "todoMapper",
        "task",
        { id: "task-1", role: "task" },
        { item_id: "task-2" },
      ),
    ).toThrow(
      'todoMapper: row mismatch — meta.id="task-1" but payload.item_id="task-2"',
    );
  });

  it("rejects a meta row of the wrong role", () => {
    expect(() =>
      assertItemsMetaPair(
        "routineMapper",
        "routine",
        { id: "x", role: "event" },
        { item_id: "x" },
      ),
    ).toThrow(
      'routineMapper: items_meta.role expected "routine" but got "event"',
    );
  });
});

/*
 * DB-Q2, role by role. Each `updates` below touches ONLY payload columns —
 * the case where forgetting the bump is invisible until another device fails
 * to see the edit.
 */
describe("every role bumps items_meta.updated_at on a payload-only update", () => {
  const cases: Array<{
    role: string;
    run: () => { metaPatch: Record<string, unknown>; payloadPatch: object };
  }> = [
    {
      role: "task",
      run: () => todoUpdatesToPatches({ isExpanded: true }, "u1", NOW),
    },
    {
      role: "note",
      run: () => noteUpdatesToPatches({ isPinned: true }, "u1", NOW),
    },
    {
      role: "daily",
      run: () => dailyUpdatesToPatches({ isPinned: true }, "u1", NOW),
    },
    {
      role: "event",
      run: () =>
        scheduleItemUpdatesToPatches({ startTime: "10:00" }, "u1", NOW),
    },
    {
      role: "routine",
      run: () => routineUpdatesToPatches({ startTime: "10:00" }, "u1", NOW),
    },
  ];

  for (const { role, run } of cases) {
    it(`${role}: metaPatch is the bump and nothing else`, () => {
      const { metaPatch, payloadPatch } = run();
      expect(metaPatch).toEqual({ updated_at: NOW });
      // The update really was payload-only — otherwise the assertion above
      // would pass for the wrong reason.
      expect(Object.keys(payloadPatch).length).toBeGreaterThan(0);
    });
  }
});
