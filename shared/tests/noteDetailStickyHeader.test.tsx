import { afterEach, describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import {
  NoteDetailPanel,
  NOTE_STICKY_HEADER_HEIGHT_VAR,
} from "../src/components";

/*
 * #2058 — the note detail's header (title row, tag / link row and the rule
 * under them) stays at the top of the scroller while the body scrolls.
 *
 * jsdom has no layout, so nothing here can watch the header stick. What can
 * be pinned is the structure that makes it stick: one block holding exactly
 * the header rows, `position: sticky` + `top-0` on it, an opaque lumen
 * background, and the body OUTSIDE that block (otherwise the body would stick
 * along with it). The sidebar variant without the opt-in must stay as it was.
 */

const LABELS = {
  titleLabel: "Note title",
  pinLabel: "Unpin note",
  unpinLabel: "Pin note",
  deleteLabel: "Delete note",
  moreActionsLabel: "More actions",
  pinnedLabel: "Pinned",
};

function renderPanel(
  props: Partial<ComponentProps<typeof NoteDetailPanel>> = {},
) {
  return render(
    <NoteDetailPanel
      noteId="note-a"
      title="Long note"
      isPinned={false}
      onTitleCommit={() => {}}
      onTogglePin={() => {}}
      onDelete={() => {}}
      tagsSlot={<span>design</span>}
      linksSlot={<span>links</span>}
      contentEditor={<div>editor slot</div>}
      {...LABELS}
      {...props}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NoteDetailPanel sticky header (#2058)", () => {
  it.each([
    ["main (wide)", "main" as const],
    ["sidebar (narrow)", "sidebar" as const],
  ])("pins the title, tags and links on %s, body outside", (_, variant) => {
    renderPanel({ variant, stickyHeader: true });
    const header = screen.getByTestId("note-detail-header");

    expect(header.className).toContain("sticky");
    expect(header.className).toContain("top-0");
    // Opaque card token — the body slides UNDER it, never shows through (§5).
    expect(header.className).toContain("bg-lumen-bg-secondary");
    expect(header.className).not.toMatch(/bg-\S*\/\d+/);
    // Above the body's own sticky table toolbar (z-10).
    expect(header.className).toContain("z-20");

    within(header).getByLabelText("Note title");
    within(header).getByRole("button", { name: "More actions" });
    within(header).getByText("design");
    within(header).getByText("links");
    // The rule is the header's bottom edge.
    within(header).getByTestId("note-detail-divider");
    // The body scrolls; it must not be part of the sticky block.
    expect(within(header).queryByText("editor slot")).toBeNull();
    screen.getByText("editor slot");
  });

  // #2227 — the title and the tags / links share ONE row inside the sticky
  // block; the formatting bar left the header (it floats over a selection).
  it.each([
    ["main (wide)", "main" as const],
    ["sidebar (narrow)", "sidebar" as const],
  ])("keeps the title and the tags on one row on %s", (_, variant) => {
    renderPanel({ variant, stickyHeader: true });
    const header = screen.getByTestId("note-detail-header");
    const row = within(header).getByTestId("note-detail-title-row");

    within(row).getByLabelText("Note title");
    within(row).getByText("design");
    within(row).getByText("links");
    // Tags wrap inside the row's own box when they no longer fit.
    expect(row.className).toContain("flex-wrap");
    // Header = that row's line + the rule, nothing between them.
    expect(header.children).toHaveLength(2);
    expect(header.lastElementChild).toBe(
      within(header).getByTestId("note-detail-divider"),
    );
    expect(within(header).queryByRole("toolbar")).toBeNull();
  });

  it("leaves the sidebar variant's header un-stuck without the opt-in", () => {
    const { container } = renderPanel();
    const header = screen.getByTestId("note-detail-header");

    expect(header.className).not.toContain("sticky");
    expect(header.className).not.toMatch(/-m[xt]-/);
    // Same gap as the card, so the rows sit where they did before #2058.
    expect(header.className).toContain("gap-3");
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("gap-3");
    expect(root.getAttribute("style")).toBeNull();
  });

  it("keeps the kebab and the title working inside the stuck header", () => {
    const onDelete = vi.fn();
    const onTitleCommit = vi.fn();
    renderPanel({
      variant: "main",
      stickyHeader: true,
      onDelete,
      onTitleCommit,
    });

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete note" }));
    expect(onDelete).toHaveBeenCalledWith("note-a");

    const title = screen.getByLabelText("Note title");
    fireEvent.change(title, { target: { value: "Renamed" } });
    fireEvent.blur(title);
    expect(onTitleCommit).toHaveBeenCalledWith("note-a", "Renamed");
  });

  it("publishes the header height for the body's sticky parts", () => {
    const observed = { fire: () => {} };
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          observed.fire = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    let height = 96;
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      () => height,
    );

    const { container } = renderPanel({ variant: "main", stickyHeader: true });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue(NOTE_STICKY_HEADER_HEIGHT_VAR)).toBe(
      "96px",
    );

    // The tag row wrapping onto a second line grows the header.
    height = 128;
    act(() => observed.fire());
    expect(root.style.getPropertyValue(NOTE_STICKY_HEADER_HEIGHT_VAR)).toBe(
      "128px",
    );
  });
});

/*
 * #2467 — below the breakpoint the tag row is always a line of its own, and
 * the pin and kebab used to be centred on the two-line title box, so they
 * floated between the title and the tags. jsdom cannot measure where they
 * land, so this pins the structure that puts them beside the title: on narrow
 * the title row's box dissolves (`max-md:contents`), which makes the title,
 * pin and kebab items of one wrapping, centred header row, and the tag row
 * goes last on a full-width line. From md up the tags still share the
 * title's line while they fit (#2227), but a narrow Desktop pane wraps them
 * just the same, so there the row aligns to the top and the pin and kebab sit
 * in a box one title line tall: they stay beside the title's first line
 * whether the tags wrap or not. Positions are checked in a real browser.
 */
describe("NoteDetailPanel narrow title row (#2467)", () => {
  function parts() {
    const row = screen.getByTestId("note-detail-header-row");
    const titleRow = within(row).getByTestId("note-detail-title-row");
    const tagRow = within(titleRow).getByTestId("note-detail-tag-row");
    const actions = within(row).getByTestId("note-detail-actions");
    const kebab = within(actions).getByRole("button", {
      name: "More actions",
    });
    return { row, titleRow, tagRow, actions, kebab };
  }

  const classes = (el: Element) => el.className.split(/\s+/);

  it.each([
    ["pinned", true],
    ["not pinned", false],
  ])("puts the pin and kebab on the title's line when %s", (_, isPinned) => {
    renderPanel({ variant: "sidebar", stickyHeader: true, isPinned });
    const { row, titleRow, tagRow, actions, kebab } = parts();

    // The header row wraps and centres each line on narrow.
    expect(classes(row)).toEqual(
      expect.arrayContaining(["flex", "items-center", "max-md:flex-wrap"]),
    );
    // The title row's own box dissolves there, so the title is an item of
    // the header row, on the same line as the pin and kebab.
    expect(classes(titleRow)).toContain("max-md:contents");
    expect(titleRow.contains(screen.getByLabelText("Note title"))).toBe(true);
    // The actions box (pin when shown, then the kebab's wrapper) is a direct
    // item of that row, after the title row, never inside the tag row.
    expect(actions.parentElement).toBe(row);
    expect(kebab.parentElement?.parentElement).toBe(actions);
    expect(row.firstElementChild).toBe(titleRow);
    expect(tagRow.contains(kebab)).toBe(false);
    const pin = screen.queryByRole("img", { name: "Pinned" });
    if (isPinned) {
      expect(pin?.parentElement).toBe(actions);
    } else {
      expect(pin).toBeNull();
    }
    // The tag row goes last, on a full-width line of its own.
    expect(classes(tagRow)).toEqual(
      expect.arrayContaining(["max-md:order-last", "max-md:w-full"]),
    );
    // The kebab keeps its 44px hit box on narrow (#1840).
    expect(classes(kebab)).toEqual(
      expect.arrayContaining(["max-md:min-h-11", "max-md:min-w-11"]),
    );
  });

  it.each([
    ["main", "main" as const, "min-h-[calc(1.5625rem+0.25rem)]"],
    ["sidebar", "sidebar" as const, "min-h-[calc(1.4609375rem+0.25rem)]"],
  ])(
    "keeps the pin and kebab on the title's first line from md up (%s)",
    (_, variant, lineFloor) => {
      renderPanel({ variant, stickyHeader: true, isPinned: true });
      const { row, actions } = parts();

      // From md up the row aligns to the top instead of centring on the
      // title row, which is two lines tall once the tags wrap.
      expect(classes(row)).toContain("md:items-start");
      // The actions box is at least one title line tall and centres the pin
      // and kebab inside it, so they sit beside the title's first line.
      expect(classes(actions)).toEqual(
        expect.arrayContaining(["flex", "items-center", lineFloor]),
      );
    },
  );

  it("leaves the other Desktop classes of the row as they were", () => {
    renderPanel({ variant: "main", stickyHeader: true, isPinned: true });
    const { row, titleRow, tagRow } = parts();
    const wide = (el: Element) =>
      classes(el).filter((c) => !c.startsWith("max-md:"));

    expect(wide(row)).toEqual([
      "flex",
      "items-center",
      "gap-1.5",
      "md:items-start",
    ]);
    expect(wide(titleRow)).toEqual([
      "flex",
      "min-w-0",
      "flex-1",
      "flex-wrap",
      "items-center",
      "gap-x-3",
      "gap-y-1.5",
    ]);
    expect(wide(tagRow)).toEqual([
      "flex",
      "flex-wrap",
      "items-center",
      "gap-1.5",
    ]);
  });
});
