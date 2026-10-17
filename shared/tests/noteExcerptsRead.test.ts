// @vitest-environment node (#1079 — no DOM, a stubbed query builder)
import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseNotesUnifiedService } from "../src/services/SupabaseNotesUnifiedService";
import { blocksExcerpt, contentExcerpt } from "../src/utils/contentExcerpt";
import { makeStub } from "./helpers/supabaseNotesStub";

/*
 * #2224 — the note excerpt read. What the Issue asks for is "an excerpt
 * without loading full note bodies", so what is pinned here is the SHAPE of
 * the one query (the head blocks by JSON path, never `content_json` itself,
 * and never a locked note) and that the excerpt rule is the Daily list's.
 */

const para = (text?: string) =>
  text === undefined
    ? { type: "paragraph" }
    : { type: "paragraph", content: [{ type: "text", text }] };

describe("listNoteExcerptsUnified", () => {
  let stub: ReturnType<typeof makeStub>;
  let service: SupabaseNotesUnifiedService;

  beforeEach(() => {
    stub = makeStub();
    service = new SupabaseNotesUnifiedService(
      stub.client as unknown as SupabaseClient,
    );
  });

  it("selects the head blocks by JSON path, never the whole body", async () => {
    stub.stage("notes_payload", "select", { data: [], error: null });
    await service.listNoteExcerptsUnified();

    const select = stub.calls.find(
      (c) => c.table === "notes_payload" && c.op === "select",
    );
    const columns = String(select?.args[0]);
    expect(columns).toContain("b0:content_json->content->0");
    // Every alias reaches into `->content->`; a bare `content_json` column
    // would be the full document.
    expect(
      columns
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.includes("content_json"))
        .every((c) => /content_json->content->\d+$/.test(c)),
    ).toBe(true);
  });

  it("never reads a password-locked note", async () => {
    stub.stage("notes_payload", "select", { data: [], error: null });
    await service.listNoteExcerptsUnified();
    expect(
      stub.calls.some(
        (c) =>
          c.table === "notes_payload" &&
          c.op === "eq" &&
          c.args[0] === "has_password" &&
          c.args[1] === false,
      ),
    ).toBe(true);
  });

  it("returns each note's first line of text, skipping empty heads", async () => {
    stub.stage("notes_payload", "select", {
      data: [
        // Opens with an empty paragraph — the excerpt is the next block.
        { item_id: "note-1", b0: para(), b1: para("Plan the week"), b2: null },
        // Nothing but empty blocks: no excerpt, so no row.
        { item_id: "note-2", b0: para(), b1: null },
        // A legacy plain-string body has no `content` key — every block null.
        { item_id: "note-3", b0: null, b1: null },
      ],
      error: null,
    });
    expect(await service.listNoteExcerptsUnified()).toEqual([
      { id: "note-1", excerpt: "Plan the week" },
    ]);
  });
});

describe("contentExcerpt (shared with the Daily list)", () => {
  it("reads the same first line from a whole doc and from its head", () => {
    const blocks = [para(), para("Plan the week"), para("Later")];
    const doc = JSON.stringify({ type: "doc", content: blocks });
    expect(contentExcerpt(doc)).toBe("Plan the week");
    expect(blocksExcerpt(blocks)).toBe("Plan the week");
  });
});
