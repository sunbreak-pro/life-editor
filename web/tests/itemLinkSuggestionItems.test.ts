import { describe, it, expect, vi } from "vitest";
import {
  buildItems,
  stripLinkClosing,
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

const RANGE = { from: 4, to: 20 };

/**
 * A TipTap editor stubbed down to the chain a command actually calls, so the
 * insert path can be driven without ProseMirror. Records the ranges it was
 * asked to delete — the one thing that decides whether the typed "]]" survives.
 */
function fakeEditor() {
  const deleted: { from: number; to: number }[] = [];
  const chain = {
    focus: () => chain,
    deleteRange: (range: { from: number; to: number }) => {
      deleted.push(range);
      return chain;
    },
    insertContent: () => chain,
    insertContentAt: () => chain,
    run: () => true,
  };
  const editor = {
    chain: () => chain,
    isDestroyed: false,
    state: { selection: { from: 4 } },
  };
  return { editor: editor as never, deleted };
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

/*
 * #1689 — the user closes the link the way it looks: "[[Title]]". The trigger
 * is "[[" with allowSpaces, so those closing brackets are part of the query.
 */
describe("a query the user closed with ]] (#1689)", () => {
  it("takes the closing brackets off, both of them and the half-typed one", () => {
    expect(stripLinkClosing("Roof repair]]")).toBe("Roof repair");
    expect(stripLinkClosing("Roof repair]")).toBe("Roof repair");
    expect(stripLinkClosing("Roof repair")).toBe("Roof repair");
    // Only at the end: a bracket inside a title belongs to the title.
    expect(stripLinkClosing("Roof [draft] repair")).toBe("Roof [draft] repair");
    expect(stripLinkClosing("Roof] repair")).toBe("Roof] repair");
  });

  it("finds the item the closed query names", async () => {
    const items = await buildItems("Roof repair]]", deps(), false);

    expect(items[0]?.kind).toBe("candidate");
    expect(items[0]?.title).toBe("Roof repair");
  });

  it("creates the note under the title without the brackets", async () => {
    const createNote = vi.fn(async () => ({ id: "note-new" }));
    const items = await buildItems(
      "Shopping list]]",
      deps({ getCreateNote: () => createNote }),
      false,
    );

    const create = items.find((i) => i.kind === "create");
    expect(create?.title).toBe("create:Shopping list");

    const editor = fakeEditor();
    create?.command({ editor: editor.editor, range: RANGE });
    await vi.waitFor(() =>
      expect(createNote).toHaveBeenCalledExactlyOnceWith("Shopping list"),
    );
    // The typed text INCLUDING "]]" is inside the suggestion range, so the
    // one deleteRange is what keeps a stray "]" out of the body.
    expect(editor.deleted).toEqual([RANGE]);
  });
});
