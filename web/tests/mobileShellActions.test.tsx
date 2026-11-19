import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UndoRedoProvider } from "@life-editor/shared";
import { MobileShellActions } from "../src/MobileShellActions";

/*
 * The app-global rows of the narrow bottom bar's "More" sheet (#472).
 *
 * AppShell renders its `header` slot on the WIDE branch only, so the header's
 * undo/redo never reaches a phone, and a phone has no keyboard for the ⌘Z
 * route. The sheet is the one piece of chrome every narrow section shares,
 * which is why undo/redo land here.
 *
 * The command palette's row (#473) went with the palette in #2719, and #1290's
 * "Edit tags" row went in #1851 (it landed on the Connect section, which the
 * same sheet already lists).
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

function renderActions() {
  render(
    <UndoRedoProvider>
      <ul>
        <MobileShellActions />
      </ul>
    </UndoRedoProvider>,
  );
}

const disabled = (name: string) =>
  (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;

describe("MobileShellActions (#472)", () => {
  it("lists undo and redo only", () => {
    renderActions();
    const labels = screen
      .getAllByRole("button")
      .map((b) => b.textContent?.trim());
    expect(labels).toEqual(["Undo", "Redo"]);
    expect(screen.queryByRole("button", { name: /command palette/i })).toBe(
      null,
    );
  });

  it("disables undo/redo while the history is empty", () => {
    renderActions();
    expect(disabled("Undo")).toBe(true);
    expect(disabled("Redo")).toBe(true);
  });
});
