import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { DndContext } from "@dnd-kit/core";
import type { NoteNode } from "@life-editor/shared";
import { DesktopNoteRow } from "../src/notes/NoteListRows";

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
    inDnd(<DesktopNoteRow node={note({ id: "note-a", ...over })} {...rowProps()} />),
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
            node={note({ id: "note-pinned", title: "Pinned one", isPinned: true })}
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
