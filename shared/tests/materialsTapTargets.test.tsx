import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteDetailPanel, SidebarListControls } from "../src/components";

/*
 * #1560 — the 44px touch floor on the MATERIALS controls that #1512 still
 * listed after PR #1556 took the shared chrome. This file is the shared half:
 * the note detail's kebab menu. The other three targets (the drawer's note
 * rows, the tag-filter chips, the "+ note" pill) are web-side and live in
 * `web/tests/materialsTapTargets.test.tsx` and `web/tests/notesView.test.tsx`.
 *
 * The audit read `getBoundingClientRect()` at 390px width; jsdom has no layout
 * (CLAUDE.md §7.1), so nothing here can re-measure that. Every assertion pins
 * the CLASS CONTRACT that produces the size instead — the same shape as
 * sharedTapTargets.test.tsx, which explains the reasoning at length.
 *
 * `max-md:` throughout and never a bare floor: ONE panel draws both the
 * Desktop sidebar and the narrow column, so an unconditional min-height would
 * grow the menu under a mouse too.
 */

const LABELS = {
  titleLabel: "Note title",
  pinLabel: "Unpin note",
  unpinLabel: "Pin note",
  deleteLabel: "Delete note",
  moreActionsLabel: "More actions",
  pinnedLabel: "Pinned",
  registerTemplateLabel: "Save as template",
  applyTemplateLabel: "Apply a template",
};

/**
 * The panel with its kebab open. Both template entries are wired, so the menu
 * is at its longest — the two conditional rows are exactly the ones a floor
 * applied by hand can be forgotten on.
 */
function openMenu(): HTMLElement[] {
  render(
    <NoteDetailPanel
      noteId="note-a"
      title="Tap targets"
      isPinned={false}
      onTitleCommit={() => {}}
      onTogglePin={() => {}}
      onDelete={() => {}}
      onRegisterTemplate={() => {}}
      onApplyTemplate={() => {}}
      {...LABELS}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  return screen.getAllByRole("menuitem");
}

describe("#1560 — the note kebab's rows meet the 44px touch floor", () => {
  it("floors every row on narrow, the two conditional ones included", () => {
    const items = openMenu();
    // pin / save-as-template / apply-template / delete.
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item).toHaveClass("max-md:min-h-11");
    }
  });

  it("leaves the DESKTOP menu at its mouse size", () => {
    for (const item of openMenu()) {
      // An unprefixed floor would grow the sidebar's menu as well — the panel
      // is one component serving both widths.
      expect(item).not.toHaveClass("min-h-11");
      // And the padding the Desktop row is measured by is untouched: the floor
      // is a min-height, not a taller row (#830 — `cn` is a plain string join,
      // so a second `py-*` would be settled by Tailwind's emit order).
      expect(item).toHaveClass("py-1.5");
    }
  });
});

/*
 * #1840 — the kebab itself, not its rows. 26px draws at 32 under the icon-only
 * floor in tokens.css, which is a mouse target. The DRAWN box stays as it is
 * and the HIT box grows, so the detail header does not change shape on Desktop.
 */
describe("#1840 — the note detail kebab meets the 44px touch floor", () => {
  function kebab(): HTMLElement {
    render(
      <NoteDetailPanel
        noteId="note-a"
        title="Tap targets"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    return screen.getByRole("button", { name: "More actions" });
  }

  it("floors the trigger on narrow", () => {
    expect(kebab()).toHaveClass("max-md:min-h-11", "max-md:min-w-11");
  });

  it("keeps the drawn box at its mouse size", () => {
    const trigger = kebab();
    expect(trigger).toHaveClass("h-[26px]", "w-[26px]");
    expect(trigger.classList.contains("min-h-11")).toBe(false);
  });
});

/*
 * #1975 — the sort row of the narrow Notes drawer (and the Daily list, which
 * mounts the same component). #1840 floored the rows and the bin; these two
 * were still 36 at 390px wide. Since #2577 the two are one button that opens
 * a chip panel; on narrow the button is a 2.75rem square and the chips keep
 * the same floor.
 */
describe("#1975 — the sidebar sort controls meet the 44px touch floor", () => {
  function controls(): { trigger: HTMLElement; chips: HTMLElement[] } {
    render(
      <SidebarListControls
        modes={[
          { id: "updated", label: "Updated" },
          { id: "created", label: "Created" },
        ]}
        activeModeId="updated"
        onModeChange={() => {}}
        sortLabel="Sort"
        modeGroupLabel="Sort by"
        directionGroupLabel="Order"
        directions={[
          { id: "desc", label: "Newest first" },
          { id: "asc", label: "Oldest first" },
        ]}
        direction="desc"
        onDirectionChange={() => {}}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Sort" });
    fireEvent.click(trigger);
    const panel = screen.getByRole("group", { name: "Sort" });
    return {
      trigger,
      chips: Array.from(panel.querySelectorAll("button")),
    };
  }

  it("draws the button as a 44px square on narrow", () => {
    const { trigger } = controls();
    expect(trigger).toHaveClass(
      "max-md:min-h-11",
      "max-md:h-11",
      "max-md:w-11",
    );
  });

  it("floors every chip on narrow", () => {
    const { chips } = controls();
    expect(chips).toHaveLength(4);
    for (const chip of chips) expect(chip).toHaveClass("max-md:min-h-11");
  });

  it("keeps the Desktop button and chips at their mouse height", () => {
    const { trigger, chips } = controls();
    expect(trigger).toHaveClass("h-8");
    for (const button of [trigger, ...chips]) {
      expect(button.classList.contains("min-h-11")).toBe(false);
    }
  });
});
