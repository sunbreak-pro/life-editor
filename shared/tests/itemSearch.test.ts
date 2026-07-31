import { describe, it, expect } from "vitest";
import { searchItemPool, type SearchableItem } from "../src/utils/itemSearch";

/*
 * #503 — the palette's cross-item matching. The bug this feature fixes is
 * "typing an existing note's title says 結果が見つかりません", so the first test is
 * literally that case.
 */

const pool: SearchableItem[] = [
  { id: "n1", role: "note", title: "テスト２" },
  { id: "n2", role: "note", title: "テスト１" },
  { id: "t1", role: "task", title: "これはテストです" },
  { id: "e1", role: "event", title: "朝会", detail: "2026-07-31" },
  { id: "d1", role: "daily", title: "2026-07-30" },
];

describe("searchItemPool", () => {
  it("finds the items the palette used to miss", () => {
    const hits = searchItemPool(pool, "テスト");
    expect(hits.map((h) => h.id)).toEqual(["n1", "n2", "t1"]);
  });

  it("returns nothing for an empty or whitespace query", () => {
    // The palette opens on an empty field; dumping the pool there would bury
    // the navigation commands at the moment they are most used.
    expect(searchItemPool(pool, "")).toEqual([]);
    expect(searchItemPool(pool, "   ")).toEqual([]);
  });

  it("matches case-insensitively", () => {
    const mixed: SearchableItem[] = [
      { id: "n1", role: "note", title: "Weekly Review" },
    ];
    expect(searchItemPool(mixed, "WEEKLY")).toHaveLength(1);
    expect(searchItemPool(mixed, "review")).toHaveLength(1);
  });

  it("ranks a prefix match above a mid-title one", () => {
    const notes: SearchableItem[] = [
      { id: "a", role: "note", title: "会議のテンプレ" },
      { id: "b", role: "note", title: "テンプレ集" },
    ];
    expect(searchItemPool(notes, "テンプレ").map((h) => h.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("matches an event by its date, which is how events are remembered", () => {
    const hits = searchItemPool(pool, "2026-07-31");
    expect(hits.map((h) => h.id)).toEqual(["e1"]);
  });

  it("groups results by role in a fixed order", () => {
    const wide: SearchableItem[] = [
      { id: "d", role: "daily", title: "2026-01-01", detail: "x" },
      { id: "e", role: "event", title: "x-event" },
      { id: "n", role: "note", title: "x-note" },
      { id: "t", role: "task", title: "x-task" },
    ];
    expect(searchItemPool(wide, "x").map((h) => h.role)).toEqual([
      "note",
      "task",
      "event",
      "daily",
    ]);
  });

  it("caps PER ROLE so a crowded surface cannot crowd the others out", () => {
    const many: SearchableItem[] = [
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `n${i}`,
        role: "note" as const,
        title: `note ${i}`,
      })),
      { id: "t1", role: "task", title: "note-shaped task" },
    ];
    const hits = searchItemPool(many, "note", { perRoleLimit: 5 });
    expect(hits.filter((h) => h.role === "note")).toHaveLength(5);
    // The single task survives — an overall cap would have dropped it.
    expect(hits.map((h) => h.id)).toContain("t1");
  });

  it("keeps pool order between equally-ranked hits", () => {
    // A stable list is what keeps the row under the cursor from moving when
    // the same query is typed twice.
    const first = searchItemPool(pool, "テスト").map((h) => h.id);
    const second = searchItemPool(pool, "テスト").map((h) => h.id);
    expect(first).toEqual(second);
  });
});
