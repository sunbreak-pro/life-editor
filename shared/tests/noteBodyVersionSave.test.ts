import { describe, it, expect } from "vitest";
import { SupabaseNotesUnifiedBodySave } from "../src/services/SupabaseNotesUnifiedBodySave";
import { makeStub } from "./helpers/supabaseNotesStub";

/*
 * #2057 D-4 / NOTE-SYNC-4 — the note body is saved against the version it was
 * read at, and a save built on an old body is refused instead of replacing a
 * newer one.
 *
 * The incident: a note open in the app was updated through MCP, and the next
 * autosave wrote the editor's old buffer back over it. The save of record is
 * the `update_note_content` RPC (migration 0032); until that is pushed the
 * service falls back to a conditional UPDATE, and both paths are pinned here.
 */

const DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "mine" }] }],
});
const READ_AT = "2026-10-01T09:09:00.000Z";

describe("saveNoteBodyUnified — RPC (migration 0032 pushed)", () => {
  it("sends the body and the version it was read at, and returns the new version", async () => {
    const stub = makeStub();
    stub.stage("update_note_content", "rpc", {
      data: [
        {
          saved: true,
          updated_at: "2026-10-01T09:12:00+00:00",
          content_json: null,
        },
      ],
      error: null,
    });
    const svc = new SupabaseNotesUnifiedBodySave(stub.client);

    const result = await svc.saveNoteBodyUnified("note-1", DOC, READ_AT);

    expect(result).toEqual({
      status: "saved",
      updatedAt: "2026-10-01T09:12:00+00:00",
    });
    const rpc = stub.calls.find((c) => c.op === "rpc");
    expect(rpc?.args[0]).toEqual({
      p_id: "note-1",
      p_content: JSON.parse(DOC),
      p_expected_updated_at: READ_AT,
    });
  });

  it("is refused when the note moved on, and hands back what is there now", async () => {
    const stub = makeStub();
    const theirs = { type: "doc", content: [{ type: "paragraph" }] };
    stub.stage("update_note_content", "rpc", {
      data: [
        {
          saved: false,
          updated_at: "2026-10-01T09:10:00+00:00",
          content_json: theirs,
        },
      ],
      error: null,
    });
    const svc = new SupabaseNotesUnifiedBodySave(stub.client);

    const result = await svc.saveNoteBodyUnified("note-1", DOC, READ_AT);

    expect(result).toEqual({
      status: "conflict",
      current: {
        content: JSON.stringify(theirs),
        updatedAt: "2026-10-01T09:10:00+00:00",
      },
    });
    // Refused means NOTHING was written.
    expect(stub.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("reports a note that is gone", async () => {
    const stub = makeStub();
    stub.stage("update_note_content", "rpc", { data: [], error: null });
    const svc = new SupabaseNotesUnifiedBodySave(stub.client);

    expect(await svc.saveNoteBodyUnified("note-1", DOC, READ_AT)).toEqual({
      status: "missing",
    });
  });
});

describe("saveNoteBodyUnified — fallback (migration 0032 not pushed yet)", () => {
  const missing = {
    data: null,
    error: { message: "Could not find the function", code: "PGRST202" },
  };

  it("compares with a conditional UPDATE, then writes the body", async () => {
    const stub = makeStub();
    stub.stage("update_note_content", "rpc", missing);
    stub.stage("items_meta", "update", {
      data: [{ updated_at: "2026-10-01T09:12:00.000+00:00" }],
      error: null,
    });
    stub.stage("notes_payload", "update", { data: null, error: null });
    const svc = new SupabaseNotesUnifiedBodySave(stub.client);

    const result = await svc.saveNoteBodyUnified("note-1", DOC, READ_AT);

    expect(result).toEqual({
      status: "saved",
      updatedAt: "2026-10-01T09:12:00.000+00:00",
    });
    // The compare is a filter on the version the body was read at.
    expect(
      stub.calls.some(
        (c) =>
          c.table === "items_meta" &&
          c.op === "eq" &&
          c.args[0] === "updated_at" &&
          c.args[1] === READ_AT,
      ),
    ).toBe(true);
    const bodyWrite = stub.calls.find(
      (c) => c.table === "notes_payload" && c.op === "update",
    );
    expect(bodyWrite?.args[0]).toEqual({ content_json: JSON.parse(DOC) });
  });

  it("does not write the body when the conditional UPDATE matched nothing", async () => {
    const stub = makeStub();
    stub.stage("update_note_content", "rpc", missing);
    stub.stage("items_meta", "update", { data: [], error: null });
    // The refusal reads the version first, then the body.
    stub.stage("items_meta", "select", {
      data: { updated_at: "2026-10-01T09:10:00+00:00" },
      error: null,
    });
    stub.stage("notes_payload", "select", {
      data: { content_json: null },
      error: null,
    });
    const svc = new SupabaseNotesUnifiedBodySave(stub.client);

    const result = await svc.saveNoteBodyUnified("note-1", DOC, READ_AT);

    expect(result).toEqual({
      status: "conflict",
      current: { content: "", updatedAt: "2026-10-01T09:10:00+00:00" },
    });
    expect(
      stub.calls.some((c) => c.table === "notes_payload" && c.op === "update"),
    ).toBe(false);
  });

  it("stops asking for the function after the first 'no such function'", async () => {
    const stub = makeStub();
    stub.stage("update_note_content", "rpc", missing);
    for (let i = 0; i < 2; i++) {
      stub.stage("items_meta", "update", {
        data: [{ updated_at: `2026-10-01T09:1${i}:00+00:00` }],
        error: null,
      });
      stub.stage("notes_payload", "update", { data: null, error: null });
    }
    const svc = new SupabaseNotesUnifiedBodySave(stub.client);

    await svc.saveNoteBodyUnified("note-1", DOC, READ_AT);
    await svc.saveNoteBodyUnified("note-1", DOC, "2026-10-01T09:10:00+00:00");

    expect(stub.calls.filter((c) => c.op === "rpc")).toHaveLength(1);
  });
});

describe("saveNoteBodyUnified — no version held", () => {
  it("answers with the current version instead of writing blind", async () => {
    const stub = makeStub();
    stub.stage("items_meta", "select", {
      data: { updated_at: "2026-10-01T09:10:00+00:00" },
      error: null,
    });
    stub.stage("notes_payload", "select", {
      data: { content_json: null },
      error: null,
    });
    const svc = new SupabaseNotesUnifiedBodySave(stub.client);

    const result = await svc.saveNoteBodyUnified("note-1", DOC, null);

    expect(result.status).toBe("conflict");
    expect(stub.calls.some((c) => c.op === "rpc" || c.op === "update")).toBe(
      false,
    );
  });
});
