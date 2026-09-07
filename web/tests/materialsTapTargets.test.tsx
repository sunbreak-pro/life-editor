import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { DndContext } from "@dnd-kit/core";
import type { NoteNode } from "@life-editor/shared";
import { DesktopNoteRow } from "../src/notes/NoteListRows";
import { NoteTagFilterChips } from "../src/notes/NoteTagFilterChips";

/*
 * #1560 — the 44px touch floor on the MATERIALS controls that #1512 still
 * listed after PR #1556 took the shared chrome. This file holds the two the
 * Notes drawer draws itself: the note rows and the tag-filter chips. The kebab
 * menu is shared-side (`shared/tests/materialsTapTargets.test.tsx`) and the
 * "+ note" pill is asserted where its host can be rendered
 * (`web/tests/notesView.test.tsx`).
 *
 * The audit read `getBoundingClientRect()` at 390px width; jsdom has no layout
 * (CLAUDE.md §7.1), so nothing here can re-measure that. Every assertion pins
 * the CLASS CONTRACT that produces the size — the same shape as
 * shared/tests/sharedTapTargets.test.tsx, which explains it at length.
 *
 * `max-md:` and never a bare floor: both components draw the Desktop sidebar
 * as well, so an unconditional min-height would grow the mouse layout too.
 *
 * No jest-dom in web/ (see notesView.test.tsx), so class membership is read
 * off `classList` rather than through `toHaveClass`.
 */

const inDnd = (ui: ReactNode) => <DndContext>{ui}</DndContext>;

function note(over: Partial<NoteNode> & { id: string }): NoteNode {
  return {
    type: "note",
    title: "Alpha",
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  } as NoteNode;
}

function renderRow(): { row: HTMLElement; title: HTMLElement } {
  render(
    inDnd(
      <DesktopNoteRow
        node={note({ id: "note-a" })}
        dragId="tag-work::note-a"
        selected={false}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        deleteLabel="Delete"
        dragHintLabel="Drag onto a tag heading"
      />,
    ),
  );
  return {
    row: screen.getByRole("listitem"),
    title: screen.getByRole("button", { name: "Alpha" }),
  };
}

describe("#1560 — the note row meets the 44px touch floor", () => {
  it("floors the row on narrow and stretches the button that is the target", () => {
    const { row, title } = renderRow();
    expect(row.classList.contains("max-md:min-h-11")).toBe(true);
    // The row alone is not enough: the audit measured 22.5 on the INNER title
    // button, and a 44px row wrapped around a 22.5px button is still a 22.5px
    // tap target. `self-stretch` fills the floored row.
    expect(title.classList.contains("max-md:self-stretch")).toBe(true);
  });

  it("leaves the DESKTOP row at its 36px size", () => {
    const { row, title } = renderRow();
    expect(row.classList.contains("h-[36px]")).toBe(true);
    // Unprefixed floors would grow the Desktop side list, which is the same
    // component. `min-h-*` rather than a second `h-*` so the two never race
    // through `cn`'s plain string join (#830).
    expect(row.classList.contains("min-h-11")).toBe(false);
    expect(title.classList.contains("self-stretch")).toBe(false);
  });
});

const CHIP_LABELS = {
  group: "Tags",
  clear: "Clear",
  more: (count: number) => `more:${count}`,
  less: "less",
};

function renderChips(value: string[] = []) {
  render(
    <NoteTagFilterChips
      chips={[
        { id: "t-a", label: "tag-a", count: 1 },
        { id: "t-b", label: "tag-b", count: 2 },
      ]}
      value={value}
      onToggle={vi.fn()}
      onClear={vi.fn()}
      labels={CHIP_LABELS}
    />,
  );
}

/** The chips themselves — the clear button carries no aria-pressed. */
const chipButtons = () =>
  screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));

describe("#1560 — the tag filter chips meet the 44px touch floor", () => {
  it("floors every chip on narrow", () => {
    renderChips();
    const chips = chipButtons();
    expect(chips).toHaveLength(2);
    for (const chip of chips) {
      expect(chip.classList.contains("max-md:min-h-11")).toBe(true);
    }
  });

  it("also floors the clear button ACROSS — it is an 11px glyph with no label", () => {
    renderChips(["t-a"]);
    const clear = screen.getByRole("button", { name: "Clear" });
    expect(clear.classList.contains("max-md:min-h-11")).toBe(true);
    expect(clear.classList.contains("max-md:min-w-11")).toBe(true);
  });

  it("leaves the DESKTOP chips at their mouse size", () => {
    renderChips(["t-a"]);
    for (const chip of [...chipButtons(), screen.getByRole("button", { name: "Clear" })]) {
      expect(chip.classList.contains("min-h-11")).toBe(false);
      // The padding the Desktop chip is measured by is untouched: the floor is
      // a min-height, not a taller pill.
      expect(chip.classList.contains("py-0.5")).toBe(true);
    }
  });
});
