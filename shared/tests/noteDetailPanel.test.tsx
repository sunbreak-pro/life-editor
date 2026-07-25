import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteDetailPanel } from "../src/components";

/*
 * Materials mini-plan Step 3 — Notes detail (rightSidebar, Desktop). Pure
 * presentation: title debounce-and-flush commits on blur, and the pin / delete
 * actions now live behind a single kebab (#284) — opening it exposes the pin
 * toggle (label reflects the pin state) and delete, each firing the injected
 * callback. The tag / content sections render only when their slot is provided
 * (additive slots; the links slot moved to the rightSidebar Links panel —
 * F-3 #260). MasterDetail / rightSidebar plumbing is covered elsewhere and
 * deliberately not re-tested here.
 */

const LABELS = {
  titleLabel: "Note title",
  pinLabel: "Unpin note",
  unpinLabel: "Pin note",
  deleteLabel: "Delete note",
  moreActionsLabel: "More actions",
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

  it("hides the actions until the kebab is opened, then toggles pin", () => {
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
    // Actions are collapsed behind the kebab — not in the DOM until opened.
    expect(
      screen.queryByRole("menuitem", { name: "Unpin note" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    // When pinned the pin item shows the "Unpin" copy.
    fireEvent.click(screen.getByRole("menuitem", { name: "Unpin note" }));
    expect(onTogglePin).toHaveBeenCalledWith("note-a");
  });

  it("shows the 'Pin' copy in the menu when the note is not pinned", () => {
    render(
      <NoteDetailPanel
        noteId="note-a"
        title="loose note"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.getByRole("menuitem", { name: "Pin note" }),
    ).toBeInTheDocument();
  });

  it("fires onDelete with the note id from the actions menu", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete note" }));
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

    // variant="main" = the larger opaque editor surface. Both variants now use
    // the opaque bg-lumen-bg-secondary (the old bg-lumen-surface token is
    // undefined and fell transparent, §5 — 2026-07-19 fix); main is instead
    // distinguished by its lg radius, roomier padding, and the drop shadow.
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
    expect(mainRoot.className).toContain("bg-lumen-bg-secondary");
    expect(mainRoot.className).toContain("shadow-lumen-sm");
    expect(mainRoot.className).toContain("rounded-lumen-lg");
    // Never the undefined token that silently falls transparent (§5).
    expect(mainRoot.className).not.toContain("bg-lumen-surface");
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
    // Title + the kebab trigger still render...
    expect(screen.getByLabelText("Note title")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More actions" }),
    ).toBeInTheDocument();
    // ...but the captioned sections do not (their slots were undefined).
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });
});
