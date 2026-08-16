import { describe, it, expect, vi } from "vitest";
import { setStubTables } from "./searchSupabaseStub.js";
import { searchAll } from "../src/handlers/searchHandlers.js";

// Hoisted above the imports by vitest, so the handlers below bind to the stub.
vi.mock("../src/supabase.js", async () => {
  const stub = await import("./searchSupabaseStub.js");
  return { getSupabase: stub.getStubSupabase, resetSupabaseForTests: () => {} };
});

/*
 * search_all's RETURN TYPE, pinned by reading it without a cast.
 *
 * The whole point of this file is what it does NOT contain: no `as`. For a
 * while `searchAll` returned `{ totalHits: number }` and nothing else, because
 * `return { ...result, totalHits }` spread a `Record<string, DomainPage>` and
 * `number` is not assignable to that index signature — so TypeScript dropped
 * the signature instead of widening it, taking every domain key with it. The
 * function still ANSWERED with `.todos` at runtime; only the type forgot, so
 * nothing failed until a caller tried to read a domain the honest way.
 *
 * That went unnoticed because the callers of the day cast their way around it
 * (`as Record<string, unknown>`), and because `typecheck:tests` was not a CI
 * gate for mcp-server yet. Both have changed (#1010), so a plain read here is
 * now a real guard: if the signature loses its domain keys again, this file
 * stops compiling and the gate goes red.
 *
 * The assertions are ordinary runtime ones — they are there so the file is a
 * test rather than a type comment, and so a domain that stops answering at all
 * is caught too.
 */

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const STAMP = "2026-08-16T00:00:00.000Z";

const meta = (id: string, role: string, title: string) => ({
  id,
  role,
  title,
  is_deleted: false,
  deleted_at: null,
  created_at: STAMP,
  updated_at: STAMP,
});

/** Exactly one live match per domain, so `totalHits` has one honest answer. */
function seed() {
  setStubTables({
    items_meta: [
      meta("task-1", "task", "alpha task"),
      meta("note-1", "note", "alpha note"),
      meta("daily-2026-08-16", "daily", "2026-08-16"),
    ],
    tasks_payload: [
      {
        item_id: "task-1",
        task_type: "task",
        status: "NOT_STARTED",
        scheduled_at: null,
        content: JSON.stringify(doc("body")),
      },
    ],
    notes_payload: [
      {
        item_id: "note-1",
        note_type: "note",
        content_json: doc("body"),
        is_pinned: false,
        color: null,
      },
    ],
    dailies_payload: [
      {
        item_id: "daily-2026-08-16",
        date: "2026-08-16",
        content_json: doc("alpha day"),
      },
    ],
  });
}

describe("searchAll answers with named domain keys", () => {
  it("lets a caller read a domain without casting", async () => {
    seed();
    const res = await searchAll({ query: "alpha", domains: ["todos"] });
    // The line under test: `.todos`, straight off the return value.
    expect(res.todos?.results).toHaveLength(1);
    expect(res.todos?.total).toBe(1);
    expect(res.totalHits).toBe(1);
  });

  it.each(["todos", "dailies", "notes"] as const)(
    "answers for %s the same way",
    async (domain) => {
      seed();
      const res = await searchAll({ query: "alpha", domains: [domain] });
      expect(res[domain]?.total).toBe(1);
    },
  );

  /*
   * The keys are optional for a reason: a domain answers only when it was
   * asked for. An absent key and an empty page mean different things — "you
   * did not ask" versus "there is nothing" — and flattening them would make a
   * narrowed search look like a failed one.
   */
  it("omits the domains the caller did not ask about", async () => {
    seed();
    const res = await searchAll({ query: "alpha", domains: ["todos"] });
    expect(res.notes).toBeUndefined();
    expect(res.dailies).toBeUndefined();
  });

  it("answers for every domain when asked for none in particular", async () => {
    seed();
    const res = await searchAll({ query: "alpha" });
    expect(res.todos).toBeDefined();
    expect(res.dailies).toBeDefined();
    expect(res.notes).toBeDefined();
    expect(res.totalHits).toBe(3);
  });
});
