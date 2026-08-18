import { describe, it, expect, vi } from "vitest";
import { setStubTables, type StubRow } from "./supabaseStub.js";
import { getDaily } from "../src/handlers/dailyHandlers.js";
import { TOOLS } from "../src/tools.js";

// Hoisted above the imports by vitest, so the handler below binds to the stub.
vi.mock("../src/supabase.js", async () => {
  const stub = await import("./supabaseStub.js");
  return { getSupabase: stub.getStubSupabase, resetSupabaseForTests: () => {} };
});

/*
 * The three states a date can be in (#782 ②).
 *
 * get_daily answered `{ date, content: null }` for a day with no entry AND
 * for a day whose entry is in the trash. The caller — Claude Code writing the
 * morning briefing — could not tell "nothing written yet" from "there is one,
 * you just cannot see it", and writing to the second silently restores it.
 * `hasBriefing` closes the other half: whether 朝刊 is already on the page was
 * only knowable by parsing the whole body.
 */

const DATE = "2026-08-11";
const ID = `daily-${DATE}`;

/** A TipTap document made of the given top-level nodes, as jsonb stores it. */
const doc = (...content: unknown[]) => ({ type: "doc", content });

const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const heading = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});

function tables(args: {
  content: unknown;
  isDeleted: boolean;
}): Record<string, StubRow[]> {
  return {
    items_meta: [
      {
        id: ID,
        role: "daily",
        title: DATE,
        is_deleted: args.isDeleted,
        deleted_at: args.isDeleted ? `${DATE}T09:00:00Z` : null,
        created_at: `${DATE}T00:00:00Z`,
        updated_at: `${DATE}T01:00:00Z`,
      },
    ],
    dailies_payload: [{ item_id: ID, date: DATE, content_json: args.content }],
  };
}

describe("get_daily distinguishes empty from hidden", () => {
  it("reports a date with no daily as not existing", async () => {
    setStubTables({ items_meta: [], dailies_payload: [] });

    expect(await getDaily({ date: DATE })).toEqual({
      date: DATE,
      exists: false,
      isTrashed: false,
      hasBriefing: false,
      content: null,
    });
  });

  it("reports a trashed daily as trashed, and still withholds its body", async () => {
    setStubTables(
      tables({ content: doc(paragraph("secret")), isDeleted: true }),
    );

    const daily = await getDaily({ date: DATE });

    expect(daily).toEqual({
      date: DATE,
      exists: false,
      isTrashed: true,
      hasBriefing: false,
      content: null,
    });
    // What the app hides, the tool does not hand back.
    expect(JSON.stringify(daily)).not.toContain("secret");
  });

  it("returns a live daily with its body and identity", async () => {
    setStubTables(
      tables({ content: doc(paragraph("朝の記録")), isDeleted: false }),
    );

    expect(await getDaily({ date: DATE })).toMatchObject({
      id: ID,
      date: DATE,
      exists: true,
      isTrashed: false,
      hasBriefing: false,
      createdAt: `${DATE}T00:00:00Z`,
      updatedAt: `${DATE}T01:00:00Z`,
    });
  });
});

describe("get_daily says whether the briefing is already written", () => {
  it("flags a daily that carries the 朝刊 section", async () => {
    setStubTables(
      tables({
        content: doc(
          heading("朝刊"),
          paragraph("今日の一点"),
          paragraph("body"),
        ),
        isDeleted: false,
      }),
    );

    expect((await getDaily({ date: DATE })).hasBriefing).toBe(true);
  });

  it("does not flag a daily whose only heading is something else", async () => {
    setStubTables(
      tables({
        content: doc(heading("夕刊"), paragraph("ふりかえり")),
        isDeleted: false,
      }),
    );

    expect((await getDaily({ date: DATE })).hasBriefing).toBe(false);
  });
});

describe("the published schema says so", () => {
  it("names the fields the caller now gets back", () => {
    const description =
      TOOLS.find((t) => t.name === "get_daily")?.description ?? "";
    expect(description).toMatch(/exists/);
    expect(description).toMatch(/isTrashed/);
    expect(description).toMatch(/hasBriefing/);
  });
});
