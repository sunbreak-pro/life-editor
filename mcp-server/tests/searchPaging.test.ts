import { describe, it, expect, vi } from "vitest";
import { setStubTables, type StubRow } from "./searchSupabaseStub.js";
import { searchAll } from "../src/handlers/searchHandlers.js";
import { TOOLS } from "../src/tools.js";

// Hoisted above the imports by vitest, so the handlers below bind to the stub.
vi.mock("../src/supabase.js", async () => {
  const stub = await import("./searchSupabaseStub.js");
  return { getSupabase: stub.getStubSupabase, resetSupabaseForTests: () => {} };
});

/*
 * What search_all says about the matches it did not return (#782 ②).
 *
 * A domain used to answer with a bare array cut at `limit`, and `totalHits`
 * counted the rows on the page. Ten hits therefore looked the same whether
 * they were all of them or the first ten of two hundred, and the only way to
 * find out was to search again with a bigger limit — which is also the only
 * way there was to reach the eleventh. The boundary cases are the ones worth
 * pinning: exactly `limit` matches must NOT claim there are more, and one
 * past it must.
 *
 * The per-domain slice lives on both sides of the same tool — todos merge two
 * server-side queries in-app, notes / dailies filter a whole collection — so
 * each model is checked, not just the cheap one.
 */

/** A TipTap document whose text is `text`, as jsonb hands it back. */
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const day = (i: number) => `2026-08-${String(i + 1).padStart(2, "0")}`;

/** `count` live todos titled "alpha <i>", newest last. */
function todoTables(count: number): Record<string, StubRow[]> {
  const items_meta: StubRow[] = [];
  const tasks_payload: StubRow[] = [];
  for (let i = 0; i < count; i++) {
    const id = `task-${i}`;
    items_meta.push({
      id,
      role: "task",
      title: `alpha ${i}`,
      is_deleted: false,
      deleted_at: null,
      created_at: `${day(i)}T00:00:00Z`,
      updated_at: `${day(i)}T00:00:00Z`,
    });
    tasks_payload.push({
      item_id: id,
      task_type: "task",
      status: "NOT_STARTED",
      scheduled_at: null,
      content: JSON.stringify(doc(`body ${i}`)),
    });
  }
  return { items_meta, tasks_payload };
}

/** `count` live notes titled "alpha <i>". */
function noteTables(count: number): Record<string, StubRow[]> {
  const items_meta: StubRow[] = [];
  const notes_payload: StubRow[] = [];
  for (let i = 0; i < count; i++) {
    const id = `note-${i}`;
    items_meta.push({
      id,
      role: "note",
      title: `alpha ${i}`,
      is_deleted: false,
      deleted_at: null,
      created_at: `${day(i)}T00:00:00Z`,
      updated_at: `${day(i)}T00:00:00Z`,
    });
    notes_payload.push({
      item_id: id,
      note_type: "note",
      content_json: doc(`body ${i}`),
      is_pinned: false,
      color: null,
    });
  }
  return { items_meta, notes_payload };
}

/** `count` live dailies whose body says "alpha". */
function dailyTables(count: number): Record<string, StubRow[]> {
  const items_meta: StubRow[] = [];
  const dailies_payload: StubRow[] = [];
  for (let i = 0; i < count; i++) {
    const date = day(i);
    const id = `daily-${date}`;
    items_meta.push({
      id,
      role: "daily",
      title: date,
      is_deleted: false,
      deleted_at: null,
      created_at: `${date}T00:00:00Z`,
      updated_at: `${date}T00:00:00Z`,
    });
    dailies_payload.push({
      item_id: id,
      date,
      content_json: doc(`alpha ${i}`),
    });
  }
  return { items_meta, dailies_payload };
}

interface Page {
  results: Array<Record<string, unknown>>;
  total: number;
  hasMore: boolean;
}

async function search(
  domain: "todos" | "notes" | "dailies",
  args: { limit?: number; offset?: number } = {},
): Promise<Page & { totalHits: number }> {
  // No `as Record<string, unknown>` here any more: searchAll used to return a
  // type with no domain keys on it at all (the spread dropped the index
  // signature — see the comment on `result` in searchHandlers.ts), and this
  // cast was how the suite got past that. The keys are named now.
  const res = await searchAll({ query: "alpha", domains: [domain], ...args });
  return {
    ...(res[domain] as unknown as Page),
    totalHits: res.totalHits,
  };
}

describe("a full page does not claim there is another one", () => {
  it.each(["todos", "notes", "dailies"] as const)(
    "%s: exactly limit matches → hasMore false",
    async (domain) => {
      const tables = {
        todos: todoTables,
        notes: noteTables,
        dailies: dailyTables,
      };
      setStubTables(tables[domain](3));

      const page = await search(domain, { limit: 3 });

      expect(page.results).toHaveLength(3);
      expect(page.total).toBe(3);
      expect(page.hasMore).toBe(false);
    },
  );

  it.each(["todos", "notes", "dailies"] as const)(
    "%s: one match past limit → hasMore true, and total counts it",
    async (domain) => {
      const tables = {
        todos: todoTables,
        notes: noteTables,
        dailies: dailyTables,
      };
      setStubTables(tables[domain](4));

      const page = await search(domain, { limit: 3 });

      expect(page.results).toHaveLength(3);
      expect(page.total).toBe(4);
      expect(page.hasMore).toBe(true);
      // totalHits counts matches, not the rows that fit on the page.
      expect(page.totalHits).toBe(4);
    },
  );
});

describe("offset pages through a domain", () => {
  it("returns the next slice without repeating the first", async () => {
    setStubTables(todoTables(5));

    const first = await search("todos", { limit: 2 });
    const second = await search("todos", { limit: 2, offset: 2 });
    const last = await search("todos", { limit: 2, offset: 4 });

    const idsOf = (page: Page) => page.results.map((r) => r.id);
    expect(idsOf(first)).toHaveLength(2);
    expect(idsOf(second)).toHaveLength(2);
    expect(idsOf(second)).not.toEqual(expect.arrayContaining(idsOf(first)));
    expect(second.total).toBe(5);
    expect(second.hasMore).toBe(true);

    // The tail knows it is the tail.
    expect(idsOf(last)).toHaveLength(1);
    expect(last.hasMore).toBe(false);
    expect(
      new Set([...idsOf(first), ...idsOf(second), ...idsOf(last)]).size,
    ).toBe(5);
  });

  it("refuses an offset that would slice from the tail", async () => {
    setStubTables(todoTables(3));
    await expect(searchAll({ query: "alpha", offset: -1 })).rejects.toThrow(
      /offset must be a non-negative integer/,
    );
  });
});

describe("a todo page is cut after the union, not before it", () => {
  /*
   * The two halves (title ilike on items_meta, content ilike on
   * tasks_payload) used to be capped server-side with `.limit()`. A
   * content-only hit sitting past that cap never entered the merge, so the
   * count the caller saw was of one half's rows, not of the matches.
   */
  it("counts content-only hits in total and returns them on later pages", async () => {
    const tables = todoTables(3);
    // MORE content-only hits than the page size: if the tasks_payload half
    // were capped server-side again, the ones past the cap would never reach
    // the merge and total would undercount without any test going red.
    for (let i = 0; i < 4; i++) {
      tables.items_meta.push({
        id: `task-x${i}`,
        role: "task",
        title: "unrelated",
        is_deleted: false,
        deleted_at: null,
        created_at: "2026-07-01T00:00:00Z",
        updated_at: "2026-07-01T00:00:00Z",
      });
      tables.tasks_payload.push({
        item_id: `task-x${i}`,
        task_type: "task",
        status: "NOT_STARTED",
        scheduled_at: null,
        content: JSON.stringify(doc("mentions alpha in the body")),
      });
    }
    setStubTables(tables);

    const page = await search("todos", { limit: 3 });
    expect(page.total).toBe(7);
    expect(page.hasMore).toBe(true);

    // All four share the oldest created_at, so they land last in id order
    // (the tie-break) — reachable only via offset, stable across pages.
    const tail = await search("todos", { limit: 3, offset: 3 });
    expect(tail.results.map((r) => r.id)).toEqual([
      "task-x0",
      "task-x1",
      "task-x2",
    ]);
    const last = await search("todos", { limit: 3, offset: 6 });
    expect(last.results.map((r) => r.id)).toEqual(["task-x3"]);
    expect(last.hasMore).toBe(false);
  });
});

describe("a daily hit can be acted on", () => {
  it("carries the item id, not just the date", async () => {
    setStubTables(dailyTables(1));

    const page = await search("dailies", { limit: 10 });

    expect(page.results[0]).toMatchObject({
      // tag_entity / get_entity_tags take an id; the date alone was a dead end.
      id: "daily-2026-08-01",
      date: "2026-08-01",
    });
  });
});

describe("the published schema says so", () => {
  const tool = TOOLS.find((t) => t.name === "search_all");

  it("offers offset beside limit", () => {
    const props = (tool?.inputSchema.properties ?? {}) as Record<
      string,
      unknown
    >;
    expect(props).toHaveProperty("offset");
    expect(props.offset).toMatchObject({ type: "number" });
    expect(props).toHaveProperty("limit");
  });

  it("tells the caller the result shape it now gets", () => {
    const description = tool?.description ?? "";
    expect(description).toMatch(/results/);
    expect(description).toMatch(/total/);
    expect(description).toMatch(/hasMore/);
    expect(description).toMatch(/offset/);
  });
});
