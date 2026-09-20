import { describe, it, expect, vi } from "vitest";
import {
  createSupabaseStub,
  fromTables,
  inFilter,
  type QueryCall,
  type StubTables,
  type SupabaseStub,
} from "./supabaseStub.js";
import { rejection } from "./rejection.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock and read
// the real supabase module before the stub exists.
const { getNote, listNotes, updateNote, deleteNote } =
  await import("../src/handlers/noteHandlers.js");
const { getNoteContext } =
  await import("../src/handlers/noteContextHandlers.js");
const { searchAll } = await import("../src/handlers/searchHandlers.js");
const { getDaily, upsertDaily } =
  await import("../src/handlers/dailyHandlers.js");
const { formatContent, generateContent } =
  await import("../src/handlers/contentHandlers.js");
const { writeBriefing } = await import("../src/handlers/briefingHandlers.js");
const { FOCUS_NOTE_ID } = await import("../src/utils/focusSection.js");

/*
 * The password gate on note / daily bodies (#1763, D-20260920-main-1 = A).
 *
 * Two things are pinned here, and they are not the same thing:
 *
 *   1. no tool ANSWERS with a locked body — `expect(json).not.toContain(...)`
 *      over the whole serialised result, so a body smuggled into a field
 *      nobody thought to name still fails;
 *   2. no query ASKS for one — `bodyReadsFor()` walks the recorded calls and
 *      finds every SELECT naming `content_json` that could reach the locked
 *      row. "Fetched and dropped" would satisfy (1) and leave the body one
 *      stray console.log away from a leak.
 *
 * The secrets are spelled in ASCII on purpose: a JSON.stringify of a TipTap
 * document escapes nothing here, so `not.toContain` is a real test.
 */

const SECRET_NOTE_BODY = "SECRET-NOTE-BODY";
const SECRET_DAY_BODY = "SECRET-DAY-BODY";
const OPEN_NOTE_BODY = "OPEN-NOTE-BODY";

const LOCKED_NOTE = "note-locked";
const OPEN_NOTE = "note-open";
const LOCKED_DATE = "2026-09-20";
const OPEN_DATE = "2026-09-19";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const STAMP = "2026-09-20T00:00:00.000Z";

const meta = (id: string, role: string, title: string) => ({
  id,
  role,
  title,
  is_deleted: false,
  deleted_at: null,
  created_at: STAMP,
  updated_at: STAMP,
});

function tables(): StubTables {
  return {
    items_meta: [
      meta(OPEN_NOTE, "note", "Shopping list"),
      meta(LOCKED_NOTE, "note", "Locked diary"),
      meta(FOCUS_NOTE_ID, "note", "フォーカス"),
      meta(`daily-${OPEN_DATE}`, "daily", OPEN_DATE),
      meta(`daily-${LOCKED_DATE}`, "daily", LOCKED_DATE),
    ],
    notes_payload: [
      {
        item_id: OPEN_NOTE,
        note_type: "note",
        content_json: doc(OPEN_NOTE_BODY),
        is_pinned: false,
        color: null,
        has_password: false,
      },
      {
        item_id: LOCKED_NOTE,
        note_type: "note",
        content_json: doc(SECRET_NOTE_BODY),
        is_pinned: false,
        color: null,
        has_password: true,
      },
      {
        item_id: FOCUS_NOTE_ID,
        note_type: "note",
        content_json: doc("focus"),
        is_pinned: false,
        color: null,
        has_password: true,
      },
    ],
    dailies_payload: [
      {
        item_id: `daily-${OPEN_DATE}`,
        date: OPEN_DATE,
        content_json: doc("open day"),
        has_password: false,
      },
      {
        item_id: `daily-${LOCKED_DATE}`,
        date: LOCKED_DATE,
        content_json: doc(SECRET_DAY_BODY),
        has_password: true,
      },
    ],
    wiki_tag_connections: [],
    entity_tags: [],
    wiki_tags: [],
  };
}

function install(): void {
  stub = createSupabaseStub(fromTables(tables()));
}

/**
 * Every executed SELECT that named `content_json` AND could have reached
 * `id` — by equality, by an `.in()` list, or by naming no id at all (a
 * collection read). An empty result is the claim "this body was never
 * requested".
 */
function bodyReadsFor(table: string, id: string): QueryCall[] {
  return stub.calls.filter((call) => {
    if (call.table !== table || call.op !== "select") return false;
    if (!call.columns?.includes("content_json")) return false;
    // `.eq("has_password", false)` is part of the request, so Postgres can
    // only answer it with UNLOCKED rows — the unlocked-first read that keeps
    // an ordinary note at one round trip. Such a query cannot carry a locked
    // body no matter which id it names.
    if (call.filters.has_password === false) return false;
    const ids = inFilter(call, "item_id");
    if (ids) return ids.includes(id);
    if (call.filters.item_id !== undefined) return call.filters.item_id === id;
    return true; // an unfiltered collection read sweeps every row up
  });
}

describe("get_note", () => {
  it("hands back the metadata of a locked note and none of its body", async () => {
    install();

    const note = await getNote({ id: LOCKED_NOTE });

    expect(note).toMatchObject({
      id: LOCKED_NOTE,
      title: "Locked diary",
      hasPassword: true,
      locked: true,
    });
    expect(note).not.toHaveProperty("content");
    expect(note).not.toHaveProperty("contentText");
    expect(JSON.stringify(note)).not.toContain(SECRET_NOTE_BODY);
    expect(bodyReadsFor("notes_payload", LOCKED_NOTE)).toEqual([]);
  });

  it("says why, so the note does not read as an empty one", async () => {
    install();

    const note = await getNote({ id: LOCKED_NOTE });

    expect((note as { lockedReason?: string }).lockedReason).toContain(
      "password",
    );
  });

  it("still answers an unlocked note in full, in one payload read", async () => {
    install();

    const note = await getNote({ id: OPEN_NOTE });

    expect(JSON.stringify(note)).toContain(OPEN_NOTE_BODY);
    expect((note as { hasPassword: boolean }).hasPassword).toBe(false);
    // One payload read, not two: the gate costs an extra round trip only on
    // the locked path, which is the rarer one.
    const payloadReads = stub.calls.filter(
      (c) => c.table === "notes_payload" && c.op === "select",
    );
    expect(payloadReads).toHaveLength(1);
    expect(payloadReads[0].columns).toContain("content_json");
  });
});

describe("list_notes", () => {
  it("drops the preview of a locked note even with include_content", async () => {
    install();

    const { notes } = await listNotes({ include_content: true });

    const locked = notes.find((n) => n.id === LOCKED_NOTE);
    expect(locked).toMatchObject({ locked: true, hasPassword: true });
    expect(locked).not.toHaveProperty("contentPreview");
    expect(JSON.stringify(notes)).not.toContain(SECRET_NOTE_BODY);
    expect(bodyReadsFor("notes_payload", LOCKED_NOTE)).toEqual([]);
  });

  it("matches a locked note by title but never by its body", async () => {
    install();
    const byTitle = await listNotes({ query: "Locked" });
    expect(byTitle.notes.map((n) => n.id)).toContain(LOCKED_NOTE);

    install();
    const byBody = await listNotes({ query: SECRET_NOTE_BODY });
    expect(byBody.notes.map((n) => n.id)).not.toContain(LOCKED_NOTE);
  });
});

describe("search_all", () => {
  it("keeps a locked note's title hit and strips its preview", async () => {
    install();

    const result = await searchAll({ query: "Locked", domains: ["notes"] });

    expect(result.notes?.results).toEqual([
      expect.objectContaining({ id: LOCKED_NOTE, locked: true }),
    ]);
    expect(JSON.stringify(result)).not.toContain(SECRET_NOTE_BODY);
  });

  it("leaves a locked note out of the body match", async () => {
    install();

    const result = await searchAll({
      query: SECRET_NOTE_BODY,
      domains: ["notes"],
    });

    expect(result.notes?.results).toEqual([]);
    expect(result.notes?.total).toBe(0);
  });

  it("leaves a locked daily out entirely — a daily matches on body alone", async () => {
    install();

    const result = await searchAll({
      query: SECRET_DAY_BODY,
      domains: ["dailies"],
    });

    expect(result.dailies?.results).toEqual([]);
    expect(bodyReadsFor("dailies_payload", `daily-${LOCKED_DATE}`)).toEqual([]);
  });
});

describe("get_note_context", () => {
  it("returns the tags and links of a locked note without its body", async () => {
    install();

    const context = await getNoteContext({ id: LOCKED_NOTE });

    expect(context.note).toMatchObject({ id: LOCKED_NOTE, locked: true });
    expect(context.links).toEqual([]);
    expect(context.backlinks).toEqual([]);
    expect(JSON.stringify(context)).not.toContain(SECRET_NOTE_BODY);
  });
});

describe("get_daily", () => {
  it("reports a locked day as existing, locked and bodyless", async () => {
    install();

    const daily = await getDaily({ date: LOCKED_DATE });

    expect(daily).toMatchObject({
      date: LOCKED_DATE,
      exists: true,
      isTrashed: false,
      locked: true,
      hasBriefing: false,
      content: null,
    });
    expect(bodyReadsFor("dailies_payload", `daily-${LOCKED_DATE}`)).toEqual([]);
  });
});

/*
 * get_today_context / get_week_context have their own suites: their todo
 * reads use filters the in-memory layer refuses to fake (`.not(... is null)`),
 * so the locked-day case is pinned there, on their filter-aware stubs.
 */

describe("the write paths", () => {
  it("refuses update_note", async () => {
    install();
    const error = await rejection(
      updateNote({ id: LOCKED_NOTE, title: "renamed" }),
    );
    expect(error.message).toContain("password-protected");
    expect(stub.writes()).toEqual([]);
  });

  it("refuses delete_note", async () => {
    install();
    const error = await rejection(deleteNote({ id: LOCKED_NOTE }));
    expect(error.message).toContain("password-protected");
    expect(stub.writes()).toEqual([]);
  });

  it("refuses format_content, which would hand the document back", async () => {
    install();
    const error = await rejection(
      formatContent({
        target: "note",
        target_id: LOCKED_NOTE,
        operations: [{ action: "add_heading", text: "h" }],
      }),
    );
    expect(error.message).toContain("password-protected");
    expect(bodyReadsFor("notes_payload", LOCKED_NOTE)).toEqual([]);
    expect(stub.writes()).toEqual([]);
  });

  it("refuses generate_content overwriting a locked note", async () => {
    install();
    const error = await rejection(
      generateContent({
        target: "note",
        target_id: LOCKED_NOTE,
        structure: [{ type: "paragraph", text: "overwrite" }],
      }),
    );
    expect(error.message).toContain("password-protected");
    expect(stub.writes()).toEqual([]);
  });

  it("refuses upsert_daily on a locked day", async () => {
    install();
    const error = await rejection(
      upsertDaily({ date: LOCKED_DATE, content: "overwrite" }),
    );
    expect(error.message).toContain("password-protected");
    expect(stub.writes()).toEqual([]);
  });

  it("refuses write_briefing when the focus note carries a password", async () => {
    install();
    const error = await rejection(
      writeBriefing({ date: OPEN_DATE, focus: "一点集中" }),
    );
    expect(error.message).toContain("password-protected");
    expect(bodyReadsFor("notes_payload", FOCUS_NOTE_ID)).toEqual([]);
    expect(stub.writes()).toEqual([]);
  });
});
