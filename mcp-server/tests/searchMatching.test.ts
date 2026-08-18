import { describe, it, expect, vi } from "vitest";
import { setStubTables, type StubRow } from "./supabaseStub.js";
import { searchAll } from "../src/handlers/searchHandlers.js";
import { escapeLikePattern } from "../src/utils/like.js";

// Hoisted above the imports by vitest, so the handler below binds to the stub.
vi.mock("../src/supabase.js", async () => {
  const stub = await import("./supabaseStub.js");
  return { getSupabase: stub.getStubSupabase, resetSupabaseForTests: () => {} };
});

/*
 * What search_all counts as a match (#1003).
 *
 * Two ways the todo half disagreed with the rest of the tool. Notes and
 * dailies match with `String.includes` over extracted plain text; todos match
 * with LIKE, server-side, on two tables. Every difference between those two
 * models was a place the answers could diverge without anything erroring.
 *
 *   - LIKE reads `%` and `_` as wildcards. `search_all` wraps the query as
 *     `%<query>%`, so `query: "%"` asked for `%%%` — the whole table. Harmless
 *     while the query still carried a `.limit()`; #828 removed it so the
 *     collection could be counted.
 *   - The content half filtered `.eq('task_type','task')`, which drops NULL
 *     rows. A NULL task_type IS a plain todo (pre-#225), so legacy rows were
 *     invisible to a body search while visible to a title search. #702 ②
 *     closed exactly this hole in `list_todos`; search kept it.
 */

/** A TipTap document whose text is `text`, as jsonb hands it back. */
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

interface TodoSpec {
  id: string;
  title: string;
  body: string;
  taskType?: "task" | "folder" | null;
}

function tables(todos: TodoSpec[]): Record<string, StubRow[]> {
  const items_meta: StubRow[] = [];
  const tasks_payload: StubRow[] = [];
  todos.forEach((t, i) => {
    const stamp = `2026-08-${String(i + 1).padStart(2, "0")}T00:00:00Z`;
    items_meta.push({
      id: t.id,
      role: "task",
      title: t.title,
      is_deleted: false,
      deleted_at: null,
      created_at: stamp,
      updated_at: stamp,
    });
    tasks_payload.push({
      item_id: t.id,
      task_type: t.taskType === undefined ? "task" : t.taskType,
      status: "NOT_STARTED",
      scheduled_at: null,
      content: JSON.stringify(doc(t.body)),
    });
  });
  return { items_meta, tasks_payload };
}

async function todoIds(query: string): Promise<string[]> {
  const page = (await searchAll({ query, domains: ["todos"], limit: 50 }))
    .todos as { results: Array<{ id: string }>; total: number };
  return page.results.map((r) => r.id);
}

describe("LIKE metacharacters mean themselves", () => {
  it("does not turn a bare % into the whole table", async () => {
    setStubTables(
      tables([
        { id: "task-a", title: "alpha", body: "body a" },
        { id: "task-b", title: "beta", body: "body b" },
        { id: "task-c", title: "100% done", body: "body c" },
      ]),
    );

    // Unescaped this was `%%%`, which matches every row.
    expect(await todoIds("%")).toEqual(["task-c"]);
  });

  it("does not turn _ into a single-character wildcard", async () => {
    setStubTables(
      tables([
        // "axb" is the row that tells the two behaviours apart: it matches
        // `a_b` as a wildcard and must not match it as literal text. Without
        // it the test passes either way, because "ab" is too short to match
        // the wildcard form and proves nothing.
        { id: "task-a", title: "axb", body: "body a" },
        { id: "task-b", title: "a_b", body: "body b" },
      ]),
    );

    expect(await todoIds("a_b")).toEqual(["task-b"]);
  });

  it("matches a literal backslash rather than eating the next character", async () => {
    setStubTables(
      tables([
        { id: "task-a", title: "a\\%b", body: "body a" },
        { id: "task-b", title: "axxb", body: "body b" },
      ]),
    );

    expect(await todoIds("a\\%b")).toEqual(["task-a"]);
  });

  it("escapes the three characters and nothing else", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
    expect(escapeLikePattern("c:\\tmp")).toBe("c:\\\\tmp");
    // Ordinary text must survive untouched, or every search changes meaning.
    expect(escapeLikePattern("plain text 123")).toBe("plain text 123");
  });
});

describe("a NULL task_type is a plain todo, on both halves of the merge", () => {
  it("finds a legacy row by its body, not just its title", async () => {
    setStubTables(
      tables([
        {
          id: "task-legacy",
          title: "unrelated",
          body: "needle",
          taskType: null,
        },
      ]),
    );

    // The title does not match; only the content query can find this row, and
    // that is the half `.eq('task_type','task')` used to filter out.
    expect(await todoIds("needle")).toEqual(["task-legacy"]);
  });

  it("finds a legacy row by its title", async () => {
    setStubTables(
      tables([
        { id: "task-legacy", title: "needle", body: "x", taskType: null },
      ]),
    );

    expect(await todoIds("needle")).toEqual(["task-legacy"]);
  });

  it("still hides the retired folder type, whichever half matched", async () => {
    setStubTables(
      tables([
        {
          id: "task-folder-title",
          title: "needle",
          body: "x",
          taskType: "folder",
        },
        {
          id: "task-folder-body",
          title: "x",
          body: "needle",
          taskType: "folder",
        },
        { id: "task-plain", title: "needle", body: "x" },
      ]),
    );

    expect(await todoIds("needle")).toEqual(["task-plain"]);
  });
});
