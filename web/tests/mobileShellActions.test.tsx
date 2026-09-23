import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UndoRedoProvider } from "@life-editor/shared";
import { MobileShellActions } from "../src/MobileShellActions";

/*
 * #473 — the command palette's mobile touch route. (#1290's "Edit tags" row
 * went in #1851: it landed on the Connect section, which the same sheet
 * already lists.)
 *
 * AppShell renders its `header` slot on the WIDE branch only, so the header's
 * CommandSearchField never reaches a phone, and the ⌘K route needs the
 * ShortcutConfig Provider that native mobile deliberately skips. The bottom
 * bar's "More" sheet is the one piece of chrome every narrow section shares,
 * which is why the row lands here beside undo/redo (#472).
 *
 * The ordering assertion is the point of the first test: the row that opens a
 * surface (the palette) reads first — undo/redo act on what you just did.
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

function renderActions() {
  const onOpenPalette = vi.fn();
  const closeSheet = vi.fn();
  render(
    <UndoRedoProvider>
      <ul>
        <MobileShellActions
          onOpenPalette={onOpenPalette}
          closeSheet={closeSheet}
        />
      </ul>
    </UndoRedoProvider>,
  );
  return { onOpenPalette, closeSheet };
}

const disabled = (name: string) =>
  (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;

describe("MobileShellActions — command palette row (#473)", () => {
  it("lists the surface-opening rows above undo/redo", () => {
    renderActions();
    const labels = screen
      .getAllByRole("button")
      .map((b) => b.textContent?.trim());
    // No "Edit tags" (#1851): it duplicated the sheet's own Connect entry.
    expect(labels).toEqual(["Command palette", "Undo", "Redo"]);
  });

  it("opens the palette and gets the sheet out of the way", () => {
    const { onOpenPalette, closeSheet } = renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Command palette" }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
    // Without this the palette would open BEHIND the sheet it was tapped from.
    expect(closeSheet).toHaveBeenCalledTimes(1);
  });

  it("stays enabled even with an empty history, unlike undo/redo", () => {
    renderActions();
    // Fresh provider: nothing to undo, but the palette is always available.
    expect(disabled("Command palette")).toBe(false);
    expect(disabled("Undo")).toBe(true);
  });
});
