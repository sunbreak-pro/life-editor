import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagQuickEditPopover } from "../src/components/TagHub/TagQuickEditPopover";

/*
 * #2673 — the quick-edit panel's swatches on a phone. The buttons are the
 * icon-only floor and touch, so the colour is a 24px dot inside: painted on the
 * button, the discs would meet and the selected one's ring would run over its
 * neighbours. jsdom has no layout, so the classes are what is pinned.
 */

const TAGS = [
  { id: "t-work", name: "Work", color: "#aa0000", icon: null },
  { id: "t-home", name: "Home", color: "#00aa00", icon: null },
];

function renderPanel() {
  render(
    <TagQuickEditPopover
      tag={TAGS[0]}
      tags={TAGS}
      writers={{ setTagName: vi.fn(), setTagIcon: vi.fn(), setTagColor: vi.fn() }}
      position={{ x: 0, y: 0 }}
      anchor={null}
      label="Edit tag"
      labels={{
        nameLabel: "Name",
        iconLabel: "Icon",
        colorLabel: "Color",
        iconMore: "Show more",
        iconCount: "{count} icons",
        iconClose: "Close",
        iconClear: "No icon",
        iconSearch: "Search icons",
        iconNoMatch: "No match",
        colorDefault: "Default",
        deleteTag: "Delete",
        save: "Save",
        duplicateName: "Taken",
        saveFailed: "Failed",
        saving: "Saving",
        cancel: "Cancel",
        openInTags: "Open in tags",
      }}
      onClose={vi.fn()}
    />,
  );
}

describe("TagQuickEditPopover — swatches on a phone (#2673)", () => {
  it("gives every swatch the icon-only floor, touching its neighbour", () => {
    renderPanel();
    for (const { color } of TAGS) {
      expect(screen.getByRole("button", { name: color })).toHaveClass(
        "h-6",
        "w-6",
        "max-md:size-lumen-tap-touch",
      );
    }
    expect(screen.getByRole("group", { name: "Color" })).toHaveClass(
      "gap-2",
      "max-md:gap-0",
    );
  });

  it("paints the colour and the selected ring on the dot", () => {
    renderPanel();
    const picked = screen.getByRole("button", { name: TAGS[0].color });
    const dot = picked.querySelector<HTMLElement>("[data-swatch-dot]");
    expect(dot?.style.backgroundColor).not.toBe("");
    expect(dot).toHaveClass("h-6", "w-6", "ring-2");
    expect(picked.style.backgroundColor).toBe("");
    expect(picked).not.toHaveClass("ring-2");
    const other = screen
      .getByRole("button", { name: TAGS[1].color })
      .querySelector("[data-swatch-dot]");
    expect(other).not.toHaveClass("ring-2");
  });
});
