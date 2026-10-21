// @vitest-environment node (this suite touches no DOM)
import { describe, it, expect, beforeEach } from "vitest";
import { SupabaseNotesUnifiedService } from "../src/services/SupabaseNotesUnifiedService";
import {
  makeStub,
  makeMetaRow,
  makePayloadRow,
} from "./helpers/supabaseNotesStub";

/*
 * #2327 — the template library's read asks the server for templates only.
 *
 * `listNoteTemplatesUnified` used to be a meta-first join: it read EVERY live
 * note's meta and payload and threw the non-templates away in the client — a
 * second copy of the whole note list each time the library opened. Only the
 * payload knows `note_type`, so the read now starts there with the filter in
 * the query, and reads the metas for the template ids alone.
 *
 * The stub does not apply filters (helpers/supabaseNotesStub.ts), so the
 * filter shape is asserted on `stub.calls`, and the rows each step returns are
 * staged by hand.
 */

describe("listNoteTemplatesUnified reads templates only (#2327)", () => {
  let stub: ReturnType<typeof makeStub>;
  let service: SupabaseNotesUnifiedService;

  beforeEach(() => {
    stub = makeStub();
    service = new SupabaseNotesUnifiedService(stub.client);
  });

  it("starts with notes_payload, filtered to note_type = template by the server", async () => {
    stub.stage("notes_payload", "select", { data: [], error: null });

    await service.listNoteTemplatesUnified();

    // The first request is the payload read — the meta-first join opened on
    // items_meta, which is the full note list.
    expect(stub.calls[0]).toMatchObject({
      table: "notes_payload",
      op: "select",
    });
    expect(stub.calls).toContainEqual({
      table: "notes_payload",
      op: "eq",
      args: ["note_type", "template"],
    });
  });

  it("returns [] without reading items_meta when there are no templates", async () => {
    stub.stage("notes_payload", "select", { data: [], error: null });

    const out = await service.listNoteTemplatesUnified();

    expect(out).toEqual([]);
    expect(stub.calls.some((c) => c.table === "items_meta")).toBe(false);
  });

  it("reads the metas for the template ids alone and maps them to NoteNodes", async () => {
    stub.stage("notes_payload", "select", {
      data: [
        makePayloadRow({ item_id: "note-tpl-b", note_type: "template" }),
        makePayloadRow({
          item_id: "note-tpl-a",
          note_type: "template",
          is_pinned: true,
        }),
      ],
      error: null,
    });
    stub.stage("items_meta", "select", {
      data: [
        makeMetaRow({ id: "note-tpl-b", title: "Weekly review" }),
        makeMetaRow({ id: "note-tpl-a", title: "Meeting notes" }),
      ],
      error: null,
    });

    const out = await service.listNoteTemplatesUnified();

    const metaCalls = stub.calls.filter((c) => c.table === "items_meta");
    expect(metaCalls).toContainEqual({
      table: "items_meta",
      op: "in",
      args: ["id", ["note-tpl-b", "note-tpl-a"]],
    });
    expect(metaCalls).toContainEqual({
      table: "items_meta",
      op: "eq",
      args: ["role", "note"],
    });
    expect(metaCalls).toContainEqual({
      table: "items_meta",
      op: "eq",
      args: ["is_deleted", false],
    });

    // Meta order (by id), as the meta-first join returned them; typed as
    // templates, with the title from the meta and the flags from the payload.
    expect(out.map((n) => n.id)).toEqual(["note-tpl-a", "note-tpl-b"]);
    expect(out.every((n) => n.type === "template")).toBe(true);
    expect(out[0].title).toBe("Meeting notes");
    expect(out[0].isPinned).toBe(true);
    expect(out[1].title).toBe("Weekly review");
  });

  it("drops a template whose meta did not come back (deleted, or another role)", async () => {
    stub.stage("notes_payload", "select", {
      data: [
        makePayloadRow({ item_id: "note-tpl", note_type: "template" }),
        makePayloadRow({ item_id: "note-gone", note_type: "template" }),
      ],
      error: null,
    });
    // `is_deleted = false` is the server's filter: the trashed one is absent.
    stub.stage("items_meta", "select", {
      data: [makeMetaRow({ id: "note-tpl", title: "Kept" })],
      error: null,
    });

    const out = await service.listNoteTemplatesUnified();

    expect(out.map((n) => n.id)).toEqual(["note-tpl"]);
  });
});
