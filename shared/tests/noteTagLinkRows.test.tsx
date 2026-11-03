import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import {
  ItemLinkPreviewCard,
  NoteDetailPanel,
  TagPill,
} from "../src/components";

/*
 * #2474 — on a phone the note's tag row and link row squeezed each other on
 * one line: the tag's X slid under the "+" and only one of three link chips
 * showed. The link chip's panel stacked its two buttons with "remove" alone in
 * the corner.
 *
 * jsdom has no layout and no media queries, so what is pinned is the structure
 * and the classes the browser is asked for. Where things land is checked in a
 * real browser at 390px.
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
      title="A note"
      isPinned
      onTitleCommit={() => {}}
      onTogglePin={() => {}}
      onDelete={() => {}}
      tagsSlot={<span data-testid="tags-slot">design</span>}
      linksSlot={<span data-testid="links-slot">links</span>}
      contentEditor={<div>editor slot</div>}
      {...LABELS}
      {...props}
    />,
  );
}

const classesOf = (el: Element): string[] => el.className.split(/\s+/);

describe("Note tag and link rows on narrow (#2474)", () => {
  it("lets the tags and the links wrap onto lines of their own", () => {
    renderPanel();
    const row = screen.getByTestId("note-detail-tag-row");
    const tags = screen.getByTestId("tags-slot");
    const links = screen.getByTestId("links-slot");

    // Two separate items of the row, so each can take a line when both do not fit.
    expect(tags.parentElement).toBe(row);
    expect(links.parentElement).toBe(row);
    expect(classesOf(row)).toContain("flex-wrap");
    expect(classesOf(row)).not.toContain("max-md:flex-nowrap");
    // Still what the link picker and the chip panel hang from (#2391 / #2392).
    expect(classesOf(row)).toContain("max-md:relative");
    expect(classesOf(row)).toContain("max-md:w-full");
  });
});

describe("Tag chip X on narrow (#2474)", () => {
  function removeButton(size: "sm" | "md"): HTMLElement {
    render(
      <TagPill
        name={`Work ${size}`}
        color={null}
        size={size}
        onRemove={() => {}}
        removeLabel={`Remove ${size}`}
        touch="narrow"
      />,
    );
    return screen.getByRole("button", { name: `Remove ${size}` });
  }

  it("ends the sm pill's 44px square inside the pill, not past it", () => {
    const x = removeButton("sm");
    // The sm pill's right padding is px-2, so -mr-2 cancels it exactly.
    expect(classesOf(x)).toContain("max-md:-mr-2");
    expect(classesOf(x)).not.toContain("max-md:-mr-2.5");
    expect(classesOf(x)).toContain("max-md:min-h-11");
    expect(classesOf(x)).toContain("max-md:min-w-11");
  });

  it("keeps the md pill's margin, which already matches its px-2.5", () => {
    const x = removeButton("md");
    expect(classesOf(x)).toContain("max-md:-mr-2.5");
    expect(classesOf(x)).not.toContain("max-md:-mr-2");
  });
});

describe("Link chip panel footer on narrow (#2474)", () => {
  function renderCard(withOpen: boolean) {
    render(
      <ItemLinkPreviewCard
        dialogLabel="Link"
        kindLabel="Event"
        kindIcon={null}
        title="Dentist"
        unlinkLabel="Remove link"
        onUnlink={() => {}}
        openAction={
          withOpen
            ? { label: "Open in Schedule", icon: null, onPress: () => {} }
            : undefined
        }
      />,
    );
  }

  it("grows both buttons and drops the Desktop push to the right", () => {
    renderCard(true);
    const open = screen.getByRole("button", { name: "Open in Schedule" });
    const unlink = screen.getByRole("button", { name: "Remove link" });

    for (const button of [open, unlink]) {
      expect(classesOf(button)).toContain("max-md:grow");
      expect(classesOf(button)).toContain("max-md:justify-center");
      expect(classesOf(button)).toContain("max-md:min-h-11");
    }
    // Desktop keeps "remove" at the right end; narrow does not.
    expect(classesOf(unlink)).toContain("ml-auto");
    expect(classesOf(unlink)).toContain("max-md:ml-0");
    expect(open.parentElement).toBe(unlink.parentElement);
    expect(classesOf(unlink.parentElement as HTMLElement)).toContain(
      "flex-wrap",
    );
  });

  it("does not change the Desktop classes of the footer buttons", () => {
    renderCard(true);
    const unlink = screen.getByRole("button", { name: "Remove link" });
    const wide = classesOf(unlink).filter((c) => !c.startsWith("max-md:"));
    expect(wide).toEqual([
      "inline-flex",
      "items-center",
      "gap-1.5",
      "rounded-lumen-sm",
      "px-2",
      "py-1",
      "text-xs",
      "font-medium",
      "hover:bg-lumen-hover",
      "focus-visible:outline-none",
      "focus-visible:ring-1",
      "focus-visible:ring-lumen-accent",
      "ml-auto",
      "text-lumen-text-secondary",
    ]);
  });
});
