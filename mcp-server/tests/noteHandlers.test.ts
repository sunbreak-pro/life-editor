import { describe, it, expect } from "vitest";
import { isLegacyFolder } from "../src/handlers/noteHandlers.js";

/*
 * Legacy folder exclusion (#375). `fetchLiveNotes` drops these rows in-app
 * rather than with a PostgREST `.neq`, because a NULL note_type row is a
 * plain note and an inequality filter would drop it too — silently hiding
 * every pre-`note_type` note from list_notes / search_all. This pins the one
 * rule that whole decision rests on.
 */

describe("isLegacyFolder", () => {
  it("flags only the retired 'folder' value", () => {
    expect(isLegacyFolder({ note_type: "folder" })).toBe(true);
  });

  it("treats a NULL note_type as a plain note (legacy rows survive)", () => {
    expect(isLegacyFolder({ note_type: null })).toBe(false);
  });

  it("treats 'note' as a plain note", () => {
    expect(isLegacyFolder({ note_type: "note" })).toBe(false);
  });
});
