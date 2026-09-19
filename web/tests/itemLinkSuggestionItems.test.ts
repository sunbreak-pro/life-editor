import { describe, it, expect, vi } from "vitest";
import {
  buildItems,
  type ItemLinkSuggestionDeps,
  type ItemLinkTarget,
} from "../src/notes/itemLinkSuggestion";

/*
 * #1688 — the "[[" menu no longer offers "insert as an unresolved link".
 *
 * What the menu OFFERS is the decision worth pinning, and reaching it any
 * other way means standing up a ProseMirror editor plus the Suggestion plugin
 * (jsdom cannot drive the typing that opens it — CLAUDE.md §7.1). So this
 * drives `buildItems` directly, which is the function the plugin calls.
 */

const TARGETS: ItemLinkTarget[] = [
  { id: "note-1", label: "Roof repair", role: "note" },
  { id: "task-1", label: "Call the plumber", role: "task" },
];

function deps(
  over: Partial<ItemLinkSuggestionDeps> = {},
): ItemLinkSuggestionDeps {
  return {
    loadTargets: () => TARGETS,
    labels: {
      empty: "empty",
      create: (query) => `create:${query}`,
      roleNote: "Note",
      roleDaily: "Daily",
      roleTodo: "Todo",
    },
    getOnResolvedInserted: () => undefined,
    getCreateNote: () => vi.fn(async () => ({ id: "note-new" })),
    ...over,
  };
}

describe("the [[ menu's rows (#1688)", () => {
  it("offers no unresolved row for a query nothing matches", async () => {
    const items = await buildItems("something new", deps(), false);

    expect(items.map((i) => i.kind)).toEqual(["create"]);
    expect(items.map((i) => i.id)).not.toContain("__unresolved__");
  });

  it("offers the matching items and the create row, in that order", async () => {
    const items = await buildItems("roof", deps(), false);

    expect(items.map((i) => i.kind)).toEqual(["candidate", "create"]);
    expect(items[0]?.title).toBe("Roof repair");
    expect(items[1]?.title).toBe("create:roof");
  });

  it("still offers the create row when the query matches exactly", async () => {
    // The unresolved row used to be suppressed on an exact match; nothing
    // takes its place, so the row count drops rather than shifting.
    const items = await buildItems("Roof repair", deps(), false);

    expect(items.map((i) => i.kind)).toEqual(["candidate", "create"]);
  });

  it("offers nothing but candidates when the host cannot create notes", async () => {
    const items = await buildItems(
      "something new",
      deps({ getCreateNote: () => undefined }),
      false,
    );

    expect(items).toEqual([]);
  });
});
