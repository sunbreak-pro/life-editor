import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteDetailPanel } from "../src/components";

/*
 * Materials mini-plan Step 3 — Notes detail (rightSidebar, Desktop). Pure
 * presentation: title debounce-and-flush commits on blur, and the pin / delete
 * actions now live behind a single kebab (#284) — opening it exposes the pin
 * toggle (label reflects the pin state) and delete, each firing the injected
 * callback. The tag / links / content sections render only when their slot is
 * provided (additive slots; the links slot came BACK into this header from the
 * rightSidebar in #884, and shares the tag row). The rightSidebar plumbing is
 * covered elsewhere and deliberately not re-tested here.
 */

const LABELS = {
  titleLabel: "Note title",
  pinLabel: "Unpin note",
  unpinLabel: "Pin note",
  deleteLabel: "Delete note",
  moreActionsLabel: "More actions",
  pinnedLabel: "Pinned",
};

// #2337: a host that asked for the focus keeps asking until it hears back, and
// the title would then take the focus when the note is reopened online.
describe("NoteDetailPanel asked to focus a read-only title", () => {
  it("leaves the focus alone and still reports back", () => {
    const onTitleAutoFocused = vi.fn();
    render(
      <NoteDetailPanel
        noteId="note-a"
        title="Held"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        autoFocusTitle
        onTitleAutoFocused={onTitleAutoFocused}
        offlineReason="offline"
        {...LABELS}
      />,
    );
    expect(document.activeElement).not.toBe(
      screen.getByLabelText("Note title"),
    );
    expect(onTitleAutoFocused).toHaveBeenCalledTimes(1);
  });
});

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
  });

  // #2033: one rule separates the tag row from the body at BOTH widths — the
  // mobile sheet used to caption the body "Content" instead, Desktop had none.
  it.each([
    ["sidebar (mobile sheet)", undefined],
    ["main (Desktop)", "main" as const],
  ])(
    "draws one divider between the tag row and the body on %s",
    (_, variant) => {
      render(
        <NoteDetailPanel
          noteId="note-a"
          title="divided"
          isPinned={false}
          onTitleCommit={() => {}}
          onTogglePin={() => {}}
          onDelete={() => {}}
          tagsSlot={<span>design</span>}
          contentEditor={<div>editor slot</div>}
          variant={variant}
          {...LABELS}
        />,
      );
      const dividers = screen.getAllByTestId("note-detail-divider");
      expect(dividers).toHaveLength(1);
      const divider = dividers[0]!;
      expect(divider.tagName).toBe("HR");
      // Order in the document: tag row → rule → body.
      const tag = screen.getByText("design");
      const body = screen.getByText("editor slot");
      expect(
        tag.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        divider.compareDocumentPosition(body) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(divider.className).toContain("border-lumen-border");
      // The old caption is gone at both widths.
      expect(screen.queryByText("Content")).not.toBeInTheDocument();
    },
  );

  it("leaves the rule out when there is no tag row to separate", () => {
    render(
      <NoteDetailPanel
        noteId="note-a"
        title="no tags"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        contentEditor={<div>editor slot</div>}
        {...LABELS}
      />,
    );
    expect(screen.getByText("editor slot")).toBeInTheDocument();
    expect(screen.queryByTestId("note-detail-divider")).not.toBeInTheDocument();
  });

  // #885: pinned state has to read from the header itself, not only from inside
  // the opened kebab menu — and at both widths, which this one panel serves.
  it("marks a pinned note immediately left of the kebab", () => {
    const { rerender } = render(
      <NoteDetailPanel
        noteId="note-a"
        title="pinned"
        isPinned
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    const marker = screen.getByRole("img", { name: "Pinned" });
    const kebab = screen.getByRole("button", { name: "More actions" });
    // The kebab's positioned wrapper is the marker's next sibling.
    expect(marker.nextElementSibling?.contains(kebab)).toBe(true);

    rerender(
      <NoteDetailPanel
        noteId="note-a"
        title="loose"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    expect(
      screen.queryByRole("img", { name: "Pinned" }),
    ).not.toBeInTheDocument();
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

  /*
   * #1760 — an undo of a rename rolled the name back in the DB and in the
   * sidebar while this input kept showing the name that had just been undone.
   * The panel is re-rendered with the restored `title`, so the field has to
   * follow it.
   */
  it("shows the restored name after a rename is undone elsewhere", () => {
    const onTitleCommit = vi.fn();
    const { rerender } = render(
      <NoteDetailPanel
        noteId="note-a"
        title="X"
        isPinned={false}
        onTitleCommit={onTitleCommit}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    const input = screen.getByLabelText("Note title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "X-r2" } });
    fireEvent.blur(input);
    expect(onTitleCommit).toHaveBeenCalledWith("note-a", "X-r2");

    // The rename landed, so the host now feeds the new name back in...
    rerender(
      <NoteDetailPanel
        noteId="note-a"
        title="X-r2"
        isPinned={false}
        onTitleCommit={onTitleCommit}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    // ...and then the header Undo puts the old one back.
    rerender(
      <NoteDetailPanel
        noteId="note-a"
        title="X"
        isPinned={false}
        onTitleCommit={onTitleCommit}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    expect(
      (screen.getByLabelText("Note title") as HTMLInputElement).value,
    ).toBe("X");
  });

  // The other half of #1760: the re-seed must not eat an edit that has not
  // flushed yet, which is why it is guarded on the pending draft rather than
  // done with a `key` on the title.
  it("keeps an unflushed edit when a title prop arrives mid-typing", () => {
    const { rerender } = render(
      <NoteDetailPanel
        noteId="note-a"
        title="old"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    const input = screen.getByLabelText("Note title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "half-typ" } });
    // A sync echo (or any other host re-render with a different title) while
    // the 300ms debounce is still pending.
    rerender(
      <NoteDetailPanel
        noteId="note-a"
        title="something else"
        isPinned={false}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    expect(
      (screen.getByLabelText("Note title") as HTMLInputElement).value,
    ).toBe("half-typ");
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
    // ...but the tag row, the rule and the body do not (their slots were
    // undefined).
    expect(screen.queryByTestId("note-detail-divider")).not.toBeInTheDocument();
  });
});

/*
 * #2584 — the kebab menu as the prototype lists it: pin / unpin, register as
 * a template, apply a template, set / remove the password, a rule, delete.
 * Icons are told apart by lucide's own class name, the only handle an
 * aria-hidden glyph has.
 */
describe("NoteDetailPanel kebab menu (#2584)", () => {
  function openMenu(isPinned: boolean, withPassword = false) {
    render(
      <NoteDetailPanel
        noteId="note-a"
        title="menu note"
        isPinned={isPinned}
        onTitleCommit={() => {}}
        onTogglePin={() => {}}
        onDelete={() => {}}
        onRegisterTemplate={() => {}}
        registerTemplateLabel="Register as template"
        onApplyTemplate={() => {}}
        applyTemplateLabel="Apply a template"
        {...(withPassword
          ? {
              onRemovePassword: () => {},
              removePasswordLabel: "Remove password",
            }
          : { onSetPassword: () => {}, setPasswordLabel: "Set password" })}
        {...LABELS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    return screen.getByRole("menu");
  }

  const iconOf = (item: HTMLElement) =>
    item.querySelector("svg")?.getAttribute("class") ?? "";

  it("lists the rows in order with a rule before delete", () => {
    const menu = openMenu(false);
    const parts = Array.from(
      menu.querySelectorAll('[role="menuitem"], [role="separator"]'),
    ).map((el) =>
      el.getAttribute("role") === "separator" ? "---" : el.textContent,
    );
    expect(parts).toEqual([
      "Pin note",
      "Register as template",
      "Apply a template",
      "Set password",
      "---",
      "Delete note",
    ]);
  });

  it("draws the prototype's icons", () => {
    openMenu(false);
    const item = (name: string) => screen.getByRole("menuitem", { name });
    expect(iconOf(item("Pin note"))).toContain("lucide-pin");
    expect(iconOf(item("Register as template"))).toContain(
      "lucide-layout-template",
    );
    expect(iconOf(item("Apply a template"))).toContain("lucide-file-input");
    expect(iconOf(item("Set password"))).toContain("lucide-lock");
    expect(iconOf(item("Delete note"))).toContain("lucide-trash");
  });

  it("draws PinOff on the unpin row and LockOpen on the remove row", () => {
    openMenu(true, true);
    expect(
      iconOf(screen.getByRole("menuitem", { name: "Unpin note" })),
    ).toContain("lucide-pin-off");
    expect(
      iconOf(screen.getByRole("menuitem", { name: "Remove password" })),
    ).toContain("lucide-lock-open");
  });
});
