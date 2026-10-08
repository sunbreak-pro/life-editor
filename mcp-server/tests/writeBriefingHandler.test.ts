import { describe, it, expect, vi } from "vitest";
import { createSupabaseStub, type SupabaseStub } from "./supabaseStub.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock and read
// the real supabase module before the stub exists.
const { writeBriefing } = await import("../src/handlers/briefingHandlers.js");
const { FOCUS_NOTE_ID, mergeFocusSection } =
  await import("../src/utils/focusSection.js");

/*
 * write_briefing routes its two arguments to two different rows (#1097):
 * `focus` → the reserved focus note's per-day section (where the morning
 * paper has read it from since #1048), `paragraphs` → the daily's
 * `morning_comment` column (0035, D-20261007-briefing-1 — beside the body,
 * never in it). What is pinned here is the ROUTING — the section shapes
 * themselves are the pure modules' suites (briefingSection.test.ts /
 * focusSection.test.ts).
 */

const DATE = "2026-08-19";

function doc(...content: unknown[]) {
  return { type: "doc", content };
}

function para(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

/** Answer the two maybeSingle reads with fixture rows (null = missing). */
function tableReads(rows: {
  note?: Record<string, unknown> | null;
  daily?: Record<string, unknown> | null;
}) {
  return createSupabaseStub((call) => {
    if (call.table === "notes_payload") return rows.note ?? null;
    if (call.table === "dailies_payload") return rows.daily ?? null;
    return null;
  });
}

describe("writeBriefing routing", () => {
  it("writes the focus into the note and the paragraphs into the daily", async () => {
    stub = tableReads({
      note: { item_id: FOCUS_NOTE_ID, content_json: doc() },
      daily: { item_id: `daily-${DATE}`, date: DATE, content_json: doc() },
    });

    const result = await writeBriefing({
      date: DATE,
      focus: "一点集中",
      paragraphs: ["講評"],
    });

    expect(result).toEqual({
      date: DATE,
      focus: "一点集中",
      focusNote: { id: FOCUS_NOTE_ID, created: false },
      daily: { id: `daily-${DATE}`, created: false },
    });

    const writes = stub.writes();
    const noteWrite = writes.find((w) => w.table === "notes_payload");
    expect(noteWrite?.op).toBe("update");
    expect(noteWrite?.filters).toEqual({ item_id: FOCUS_NOTE_ID });
    expect(JSON.stringify(noteWrite?.values)).toContain(`フォーカス ${DATE}`);
    expect(JSON.stringify(noteWrite?.values)).toContain("一点集中");

    const dailyWrite = writes.find((w) => w.table === "dailies_payload");
    expect(dailyWrite?.op).toBe("update");
    expect(dailyWrite?.filters).toEqual({ item_id: `daily-${DATE}` });
    // The comment column and nothing else: the body is not rewritten, and
    // the focus is NOT a daily paragraph any more.
    expect(dailyWrite?.values).toEqual({ morning_comment: ["講評"] });

    // Both writes ride the §10.2 LWW bump (+ trash repair) on items_meta.
    const metaBumps = writes.filter((w) => w.table === "items_meta");
    expect(metaBumps).toHaveLength(2);
    for (const bump of metaBumps) {
      expect(bump.values).toMatchObject({ is_deleted: false });
      expect(bump.values).toHaveProperty("updated_at");
    }
  });

  it("never reads the daily's body to write the comment", async () => {
    stub = tableReads({
      note: { item_id: FOCUS_NOTE_ID, content_json: doc() },
      daily: { item_id: `daily-${DATE}`, date: DATE },
    });

    await writeBriefing({
      date: DATE,
      focus: "一点集中",
      paragraphs: ["講評"],
    });

    const dailyReads = stub.calls.filter(
      (c) => c.table === "dailies_payload" && c.op === "select",
    );
    expect(dailyReads.length).toBeGreaterThan(0);
    for (const read of dailyReads)
      expect(read.columns ?? "").not.toContain("content_json");
  });

  it("leaves an older day's 朝刊 section in the body as it is", async () => {
    const legacy = doc(
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "朝刊" }],
      },
      para("前の講評"),
      para("昼にアキとランチ。"),
    );
    stub = tableReads({
      note: { item_id: FOCUS_NOTE_ID, content_json: doc() },
      daily: { item_id: `daily-${DATE}`, date: DATE, content_json: legacy },
    });

    await writeBriefing({
      date: DATE,
      focus: "一点集中",
      paragraphs: ["新しい講評"],
    });

    const dailyWrites = stub
      .writes()
      .filter((w) => w.table === "dailies_payload");
    expect(dailyWrites).toHaveLength(1);
    expect(dailyWrites[0].values).toEqual({ morning_comment: ["新しい講評"] });
  });

  it("creates the day with an empty body and the comment in its column", async () => {
    stub = tableReads({
      note: { item_id: FOCUS_NOTE_ID, content_json: doc() },
      daily: null,
    });

    const result = await writeBriefing({
      date: DATE,
      focus: "一点集中",
      paragraphs: ["講評 1", "講評 2"],
    });

    expect(result.daily).toEqual({ id: `daily-${DATE}`, created: true });
    const writes = stub.writes();
    expect(
      writes.find((w) => w.table === "items_meta" && w.op === "insert")?.values,
    ).toMatchObject({ id: `daily-${DATE}`, role: "daily", title: DATE });
    const payloadInsert = writes.find(
      (w) => w.table === "dailies_payload" && w.op === "insert",
    );
    expect(payloadInsert?.values).toMatchObject({
      item_id: `daily-${DATE}`,
      date: DATE,
      content_json: null,
      morning_comment: ["講評 1", "講評 2"],
      is_pinned: false,
      is_edit_locked: false,
    });
  });

  it("refuses a locked day and writes nothing to it", async () => {
    // The unlocked read (`.eq("has_password", false)`) finds nothing; the
    // lock probe that follows finds the row.
    stub = createSupabaseStub((call) => {
      if (call.table === "notes_payload")
        return { item_id: FOCUS_NOTE_ID, content_json: doc() };
      if (call.table === "dailies_payload") {
        if (call.filters.has_password === false) return null;
        return { item_id: `daily-${DATE}`, date: DATE, has_password: true };
      }
      return null;
    });

    await expect(
      writeBriefing({ date: DATE, focus: "一点集中", paragraphs: ["講評"] }),
    ).rejects.toThrow(/password-protected/);
    expect(stub.writes().some((w) => w.table === "dailies_payload")).toBe(
      false,
    );
  });

  it("leaves the daily completely untouched when there are no paragraphs", async () => {
    stub = tableReads({
      note: { item_id: FOCUS_NOTE_ID, content_json: doc() },
    });

    const result = await writeBriefing({ date: DATE, focus: "一点集中" });

    expect(result.daily).toBeNull();
    expect(stub.calls.some((c) => c.table === "dailies_payload")).toBe(false);
    expect(stub.writes().some((w) => w.table === "items_meta")).toBe(true);
  });

  it("treats blank-only paragraphs as none", async () => {
    stub = tableReads({
      note: { item_id: FOCUS_NOTE_ID, content_json: doc() },
    });

    const result = await writeBriefing({
      date: DATE,
      focus: "一点集中",
      paragraphs: ["", "   "],
    });

    expect(result.daily).toBeNull();
    expect(stub.calls.some((c) => c.table === "dailies_payload")).toBe(false);
  });

  it("creates the reserved note on the first focus ever written", async () => {
    stub = tableReads({ note: null });

    const result = await writeBriefing({ date: DATE, focus: "初回" });

    expect(result.focusNote).toEqual({ id: FOCUS_NOTE_ID, created: true });
    const writes = stub.writes();
    const metaInsert = writes.find(
      (w) => w.table === "items_meta" && w.op === "insert",
    );
    expect(metaInsert?.values).toMatchObject({
      id: FOCUS_NOTE_ID,
      role: "note",
    });
    const payloadInsert = writes.find(
      (w) => w.table === "notes_payload" && w.op === "insert",
    );
    expect(payloadInsert?.values).toMatchObject({
      item_id: FOCUS_NOTE_ID,
      note_type: "note",
    });
  });

  it("skips the note write when the day's focus is already identical", async () => {
    // contentJsonToString stringifies the jsonb value, so a body built by the
    // merge itself round-trips byte-identically — the no-op case.
    const stored = JSON.parse(mergeFocusSection(null, DATE, "一点集中"));
    stub = tableReads({
      note: { item_id: FOCUS_NOTE_ID, content_json: stored },
    });

    const result = await writeBriefing({ date: DATE, focus: "一点集中" });

    expect(result.focusNote).toEqual({ id: FOCUS_NOTE_ID, created: false });
    expect(stub.writes()).toEqual([]);
  });

  it("rejects an empty focus before touching anything", async () => {
    stub = tableReads({});
    await expect(writeBriefing({ date: DATE, focus: "   " })).rejects.toThrow(
      /focus/,
    );
    expect(stub.calls).toEqual([]);
  });

  it("preserves another day's history in the merged note body", async () => {
    stub = tableReads({
      note: {
        item_id: FOCUS_NOTE_ID,
        content_json: doc(
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "フォーカス 2026-08-18" }],
          },
          para("昨日のフォーカス"),
        ),
      },
    });

    await writeBriefing({ date: DATE, focus: "今日のフォーカス" });

    const noteWrite = stub.writes().find((w) => w.table === "notes_payload");
    const body = JSON.stringify(noteWrite?.values);
    expect(body).toContain("フォーカス 2026-08-18");
    expect(body).toContain("昨日のフォーカス");
    expect(body).toContain(`フォーカス ${DATE}`);
  });
});
