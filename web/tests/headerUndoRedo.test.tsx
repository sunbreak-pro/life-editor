import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UndoRedoProvider, useUndoRedoContext } from "@life-editor/shared";
import { HeaderUndoRedo } from "../src/HeaderUndoRedo";

/*
 * #1035 — the control the narrow section header now carries on every section.
 *
 * It was already the wide header's control (#304); what is new is that a phone
 * reaches it without going through the bottom bar's "More" sheet. The half
 * worth pinning here is the DoD's "stack が空のときは disabled": the buttons
 * read canUndo()/canRedo() off the single global stack, so an untouched
 * session must show both dead rather than offering an action that no-ops.
 *
 * No jest-dom in web/: `disabled` is read off the element directly.
 */

function Pusher() {
  const { push } = useUndoRedoContext();
  return (
    <button
      type="button"
      onClick={() =>
        push("todoTree", {
          label: "todoTreeChange",
          undo: () => {},
          redo: () => {},
        })
      }
    >
      push
    </button>
  );
}

function renderHeader() {
  render(
    <UndoRedoProvider>
      <HeaderUndoRedo />
      <Pusher />
    </UndoRedoProvider>,
  );
}

const disabled = (name: string) =>
  (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;

describe("HeaderUndoRedo", () => {
  it("renders both directions", () => {
    renderHeader();
    screen.getByRole("button", { name: "Undo" });
    screen.getByRole("button", { name: "Redo" });
  });

  it("disables both while the history is empty", () => {
    renderHeader();
    expect(disabled("Undo")).toBe(true);
    expect(disabled("Redo")).toBe(true);
  });

  it("enables undo once a command lands on the stack", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "push" }));
    expect(disabled("Undo")).toBe(false);
    // Nothing has been reversed yet, so there is still nothing to redo.
    expect(disabled("Redo")).toBe(true);
  });
});
