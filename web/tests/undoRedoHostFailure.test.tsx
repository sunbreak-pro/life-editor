import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useUndoRedoContext } from "@life-editor/shared";
import { UndoRedoHost } from "../src/UndoRedoHost";

/*
 * #1668 — the toast must follow what the undo actually did.
 *
 * Before this, the host toasted "Undid: …" unconditionally, so a write that
 * failed read as reversed until the next reload put it back. The pair below
 * pins both halves: a clean undo still says it was undone, and a throwing one
 * says it could not be, with no success copy alongside.
 */

function Probe({ fails }: { fails: boolean }) {
  const { push, undo } = useUndoRedoContext();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          push("notes", {
            label: "updateNote",
            undo: fails ? () => Promise.reject(new Error("offline")) : () => {},
            redo: () => {},
          })
        }
      >
        push
      </button>
      <button type="button" onClick={() => undo()}>
        undo
      </button>
    </>
  );
}

async function pushThenUndo(fails: boolean): Promise<void> {
  render(
    <ToastProvider>
      <UndoRedoHost>
        <Probe fails={fails} />
      </UndoRedoHost>
    </ToastProvider>,
  );
  await act(async () => fireEvent.click(screen.getByText("push")));
  await act(async () => fireEvent.click(screen.getByText("undo")));
}

describe("UndoRedoHost toasts (#1668)", () => {
  it("announces a successful undo", async () => {
    await pushThenUndo(false);
    screen.getByText("Undid: note update");
  });

  it("shows the failure, not the success copy, when the undo throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await pushThenUndo(true);
    spy.mockRestore();
    screen.getByText("Couldn't undo: note update");
    expect(screen.queryByText("Undid: note update")).toBeNull();
  });
});
