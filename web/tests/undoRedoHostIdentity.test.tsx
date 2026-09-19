import { describe, it, expect } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useUndoRedoContext } from "@life-editor/shared";
import { UndoRedoHost } from "../src/UndoRedoHost";

/*
 * #1727 — the host is what tells the history whose it is.
 *
 * The stack used to be emptied by navigation, which is the wrong event: a
 * section switch leaves the rows exactly where they were. The event that does
 * invalidate a command is the rows changing owner, and the only part of the
 * app that knows about that is the host holding the session.
 */

function Probe() {
  const { push, canUndo } = useUndoRedoContext();
  return (
    <>
      <span data-testid="can-undo">{String(canUndo())}</span>
      <button
        onClick={() =>
          push("notes", { label: "updateNote", undo: () => {}, redo: () => {} })
        }
      >
        push
      </button>
    </>
  );
}

function view(userId: string) {
  return (
    <ToastProvider>
      <UndoRedoHost userId={userId}>
        <Probe />
      </UndoRedoHost>
    </ToastProvider>
  );
}

describe("UndoRedoHost identity (#1727)", () => {
  it("drops the history when the signed-in account changes", async () => {
    const { rerender } = render(view("user-a"));
    await act(async () => fireEvent.click(screen.getByText("push")));
    expect(screen.getByTestId("can-undo").textContent).toBe("true");

    rerender(view("user-b"));
    await act(async () => {});
    expect(screen.getByTestId("can-undo").textContent).toBe("false");
  });

  it("keeps it across re-renders for the same account", async () => {
    const { rerender } = render(view("user-a"));
    await act(async () => fireEvent.click(screen.getByText("push")));
    rerender(view("user-a"));
    await act(async () => {});
    expect(screen.getByTestId("can-undo").textContent).toBe("true");
  });
});
