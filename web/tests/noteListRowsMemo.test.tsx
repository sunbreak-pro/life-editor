import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { DndContext } from "@dnd-kit/core";
import type { NoteNode, NoteTagGroup } from "@life-editor/shared";
import { DesktopNoteRow, DesktopTagHeading } from "../src/notes/NoteListRows";

/*
 * #992 — the guard for the two React.memo boundaries in NoteListRows.
 *
 * Why this file exists, when the components under it have no behaviour of
 * their own beyond rendering the props they are handed:
 *
 *   1. These are the FIRST `memo(` boundaries in the repo — there were zero
 *      across shared/, web/ and desktop/ before the #992 re-render subset. A
 *      memo is a standing promise that every prop is compared correctly, and
 *      the moment one of them becomes an object that is MUTATED IN PLACE
 *      instead of replaced, the row silently stops updating. Nothing else in
 *      the toolchain notices: an over-eager memo is not a type error and not a
 *      lint error, and the immutability the two object props (`node`, `group`)
 *      rely on is a convention upheld in four separate files — buildTagGroups,
 *      noteSort, useNoteListState and the notes CRUD hook — none of which
 *      mention that a memo now depends on them.
 *
 *   2. Measured, not assumed. Replacing both boundaries with
 *      `memo(Component, () => true)` — "never re-render" — left ALL 648
 *      existing web tests green. notesView.test.tsx drives these very rows and
 *      still passed, because it asserts what a CLICK reaches, never what a
 *      re-render paints. The whole optimisation could break without turning a
 *      single test red.
 *
 * That mutation is this file's own acceptance test: apply it and all four
 * cases below must go red. If a future edit lets one of them survive it, that
 * case has stopped guarding anything and should be repaired, not deleted.
 *
 * The rows are rendered directly rather than through NotesView so that a
 * failure names the boundary instead of the screen. `selected` is asserted
 * through the `lumen-*` border token because selection carries no text and no
 * ARIA signal — it is purely a tint (see the <li> className in NoteListRows).
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* / querySelector being null.
 */

// The rows call useDraggable / useDroppable, which read the dnd-kit context.
// Same wrapper NotesSidebarList puts around the real list.
const inDnd = (ui: ReactNode) => <DndContext>{ui}</DndContext>;

function note(over: Partial<NoteNode> & { id: string }): NoteNode {
  return {
    type: "note",
    title: "Untitled",
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

function group(over: Partial<NoteTagGroup> = {}): NoteTagGroup {
  return {
    tagId: "tag-work",
    tagName: "Work",
    tagColor: null,
    tagIcon: null,
    notes: [note({ id: "note-a" })],
    ...over,
  };
}

/** Everything a row needs except the two props each case varies. */
function rowProps() {
  return {
    dragId: "tag-work::note-a",
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    deleteLabel: "Delete",
    dragHintLabel: "Drag onto a tag heading",
  };
}

describe("DesktopNoteRow — memo must not swallow a prop change", () => {
  it("shows the new title when the note object is replaced", () => {
    const props = rowProps();
    const { rerender } = render(
      inDnd(
        <DesktopNoteRow
          node={note({ id: "note-a", title: "before" })}
          selected={false}
          {...props}
        />,
      ),
    );
    expect(screen.getByText("before")).toBeTruthy();

    // A title edit arrives as a NEW node object: the CRUD hook replaces the
    // edited row ({ ...n, title }) rather than writing through it, and both
    // buildTagGroups and sortNotesForList only ever re-bucket / re-order the
    // objects they are given. That replacement is what memo has to notice.
    rerender(
      inDnd(
        <DesktopNoteRow
          node={note({ id: "note-a", title: "after" })}
          selected={false}
          {...props}
        />,
      ),
    );
    expect(screen.queryByText("before")).toBeNull();
    expect(screen.getByText("after")).toBeTruthy();
  });

  it("repaints when `selected` flips and nothing else moves", () => {
    const props = rowProps();
    // Deliberately the SAME node object in both renders, so `selected` is the
    // only prop that changes.
    const target = note({ id: "note-a", title: "Alpha" });
    const { rerender, container } = render(
      inDnd(<DesktopNoteRow node={target} selected={false} {...props} />),
    );
    expect(container.querySelector(".border-lumen-accent")).toBeNull();

    rerender(inDnd(<DesktopNoteRow node={target} selected {...props} />));
    expect(container.querySelector(".border-lumen-accent")).toBeTruthy();
  });

  it("calls the CURRENT onSelect, not the one from the first render", () => {
    // The counterpart to NotesView's narrowed useCallback deps: the host is
    // allowed to hand down a new handler, and a row that kept the old one
    // would act on stale state without failing anything else.
    const stale = vi.fn();
    const fresh = vi.fn();
    const rest = {
      node: note({ id: "note-a", title: "Alpha" }),
      selected: false,
      dragId: "tag-work::note-a",
      onDelete: vi.fn(),
      deleteLabel: "Delete",
      dragHintLabel: "Drag onto a tag heading",
    };
    const { rerender } = render(
      inDnd(<DesktopNoteRow onSelect={stale} {...rest} />),
    );
    rerender(inDnd(<DesktopNoteRow onSelect={fresh} {...rest} />));

    fireEvent.click(screen.getByText("Alpha"));
    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledExactlyOnceWith("note-a");
  });
});

describe("DesktopTagHeading — memo must not swallow a prop change", () => {
  it("updates its count and its collapsed affordance", () => {
    const props = {
      onToggle: vi.fn(),
      collapseLabel: "Collapse Work",
      expandLabel: "Expand Work",
    };
    const { rerender } = render(
      inDnd(
        <DesktopTagHeading
          group={group({ notes: [note({ id: "note-a" })] })}
          collapsed={false}
          {...props}
        />,
      ),
    );
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse Work" })).toBeTruthy();

    // useNoteListState rebuilds every group ({ ...group, notes }) whenever the
    // frozen sort key moves, so a membership change always arrives as a new
    // group object — never as an edit to the one already on screen.
    rerender(
      inDnd(
        <DesktopTagHeading
          group={group({
            notes: [
              note({ id: "note-a" }),
              note({ id: "note-b" }),
              note({ id: "note-c" }),
            ],
          })}
          collapsed
          {...props}
        />,
      ),
    );
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Expand Work" })).toBeTruthy();
  });
});
