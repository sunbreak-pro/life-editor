// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { WikiTagConnection } from "../src/types/wikiTagUnified";
import { backlinkSourceIds, resolveLinkId } from "../src/utils/itemLinks";

/*
 * Moved out of tests/connectGraphModel.test.ts with the helpers themselves
 * when the Connect section retired (#1152). The graph-model cases went with
 * the graph; these two derivations over `wiki_tag_connections` did not, so
 * their cases came here verbatim.
 *
 * Both are pure and direction-sensitive, and both must ignore soft-deleted
 * rows — a link the user removed is still a row in the table, so a helper that
 * forgets `isDeleted` shows deleted links as live ones.
 */
function connection(
  fromItemId: string,
  toItemId: string,
  isDeleted = false,
): WikiTagConnection {
  return {
    id: `lnk-${fromItemId}-${toItemId}`,
    fromItemId,
    toItemId,
    origin: "manual",
    updatedAt: "2026-01-01",
    isDeleted,
    deletedAt: null,
  };
}

describe("backlinkSourceIds", () => {
  it("returns distinct sources that link to the target", () => {
    const ids = backlinkSourceIds("note-3", [
      connection("note-1", "note-3"),
      connection("note-2", "note-3"),
      connection("note-1", "note-3"), // dup
      connection("note-1", "note-9"), // other target
      connection("note-4", "note-3", true), // deleted
    ]);
    expect(ids.sort()).toEqual(["note-1", "note-2"]);
  });
});

describe("resolveLinkId", () => {
  const conns = [
    connection("note-1", "note-2"),
    connection("note-2", "note-3"),
    connection("note-4", "note-5", true), // soft-deleted
  ];

  it("returns the id of the matching active directed link", () => {
    expect(resolveLinkId("note-1", "note-2", conns)).toBe("lnk-note-1-note-2");
  });

  it("returns null for the reversed direction", () => {
    expect(resolveLinkId("note-2", "note-1", conns)).toBeNull();
  });

  it("returns null for a soft-deleted link", () => {
    expect(resolveLinkId("note-4", "note-5", conns)).toBeNull();
  });

  it("returns null when no link matches", () => {
    expect(resolveLinkId("note-1", "note-9", conns)).toBeNull();
  });
});
