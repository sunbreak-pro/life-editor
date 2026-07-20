import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { UndoRedoProvider } from "../src/context/UndoRedoContext";
import { useUndoRedoContext } from "../src/hooks/useUndoRedoContext";

/*
 * UndoRedoProvider (#304) — React binding over the global manager. Verifies
 * canUndo/canRedo reactivity through the context, that push/undo/redo drive the
 * shared stack, and that onCommandApplied fires with the command label + the
 * undo/redo direction (the toast source).
 */

function Probe() {
  const { push, undo, redo, canUndo, canRedo } = useUndoRedoContext();
  return (
    <div>
      <span data-testid="can-undo">{String(canUndo())}</span>
      <span data-testid="can-redo">{String(canRedo())}</span>
      <button
        onClick={() =>
          push("taskTree", {
            label: "taskTreeChange",
            undo: () => {},
            redo: () => {},
          })
        }
      >
        push
      </button>
      <button onClick={() => undo()}>undo</button>
      <button onClick={() => redo()}>redo</button>
    </div>
  );
}

describe("UndoRedoProvider", () => {
  it("exposes reactive canUndo/canRedo across push/undo/redo", async () => {
    render(
      <UndoRedoProvider>
        <Probe />
      </UndoRedoProvider>,
    );
    expect(screen.getByTestId("can-undo").textContent).toBe("false");

    await act(async () => {
      fireEvent.click(screen.getByText("push"));
    });
    expect(screen.getByTestId("can-undo").textContent).toBe("true");
    expect(screen.getByTestId("can-redo").textContent).toBe("false");

    await act(async () => {
      fireEvent.click(screen.getByText("undo"));
    });
    expect(screen.getByTestId("can-undo").textContent).toBe("false");
    expect(screen.getByTestId("can-redo").textContent).toBe("true");

    await act(async () => {
      fireEvent.click(screen.getByText("redo"));
    });
    expect(screen.getByTestId("can-undo").textContent).toBe("true");
  });

  it("fires onCommandApplied with direction + label on undo and redo", async () => {
    const onCommandApplied = vi.fn();
    render(
      <UndoRedoProvider onCommandApplied={onCommandApplied}>
        <Probe />
      </UndoRedoProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("push"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("undo"));
    });
    expect(onCommandApplied).toHaveBeenCalledWith("undo", "taskTreeChange");

    await act(async () => {
      fireEvent.click(screen.getByText("redo"));
    });
    expect(onCommandApplied).toHaveBeenLastCalledWith("redo", "taskTreeChange");
  });

  it("clear() empties the stack through the context (unmount safety valve)", async () => {
    // TaskTreeProvider clears the global stack on unmount to avoid running a
    // dead provider's command after navigation (#304 child-1 safety valve).
    function ClearProbe() {
      const { push, clear, canUndo } = useUndoRedoContext();
      return (
        <div>
          <span data-testid="cu">{String(canUndo())}</span>
          <button
            onClick={() =>
              push("d", { label: "l", undo: () => {}, redo: () => {} })
            }
          >
            push
          </button>
          <button onClick={() => clear()}>clear</button>
        </div>
      );
    }
    render(
      <UndoRedoProvider>
        <ClearProbe />
      </UndoRedoProvider>,
    );
    await act(async () => fireEvent.click(screen.getByText("push")));
    expect(screen.getByTestId("cu").textContent).toBe("true");
    await act(async () => fireEvent.click(screen.getByText("clear")));
    expect(screen.getByTestId("cu").textContent).toBe("false");
  });

  it("runs the command's undo/redo closures", async () => {
    const log: string[] = [];
    function Runner() {
      const { push, undo, redo } = useUndoRedoContext();
      return (
        <>
          <button
            onClick={() =>
              push("d", {
                label: "l",
                undo: () => log.push("undo"),
                redo: () => log.push("redo"),
              })
            }
          >
            p
          </button>
          <button onClick={() => undo()}>u</button>
          <button onClick={() => redo()}>r</button>
        </>
      );
    }
    render(
      <UndoRedoProvider>
        <Runner />
      </UndoRedoProvider>,
    );
    await act(async () => fireEvent.click(screen.getByText("p")));
    await act(async () => fireEvent.click(screen.getByText("u")));
    await act(async () => fireEvent.click(screen.getByText("r")));
    expect(log).toEqual(["undo", "redo"]);
  });
});
