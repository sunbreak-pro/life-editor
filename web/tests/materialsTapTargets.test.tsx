import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ToastProvider,
  WikiTagsUnifiedProvider,
  type DataService,
} from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { TagPicker } from "../src/wikitag/TagPicker";
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

/*
 * #1840 — the bin on a note row was hidden with `opacity: 0` and revealed on
 * hover. A finger has no hover, and `opacity` hides a button from the eye and
 * from nobody else: at 390px a tap on the row's right edge opened a delete
 * confirm nobody could see coming (measured with elementFromPoint).
 *
 * It is shown rather than removed, because narrow width also turns the row's
 * context menu off (NotesView passes `enabled: isWide`), so this is the only
 * way to delete a note from the list there.
 */
describe("#1840 — the row's delete button is visible where it is tappable", () => {
  function deleteButton(): HTMLElement {
    renderRow();
    return screen.getByRole("button", { name: "Delete: Alpha" });
  }

  it("shows itself on narrow widths and on any pointer that cannot hover", () => {
    const bin = deleteButton();
    expect(bin.classList.contains("max-md:opacity-100")).toBe(true);
    // A desktop browser narrowed to 390px is not a touch device, so the width
    // query is not enough on its own — and a phone held in landscape is wider
    // than the breakpoint, so the pointer query is not either.
    expect(
      bin.classList.contains("[@media(hover:none)]:opacity-100"),
    ).toBe(true);
  });

  it("is a thumb-sized target where it is shown", () => {
    const bin = deleteButton();
    expect(bin.classList.contains("max-md:min-h-11")).toBe(true);
    expect(bin.classList.contains("max-md:min-w-11")).toBe(true);
  });

  it("leaves the DESKTOP row exactly as it was", () => {
    const bin = deleteButton();
    // Still hidden until the row is hovered, and still a mouse-sized glyph.
    expect(bin.classList.contains("opacity-0")).toBe(true);
    expect(bin.classList.contains("group-hover:opacity-100")).toBe(true);
    expect(bin.classList.contains("opacity-100")).toBe(false);
    expect(bin.classList.contains("min-h-11")).toBe(false);
    expect(bin.classList.contains("min-w-11")).toBe(false);
  });
});

/*
 * #1840 — the tag picker's "+". TAP_TARGET is 1.75rem, which is 31.5px at the
 * app's 18px root: the icon floor, not a thumb's.
 *
 * The floor goes on the component rather than behind a prop, so the same
 * control is not two sizes depending on who drew it — which means Schedule's
 * rows grow too. That is the trade, and it is called out in the PR.
 */
const { wrapper: SyncWrapper } = createBumpableSync();

describe("#1840 — the tag picker's + meets the 44px touch floor", () => {
  async function plusButton(): Promise<HTMLElement> {
    const ds = stubDataService({
      listAllWikiTagsUnified: async () => [],
      listAllTagConnections: async () => [],
      listAllTagAssignments: async () => [],
    }) as DataService;
    render(
      <SyncWrapper>
        <ToastProvider>
          <WikiTagsUnifiedProvider dataService={ds}>
            <TagPicker itemId="note-a" />
          </WikiTagsUnifiedProvider>
        </ToastProvider>
      </SyncWrapper>,
    );
    return screen.findByRole("button", { name: "Add tag" });
  }

  it("floors it both ways on narrow", async () => {
    const plus = await plusButton();
    expect(plus.classList.contains("max-md:min-h-11")).toBe(true);
    expect(plus.classList.contains("max-md:min-w-11")).toBe(true);
  });

  it("leaves the shared icon floor where every other icon button reads it", async () => {
    // TAP_TARGET is not touched: it is the floor for every icon-only button in
    // the app, and raising it would grow all of them on Desktop too.
    const plus = await plusButton();
    expect(plus.classList.contains("min-h-lumen-tap-min")).toBe(true);
    expect(plus.classList.contains("min-h-11")).toBe(false);
  });
});
