// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect, beforeEach } from "vitest";
import { SupabaseNotesUnifiedReads } from "../src/services/SupabaseNotesUnifiedReads";
import {
  makeStub,
  makeMetaRow,
  makePayloadRow,
} from "./helpers/supabaseNotesStub";

/**
 * #1763 / D-20260920-main-1 = A — a password-locked note's body is NEVER
 * fetched.
 *
 * Until this Issue the lock was a blur: `getNoteUnified` selected
 * `content_json` for every note and the app covered the result with a CTA, so
 * the text sat in the DOM of the very screen that claimed to hide it.
 * LockedBodyGate said so in its own header. RLS could not close it — the row
 * belongs to the signed-in owner either way — so the gate moved into the
 * SELECT shape.
 *
 * The assertions below are deliberately about the QUERY, not only about the
 * returned object. "Fetched and dropped" would satisfy a test that only read
 * the NoteNode, and it is exactly the shape this Issue rejects: a body this
 * client holds can still leak through a log line, an error payload or the next
 * refactor of the mapper.
 *
 * The stub does NOT model PostgREST (see helpers/supabaseNotesStub), so a
 * locked row is simulated by staging `null` for the filtered read — which is
 * what Postgres answers when `has_password = false` excludes the only row —
 * and the real row for the bodyless re-read that follows.
 */

const LOCKED_TEXT = "the private text nobody may see";

describe("getNoteUnified: the password gate on the body", () => {
  let stub: ReturnType<typeof makeStub>;
  let reads: SupabaseNotesUnifiedReads;

  beforeEach(() => {
    stub = makeStub();
    reads = new SupabaseNotesUnifiedReads(stub.client);
  });

  /** Stage a meta row + a locked payload: filtered read empty, re-read full. */
  function stageLockedNote(id = "note-1"): void {
    stub.stage("items_meta", "select", {
      data: makeMetaRow({ id }),
      error: null,
    });
    // `.eq("has_password", false)` matched nothing — the note is locked.
    stub.stage("notes_payload", "select", { data: null, error: null });
    // The bodyless re-read: the same row, minus content_json.
    stub.stage("notes_payload", "select", {
      data: makePayloadRow({ item_id: id, has_password: true }),
      error: null,
    });
  }

  it("asks for the body only for a note without a password", async () => {
    stageLockedNote();
    await reads.getNoteUnified("note-1");

    const selects = stub.calls.filter(
      (c) => c.table === "notes_payload" && c.op === "select",
    );
    expect(selects).toHaveLength(2);
    // First attempt: the full column list, fenced by the generated column.
    expect(selects[0]?.args[0]).toContain("content_json");
    expect(stub.calls).toContainEqual({
      table: "notes_payload",
      op: "eq",
      args: ["has_password", false],
    });
    // The re-read that answered: no body in the column list at all.
    expect(selects[1]?.args[0]).not.toContain("content_json");
  });

  it("returns the locked note without its text, flagged as locked", async () => {
    stageLockedNote();
    const note = await reads.getNoteUnified("note-1");

    expect(note?.id).toBe("note-1");
    expect(note?.hasPassword).toBe(true);
    // The "not loaded" sentinel the list reads use — NOT the real body.
    expect(note?.content).toBe("");
    expect(JSON.stringify(note)).not.toContain(LOCKED_TEXT);
  });

  it("still costs one round trip for an ordinary note", async () => {
    stub.stage("items_meta", "select", {
      data: makeMetaRow({ id: "note-1" }),
      error: null,
    });
    stub.stage("notes_payload", "select", {
      data: makePayloadRow({
        item_id: "note-1",
        has_password: false,
        content_json: { type: "doc", content: [] },
      }),
      error: null,
    });

    const note = await reads.getNoteUnified("note-1");
    expect(note?.content).not.toBe("");
    expect(
      stub.calls.filter(
        (c) => c.table === "notes_payload" && c.op === "select",
      ),
    ).toHaveLength(1);
  });

  it("returns null for a note whose payload row is genuinely gone", async () => {
    stub.stage("items_meta", "select", {
      data: makeMetaRow({ id: "note-1" }),
      error: null,
    });
    // Both reads come back empty — that is "no payload", not "locked".
    stub.stage("notes_payload", "select", { data: null, error: null });
    stub.stage("notes_payload", "select", { data: null, error: null });

    await expect(reads.getNoteUnified("note-1")).resolves.toBeNull();
  });
});

describe("getNoteBodyUnified: the unlock read", () => {
  let stub: ReturnType<typeof makeStub>;
  let reads: SupabaseNotesUnifiedReads;

  beforeEach(() => {
    stub = makeStub();
    reads = new SupabaseNotesUnifiedReads(stub.client);
  });

  it("returns the body once the caller has verified the password", async () => {
    stub.stage("notes_payload", "select", {
      data: {
        content_json: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: LOCKED_TEXT }],
            },
          ],
        },
      },
      error: null,
    });

    const body = await reads.getNoteBodyUnified("note-1");
    expect(body).toContain(LOCKED_TEXT);
    // Only the body — no metadata is re-read on this path.
    const select = stub.calls.find(
      (c) => c.table === "notes_payload" && c.op === "select",
    );
    expect(select?.args[0]).toBe("content_json");
  });

  it("renders a note that has never been written as the empty body", async () => {
    stub.stage("notes_payload", "select", {
      data: { content_json: null },
      error: null,
    });
    await expect(reads.getNoteBodyUnified("note-1")).resolves.toBe("");
  });

  it("reports a vanished note as null rather than as an empty body", async () => {
    stub.stage("notes_payload", "select", { data: null, error: null });
    await expect(reads.getNoteBodyUnified("ghost")).resolves.toBeNull();
  });

  it("throws a labelled error when the read fails", async () => {
    stub.stage("notes_payload", "select", {
      data: null,
      error: { message: "boom" },
    });
    await expect(reads.getNoteBodyUnified("note-1")).rejects.toThrow(
      /getNoteBodyUnified failed/,
    );
  });
});
