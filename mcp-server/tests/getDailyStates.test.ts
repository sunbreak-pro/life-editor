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
  /** The 0035 column; absent = a row from before it. */
  morningComment?: unknown;
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
    dailies_payload: [
      {
        item_id: ID,
        date: DATE,
        content_json: args.content,
        ...(args.morningComment === undefined
          ? {}
          : { morning_comment: args.morningComment }),
      },
    ],
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
      morningComment: null,
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
      morningComment: null,
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

    const daily = await getDaily({ date: DATE });
    expect(daily.hasBriefing).toBe(false);
    expect(daily.morningComment).toBeNull();
  });
});

/*
 * 0035 (D-20261007-briefing-1): write_briefing writes the comment to the
 * `morning_comment` column, beside the body. get_daily hands it back as
 * `morningComment` — the column first, an older day's 朝刊 section second.
 */
describe("get_daily returns the morning comment", () => {
  it("reads the column on a day whose body has no 朝刊 section", async () => {
    setStubTables(
      tables({
        content: doc(paragraph("日記")),
        isDeleted: false,
        morningComment: ["講評 1", "講評 2"],
      }),
    );

    const daily = await getDaily({ date: DATE });
    expect(daily.morningComment).toEqual(["講評 1", "講評 2"]);
    expect(daily.hasBriefing).toBe(true);
  });

  it("prefers the column over an older 朝刊 section in the body", async () => {
    setStubTables(
      tables({
        content: doc(heading("朝刊"), paragraph("前の講評")),
        isDeleted: false,
        morningComment: ["新しい講評"],
      }),
    );

    expect((await getDaily({ date: DATE })).morningComment).toEqual([
      "新しい講評",
    ]);
  });

  it("falls back to the body's 朝刊 section when the column is null or empty", async () => {
    for (const column of [null, [], ["  "], undefined]) {
      setStubTables(
        tables({
          content: doc(heading("朝刊"), paragraph("前の講評"), heading("夕刊")),
          isDeleted: false,
          morningComment: column,
        }),
      );
      const daily = await getDaily({ date: DATE });
      expect(daily.morningComment).toEqual(["前の講評"]);
      expect(daily.hasBriefing).toBe(true);
    }
  });

  it("does not flag a 朝刊 heading with nothing under it", async () => {
    setStubTables(
      tables({
        content: doc(heading("朝刊"), heading("夕刊"), paragraph("x")),
        isDeleted: false,
      }),
    );

    const daily = await getDaily({ date: DATE });
    expect(daily.morningComment).toBeNull();
    expect(daily.hasBriefing).toBe(false);
  });

  it("withholds the comment of a trashed day", async () => {
    setStubTables(
      tables({
        content: doc(paragraph("x")),
        isDeleted: true,
        morningComment: ["隠す講評"],
      }),
    );

    const daily = await getDaily({ date: DATE });
    expect(daily.morningComment).toBeNull();
    expect(JSON.stringify(daily)).not.toContain("隠す講評");
  });
});

describe("the published schema says so", () => {
  it("names the fields the caller now gets back", () => {
    const description =
      TOOLS.find((t) => t.name === "get_daily")?.description ?? "";
    expect(description).toMatch(/exists/);
    expect(description).toMatch(/isTrashed/);
    expect(description).toMatch(/hasBriefing/);
    expect(description).toMatch(/morningComment/);
  });
});
