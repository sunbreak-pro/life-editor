import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { DndContext } from "@dnd-kit/core";
import type { NoteNode } from "@life-editor/shared";
import { DesktopNoteRow } from "../src/notes/NoteListRows";
import {
  NotesSidebarList,
  type NotesSidebarListLabels,
} from "../src/notes/NotesSidebarList";
import type { NoteTagDnd } from "../src/notes/useNoteTagDnd";

/*
 * #1287 — the note row's LEADING glyph slot.
 *
 * It used to hold a document icon drawn identically on every row, which spent
 * width to say nothing, while the pin — the one thing a row can differ by —
 * sat AFTER the title where it moved with the text and was easy to miss. The
 * two swapped places.
 *
 * Two things have to hold together, and only together: the pin has to be in
 * the leading position, AND the slot has to keep its width when there is no
 * pin. Drop the second and the list gains a ragged left edge around exactly
 * the rows the user pinned — worse than what was there before.
 *
 * SVG COUNTING is how "the document icon is gone" is asserted: lucide glyphs
 * are aria-hidden and carry no text, so there is nothing to query them by. An
 * unpinned, password-free row has exactly ONE svg left (the delete bin); a
 * pinned one has two. A returning document icon pushes both numbers up.
 *
 * The rows call useDraggable, which reads the dnd-kit context — same wrapper
 * NotesSidebarList puts around the real list.
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

function rowProps() {
  return {
    dragId: "tag-work::note-a",
    selected: false,
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    deleteLabel: "Delete",
    dragHintLabel: "Drag onto a tag heading",
  };
}

function renderRow(over: Partial<NoteNode>): HTMLElement {
  render(
    inDnd(
      <DesktopNoteRow node={note({ id: "note-a", ...over })} {...rowProps()} />,
    ),
  );
  return screen.getByRole("listitem");
}

describe("DesktopNoteRow — pin in the leading slot (#1287)", () => {
  it("draws the pin first and no document icon", () => {
    const row = renderRow({ isPinned: true });

    const pin = screen.getByLabelText("Pinned");
    expect(row.firstElementChild?.contains(pin)).toBe(true);
    // The pin and the delete bin — nothing else.
    expect(row.querySelectorAll("svg")).toHaveLength(2);
  });

  it("keeps the slot's width on an unpinned row so titles stay aligned", () => {
    // Both rows in ONE render, which is how the list actually draws them: the
    // claim is that they measure the same beside each other, so comparing two
    // separate renders would be answering a slightly different question.
    render(
      inDnd(
        <>
          <DesktopNoteRow
            node={note({
              id: "note-pinned",
              title: "Pinned one",
              isPinned: true,
            })}
            {...rowProps()}
          />
          <DesktopNoteRow
            node={note({ id: "note-plain", title: "Plain one" })}
            {...rowProps()}
          />
        </>,
      ),
    );

    const [pinnedRow, plainRow] = screen.getAllByRole("listitem");
    expect(plainRow.firstElementChild?.tagName).toBe("SPAN");
    expect(plainRow.firstElementChild?.className).toBe(
      pinnedRow.firstElementChild?.className,
    );
    // The pinned row carries the pin and the bin; the plain one only the bin.
    expect(pinnedRow.querySelectorAll("svg")).toHaveLength(2);
    expect(plainRow.querySelectorAll("svg")).toHaveLength(1);
  });
});

/*
 * #2576 — the default list's two groups. A pinned note is drawn under
 * "Pinned" only, and the leading pin slot of #1287 stays on its row.
 */
const LIST_LABELS: NotesSidebarListLabels = {
  searchPlaceholder: "Search",
  sort: "Sort",
  toggleDirection: "Toggle",
  tagFilter: "Filter",
  empty: "No notes",
  searchEmpty: "No match",
  bodySearchFailed: "Body search failed",
  addCta: "Add",
  collapseGroup: "Collapse",
  expandGroup: "Expand",
  deleteNote: "Delete",
  rowActions: "Actions",
  assignTagHint: "Drag onto a tag heading",
  clearTagFilter: "Clear",
  tagFilterSelected: (n) => `Filter ${n}`,
  tagFilterPanel: "Tags",
  otherItems: (n) => `Other items (${n})`,
  closeOtherItems: "Close",
  backToList: "Back",
  createdOffline: "Offline",
  unsentLocked: "Unsent",
  pinnedHeading: "Pinned",
  allHeading: "All",
  updatedToday: (time) => `Updated today ${time}`,
  updatedOn: (date) => `Updated ${date}`,
};

function renderList(defaultNotes: NoteNode[], otherNotes: NoteNode[] = []) {
  render(
    <NotesSidebarList
      labels={LIST_LABELS}
      searchQuery=""
      onSearchChange={vi.fn()}
      sortModes={[]}
      sortMode="updatedAt"
      onSortModeChange={vi.fn()}
      sortDirection="desc"
      onToggleDirection={vi.fn()}
      directionLabel="Newest"
      showTagFilter={false}
      tagFilterOptions={[]}
      tagFilters={[]}
      onToggleTagFilter={vi.fn()}
      onClearTagFilters={vi.fn()}
      listMode="flat"
      defaultNotes={defaultNotes}
      otherNotes={otherNotes}
      othersPresentation="flyout"
      error={null}
      hasNotes
      searchEmpty={false}
      visibleGroups={[]}
      collapsedGroups={new Set()}
      onToggleGroup={vi.fn()}
      selectedNoteId={null}
      onSelectNote={vi.fn()}
      onDeleteNote={vi.fn()}
      onCreateNote={vi.fn()}
      dnd={{} as NoteTagDnd}
    />,
  );
}

describe("NotesSidebarList — Pinned and All groups (#2576)", () => {
  it("draws a pinned note under Pinned only, with its leading pin", () => {
    renderList(
      [
        note({ id: "note-p", title: "Pinned one", isPinned: true }),
        note({ id: "note-x", title: "Plain one" }),
      ],
      [note({ id: "note-y", title: "Past the cap" })],
    );
    const pinned = screen.getByRole("region", { name: "Pinned" });
    const all = screen.getByRole("region", { name: "All" });
    expect(within(pinned).getByText("Pinned one")).toBeTruthy();
    expect(within(all).queryByText("Pinned one")).toBeNull();
    expect(within(all).getByText("Plain one")).toBeTruthy();
    // The pin slot of #1287 is still the row's first child.
    const row = within(pinned).getByRole("listitem");
    expect(
      row.firstElementChild?.contains(within(row).getByLabelText("Pinned")),
    ).toBe(true);
    // Counts take in the rows past the 15th as well.
    expect(within(pinned).getByRole("heading").textContent).toBe("Pinned1");
    expect(within(all).getByRole("heading").textContent).toBe("All2");
  });

  it("draws only All when nothing is pinned", () => {
    renderList([note({ id: "note-x", title: "Plain one" })]);
    expect(screen.queryByRole("region", { name: "Pinned" })).toBeNull();
    expect(screen.getByRole("region", { name: "All" })).toBeTruthy();
  });

  it("writes the updated date as today HH:MM or M/D", () => {
    const now = new Date();
    const earlier = new Date(now.getFullYear(), 0, 2, 8, 0).toISOString();
    renderList([
      note({ id: "note-t", title: "Today", updatedAt: now.toISOString() }),
      note({ id: "note-e", title: "Earlier", updatedAt: earlier }),
    ]);
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    expect(screen.getByText(`Updated today ${hh}:${mm}`)).toBeTruthy();
    // Jan 2 is "today" only on Jan 2 itself; the case is then the other line.
    if (!(now.getMonth() === 0 && now.getDate() === 2)) {
      expect(screen.getByText("Updated 1/2")).toBeTruthy();
    }
  });
});
