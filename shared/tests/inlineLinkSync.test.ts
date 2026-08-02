import { describe, it, expect } from "vitest";
import {
  extractItemLinkTargets,
  findStaleInlineLinks,
} from "../src/utils/inlineLinkSync";
import type { WikiTagConnection } from "../src/types/wikiTagUnified";

/*
 * Inline "[[ ]]" link delete-sync helpers (#372).
 *
 * extractItemLinkTargets: resolved itemLink atoms → distinct target ids;
 * null for anything that is not a TipTap doc (legacy plain text must not
 * read as "all links removed").
 * findStaleInlineLinks: only inline-origin, live, this-item edges whose
 * target left the body — manual edges are never candidates.
 */

const doc = (content: unknown[]): string =>
  JSON.stringify({ type: "doc", content });

const link = (targetId: string | null) => ({
  type: "itemLink",
  attrs: { targetId, label: "x", role: "note" },
});

const para = (...children: unknown[]) => ({
  type: "paragraph",
  content: children,
});

function conn(
  overrides: Partial<WikiTagConnection> & { id: string },
): WikiTagConnection {
  return {
    fromItemId: "note-1",
    toItemId: "note-2",
    origin: "inline",
    updatedAt: "2026-08-01T00:00:00.000Z",
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

describe("extractItemLinkTargets", () => {
  it("collects resolved targets, nested and deduped, skipping unresolved", () => {
    const body = doc([
      para({ type: "text", text: "hello " }, link("note-2")),
      para(link(null)), // unresolved — no edge exists for it
      { type: "blockquote", content: [para(link("task-3"), link("note-2"))] },
    ]);
    expect(extractItemLinkTargets(body)?.sort()).toEqual(["note-2", "task-3"]);
  });

  it("returns [] for a doc without links", () => {
    expect(
      extractItemLinkTargets(doc([para({ type: "text", text: "plain" })])),
    ).toEqual([]);
  });

  it("returns null for legacy plain text and non-doc JSON", () => {
    expect(extractItemLinkTargets("just some prose")).toBeNull();
    expect(extractItemLinkTargets("123")).toBeNull();
    expect(extractItemLinkTargets('{"type":"note"}')).toBeNull();
    expect(extractItemLinkTargets("")).toBeNull();
  });
});

describe("findStaleInlineLinks", () => {
  const connections: WikiTagConnection[] = [
    conn({ id: "keep-present", toItemId: "note-2" }),
    conn({ id: "stale-inline", toItemId: "task-3" }),
    conn({ id: "keep-manual", toItemId: "task-4", origin: "manual" }),
    conn({ id: "keep-deleted", toItemId: "task-5", isDeleted: true }),
    conn({ id: "keep-other-item", fromItemId: "note-9", toItemId: "task-6" }),
  ];

  it("returns only the live inline edges whose target left the body", () => {
    const stale = findStaleInlineLinks(connections, "note-1", ["note-2"]);
    expect(stale.map((l) => l.id)).toEqual(["stale-inline"]);
  });

  it("returns nothing when every inline target is still present", () => {
    expect(
      findStaleInlineLinks(connections, "note-1", ["note-2", "task-3"]),
    ).toEqual([]);
  });

  it("never returns manual edges even when the body has no links at all", () => {
    const stale = findStaleInlineLinks(connections, "note-1", []);
    expect(stale.map((l) => l.id).sort()).toEqual([
      "keep-present",
      "stale-inline",
    ]);
  });
});
