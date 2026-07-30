import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Link2 } from "lucide-react";
import { createItemLinkNode } from "../src/notes/itemLinkNode";
import { createItemLinkSuggestion } from "../src/notes/itemLinkSuggestion";
import { ItemLinkMenu, type ItemLinkMenuItem } from "../src/notes/ItemLinkMenu";

/*
 * The "[[" menu, from two sides (#471 — mobile notes went fully editable, which
 * put this picker on a touch screen for the first time).
 *
 * 1. WHEN the candidate pool is fetched. #430 made it lazy: nothing is read
 *    until the menu actually opens, because the old version re-read notes +
 *    dailies + tasks on every sync bump — i.e. after every typing pause, for as
 *    long as a note was open. Handing the loader to a second surface (the mobile
 *    sheet) must not quietly undo that, so these drive a real editor and assert
 *    on the loader.
 * 2. HOW a row is chosen. A tap arrives as `mousedown`, not `click` — and it has
 *    to be mousedown rather than pointerdown, or dragging to scroll the list
 *    would insert whatever row the finger started on.
 */

const LABELS = {
  empty: "No matches",
  unresolved: (q: string) => `Insert "${q}"`,
  create: (q: string) => `Create "${q}"`,
  roleNote: "Note",
  roleDaily: "Daily",
  roleTask: "Todo",
};

function makeEditor(loadTargets: ReturnType<typeof vi.fn>) {
  return new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit,
      createItemLinkNode({ getOnNavigate: () => undefined }),
      createItemLinkSuggestion({
        loadTargets,
        labels: LABELS,
        getOnResolvedInserted: () => undefined,
        getCreateNote: () => undefined,
      }),
    ],
    content: "<p></p>",
  });
}

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('"[[" candidate pool stays lazy (#430)', () => {
  it("fetches nothing while the editor is merely open", () => {
    const loadTargets = vi.fn().mockResolvedValue([]);
    editor = makeEditor(loadTargets);
    expect(loadTargets).not.toHaveBeenCalled();
  });

  it("fetches nothing while prose is being typed", async () => {
    const loadTargets = vi.fn().mockResolvedValue([]);
    editor = makeEditor(loadTargets);

    editor.commands.insertContent("a note about the roof repair");
    await Promise.resolve();

    expect(loadTargets).not.toHaveBeenCalled();
  });

  it('fetches when "[[" opens the menu', async () => {
    const loadTargets = vi.fn().mockResolvedValue([]);
    editor = makeEditor(loadTargets);

    editor.commands.insertContent("see [[");

    await vi.waitFor(() => expect(loadTargets).toHaveBeenCalled());
    // First open: a fresh pool (allowStale false) so a note created elsewhere
    // shows up. Every call after the menu is up may serve the cache — typing the
    // query writes to the doc, which bumps the sync version, which would
    // otherwise re-fetch under the user's fingers.
    expect(loadTargets).toHaveBeenCalledWith({ allowStale: false });

    // The session opens one await after items() resolves, and "allowStale" is
    // what that session flips — so wait for the popup, not just the fetch.
    await vi.waitFor(() =>
      expect(document.querySelector("[data-suggestion-menu]")).not.toBeNull(),
    );
    loadTargets.mockClear();
    editor.commands.insertContent("ro");
    await vi.waitFor(() => expect(loadTargets).toHaveBeenCalled());
    expect(loadTargets).toHaveBeenCalledWith({ allowStale: true });
  });

  it("does not re-fetch for a bracket typed as prose", async () => {
    const loadTargets = vi.fn().mockResolvedValue([]);
    editor = makeEditor(loadTargets);

    editor.commands.insertContent("cost [1] was high");
    await Promise.resolve();

    expect(loadTargets).not.toHaveBeenCalled();
  });
});

describe("ItemLinkMenu row selection", () => {
  function row(id: string, title: string): ItemLinkMenuItem {
    return { id, title, kind: "candidate", Icon: Link2, command: vi.fn() };
  }

  it("commits on mousedown — the event a tap produces — without stealing focus", () => {
    const items = [row("note-1", "Roof repair"), row("note-2", "Groceries")];
    const command = vi.fn();
    render(
      <ItemLinkMenu items={items} command={command} emptyLabel="No matches" />,
    );

    const target = screen.getByText("Groceries");
    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);

    expect(command).toHaveBeenCalledExactlyOnceWith(items[1]);
    // preventDefault is what keeps the caret in the document: the insert needs
    // the editor selection the row was opened from.
    expect(event.defaultPrevented).toBe(true);
  });

  it("gives every row a 44px touch target below the breakpoint", () => {
    render(
      <ItemLinkMenu
        items={[row("note-1", "Roof repair")]}
        command={vi.fn()}
        emptyLabel="No matches"
      />,
    );
    const option = screen.getByRole("option");
    expect(option.className).toContain("max-md:min-h-11");
  });

  it("takes the placer's cap so the list scrolls instead of running off-screen", () => {
    render(
      <ItemLinkMenu
        items={[row("note-1", "Roof repair")]}
        command={vi.fn()}
        emptyLabel="No matches"
        maxHeight={174}
      />,
    );
    expect(screen.getByRole("listbox").style.maxHeight).toBe("174px");
  });
});
