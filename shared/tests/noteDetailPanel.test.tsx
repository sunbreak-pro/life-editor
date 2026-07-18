import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteDetailPanel } from "../src/components";

/*
 * Materials mini-plan Step 3 — Notes detail (rightSidebar, Desktop). Pure
 * presentation: title debounce-and-flush commits on blur, the pin toggle
 * reports its state via aria-pressed, delete fires the injected callback,
 * and the tag / content sections render only when their slot is provided
 * (additive slots; the links slot moved to the rightSidebar Links panel —
 * F-3 #260). MasterDetail / rightSidebar plumbing is covered elsewhere and
 * deliberately not re-tested here.
 */

const LABELS = {
  titleLabel: "Note title",
  pinLabel: "Unpin note",
  unpinLabel: "Pin note",
  deleteLabel: "Delete note",
  contentLabel: "Content",
};

describe("NoteDetailPanel", () => {
  it("renders the title, tag slot and content editor", () => {
    render(
      <NoteDetailPanel
        noteId="note-a"
        title="Supabase migration notes"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        tagsSlot={<span>design</span>}
        contentEditor={<div>editor slot</div>}
        {...LABELS}
      />,
    );
    expect(
      (screen.getByLabelText("Note title") as HTMLInputElement).value,
    ).toBe("Supabase migration notes");
    expect(screen.getByText("design")).toBeInTheDocument();
    expect(screen.getByText("editor slot")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("commits a title edit on blur", () => {
    const onTitleCommit = vi.fn();
    render(
      <NoteDetailPanel
        noteId="note-a"
        title="old"
        isPinned={false}
        onTitleCommit={onTitleCommit}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    const input = screen.getByLabelText("Note title");
    fireEvent.change(input, { target: { value: "new" } });
    fireEvent.blur(input);
    expect(onTitleCommit).toHaveBeenCalledWith("note-a", "new");
  });

  it("reflects the pin state via aria-pressed and toggles on click", () => {
    const onTogglePin = vi.fn();
    render(
      <NoteDetailPanel
        noteId="note-a"
        title="pinned note"
        isPinned
        onTitleCommit={() => {}}
        onTogglePin={onTogglePin}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    // When pinned the aria-label is the "Unpin" copy.
    const pin = screen.getByRole("button", { name: "Unpin note" });
    expect(pin).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(pin);
    expect(onTogglePin).toHaveBeenCalledWith("note-a");
  });

  it("fires onDelete with the note id on delete click", () => {
    const onDelete = vi.fn();
    render(
      <NoteDetailPanel
        noteId="note-a"
        title="doomed"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={onDelete}
        {...LABELS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
    expect(onDelete).toHaveBeenCalledWith("note-a");
  });

  it("defaults to the sidebar surface and switches to the main surface via variant", () => {
    const { container, rerender } = render(
      <NoteDetailPanel
        noteId="note-a"
        title="surface"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    // Default (variant omitted) = the compact sidebar card.
    const sidebarRoot = container.firstElementChild as HTMLElement;
    expect(sidebarRoot.className).toContain("bg-lumen-bg-secondary");
    expect(sidebarRoot.className).not.toContain("bg-lumen-surface");

    // variant="main" = the larger opaque editor surface.
    rerender(
      <NoteDetailPanel
        noteId="note-a"
        title="surface"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        variant="main"
        {...LABELS}
      />,
    );
    const mainRoot = container.firstElementChild as HTMLElement;
    expect(mainRoot.className).toContain("bg-lumen-surface");
    expect(mainRoot.className).toContain("shadow-lumen-sm");
    expect(mainRoot.className).not.toContain("bg-lumen-bg-secondary");
  });

  it("omits the tag and content sections when their slots are absent", () => {
    render(
      <NoteDetailPanel
        noteId="note-a"
        title="bare"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    // Title + the two icon buttons still render...
    expect(screen.getByLabelText("Note title")).toBeInTheDocument();
    // ...but the captioned sections do not (their slots were undefined).
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });
});
