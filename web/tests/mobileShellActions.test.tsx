import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UndoRedoProvider } from "@life-editor/shared";
import { MobileShellActions } from "../src/MobileShellActions";

/*
 * #473 — the command palette's mobile touch route, and #1290 — the tag
 * editor's.
 *
 * AppShell renders its `header` slot on the WIDE branch only, so the header's
 * CommandSearchField never reaches a phone, and the ⌘K route needs the
 * ShortcutConfig Provider that native mobile deliberately skips. The bottom
 * bar's "More" sheet is the one piece of chrome every narrow section shares,
 * which is why the row lands here beside undo/redo (#472). The tag master has
 * the same problem one layer over: its wide entry is the sidebar footer row,
 * and the narrow layout has no sidebar (#1290).
 *
 * The ordering assertion is the point of the first test: the rows that open a
 * surface (palette, tags) read first — undo/redo act on what you just did.
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

function renderActions() {
  const onOpenPalette = vi.fn();
  const onOpenTagEditor = vi.fn();
  const closeSheet = vi.fn();
  render(
    <UndoRedoProvider>
      <ul>
        <MobileShellActions
          onOpenPalette={onOpenPalette}
          onOpenTagEditor={onOpenTagEditor}
          closeSheet={closeSheet}
        />
      </ul>
    </UndoRedoProvider>,
  );
  return { onOpenPalette, onOpenTagEditor, closeSheet };
}

const disabled = (name: string) =>
  (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;

describe("MobileShellActions — command palette row (#473)", () => {
  it("lists the surface-opening rows above undo/redo", () => {
    renderActions();
    const labels = screen
      .getAllByRole("button")
      .map((b) => b.textContent?.trim());
    expect(labels).toEqual(["Command palette", "Edit tags", "Undo", "Redo"]);
  });

  it("opens the palette and gets the sheet out of the way", () => {
    const { onOpenPalette, onOpenTagEditor, closeSheet } = renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Command palette" }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
    // Without this the palette would open BEHIND the sheet it was tapped from.
    expect(closeSheet).toHaveBeenCalledTimes(1);
    // One row, one surface.
    expect(onOpenTagEditor).not.toHaveBeenCalled();
  });

  it("stays enabled even with an empty history, unlike undo/redo", () => {
    renderActions();
    // Fresh provider: nothing to undo, but the palette is always available.
    expect(disabled("Command palette")).toBe(false);
    expect(disabled("Undo")).toBe(true);
  });
});

describe("MobileShellActions — tag editor row (#1290)", () => {
  it("opens the tag editor and gets the sheet out of the way", () => {
    const { onOpenPalette, onOpenTagEditor, closeSheet } = renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Edit tags" }));
    expect(onOpenTagEditor).toHaveBeenCalledTimes(1);
    // Same reason as the palette: the panel is a surface of its own and must
    // not come up behind the sheet it was tapped from.
    expect(closeSheet).toHaveBeenCalledTimes(1);
    expect(onOpenPalette).not.toHaveBeenCalled();
  });

  it("is always available — it does not depend on the undo history", () => {
    renderActions();
    expect(disabled("Edit tags")).toBe(false);
    expect(disabled("Redo")).toBe(true);
  });
});
