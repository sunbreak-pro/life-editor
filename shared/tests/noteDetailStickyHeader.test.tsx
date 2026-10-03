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

  // #2060 — the formatting bar's place: inside the sticky block, under the
  // tag row and above the rule that ends the header.
  it("places the toolbar slot under the tag row, inside the header", () => {
    renderPanel({
      variant: "main",
      stickyHeader: true,
      toolbarSlot: <div role="toolbar" aria-label="Formatting" />,
    });
    const header = screen.getByTestId("note-detail-header");
    const toolbar = within(header).getByRole("toolbar", {
      name: "Formatting",
    });
    const tag = within(header).getByText("design");
    const divider = within(header).getByTestId("note-detail-divider");
    expect(
      tag.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      toolbar.compareDocumentPosition(divider) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("draws the rule under a toolbar even with no tag row", () => {
    renderPanel({
      tagsSlot: undefined,
      linksSlot: undefined,
      toolbarSlot: <div role="toolbar" aria-label="Formatting" />,
    });
    screen.getByTestId("note-detail-divider");
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
