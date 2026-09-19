import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useUndoRedoContext } from "@life-editor/shared";
import { AppErrorBoundary } from "../src/components/AppErrorBoundary";
import { UndoRedoHost } from "../src/UndoRedoHost";

/*
 * #1681 — a failed Undo has to read as a toast, never as the section panel.
 *
 * The panel is what the section ErrorBoundary puts up in place of a screen
 * (web/src/MainScreen.tsx wraps the section body in one). It is the right
 * answer for a render-time throw and the wrong one for "the write did not
 * land": the user loses the screen over a reversal that simply failed.
 *
 * A boundary only catches throws during RENDER, so the closure has to fail in
 * a way the manager sees. Both shapes below are real: a Promise rejection is
 * what a DataService call produces, and a synchronous throw is what any
 * plain `setState` reversal produces when the state it reads is gone. The
 * manager awaits the closure inside one try, so it must swallow the same for
 * both — the pair is here because "await x()" catching a SYNCHRONOUS throw is
 * exactly the kind of thing a refactor to `.then()` would quietly drop.
 *
 * Toasts and the panel BOTH carry role="alert" (a danger toast is assertive
 * too), so nothing here queries by role — the panel is identified by its own
 * copy.
 */

const PANEL_TITLE = "This section could not be shown";

type Shape = "throws" | "rejects";

function makeFailure(shape: Shape): () => void | Promise<void> {
  return shape === "throws"
    ? () => {
        throw new Error("offline");
      }
    : () => Promise.reject(new Error("offline"));
}

/*
 * #1638's repeat-scope dialog, registered by the Schedule host. The gate is
 * awaited OUTSIDE the try that guards the closures, so a host whose dialog
 * blew up used to reject the manager's own promise — see the manager's note.
 */
function GateProbe() {
  const { push, undo, setConfirmGate } = useUndoRedoContext();
  useEffect(() => {
    setConfirmGate(() => Promise.reject(new Error("dialog host is gone")));
    return () => setConfirmGate(null);
  }, [setConfirmGate]);
  return (
    <>
      <button
        type="button"
        onClick={() =>
          push("scheduleItem", {
            label: "updateScheduleItem",
            confirm: { kind: "repeat", scope: "all" },
            undo: () => {},
            redo: () => {},
          })
        }
      >
        push
      </button>
      <button type="button" onClick={() => undo()}>
        run undo
      </button>
    </>
  );
}

function Probe({
  direction,
  shape,
}: {
  direction: "undo" | "redo";
  shape: Shape;
}) {
  const { push, undo, redo } = useUndoRedoContext();
  const fail = makeFailure(shape);
  return (
    <>
      <button
        type="button"
        onClick={() =>
          push("note", {
            label: "updateNote",
            // For the redo case the undo has to succeed first — that is what
            // moves the command onto the redo stack.
            undo: direction === "undo" ? fail : () => {},
            redo: fail,
          })
        }
      >
        push
      </button>
      <button type="button" onClick={() => undo()}>
        run undo
      </button>
      <button type="button" onClick={() => redo()}>
        run redo
      </button>
    </>
  );
}

async function click(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByText(name));
  });
}

async function failOne(direction: "undo" | "redo", shape: Shape) {
  render(
    <ToastProvider>
      <AppErrorBoundary variant="section" resetKey="notes">
        <UndoRedoHost>
          <Probe direction={direction} shape={shape} />
        </UndoRedoHost>
      </AppErrorBoundary>
    </ToastProvider>,
  );
  await click("push");
  await click("run undo");
  if (direction === "redo") await click("run redo");
}

describe("a failed undo/redo stays a toast (#1681)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The manager logs the swallowed error; the run must not fail on it.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  for (const shape of ["throws", "rejects"] as const) {
    it(`keeps the section alive when the undo ${shape}`, async () => {
      await failOne("undo", shape);

      expect(screen.queryByText(PANEL_TITLE)).toBeNull();
      expect(screen.getAllByText("Couldn't undo: note update")).toHaveLength(1);
      expect(screen.queryByText("Undid: note update")).toBeNull();
    });

    it(`keeps the section alive when the redo ${shape}`, async () => {
      await failOne("redo", shape);

      expect(screen.queryByText(PANEL_TITLE)).toBeNull();
      expect(screen.getAllByText("Couldn't redo: note update")).toHaveLength(1);
      expect(screen.queryByText("Redid: note update")).toBeNull();
      // The undo that got us here DID land, so its success copy is expected.
      screen.getByText("Undid: note update");
    });
  }

  it("keeps the section alive when the repeat-scope dialog itself fails", async () => {
    render(
      <ToastProvider>
        <AppErrorBoundary variant="section" resetKey="schedule">
          <UndoRedoHost>
            <GateProbe />
          </UndoRedoHost>
        </AppErrorBoundary>
      </ToastProvider>,
    );
    await click("push");
    await click("run undo");

    expect(screen.queryByText(PANEL_TITLE)).toBeNull();
    expect(screen.getAllByText("Couldn't undo: event update")).toHaveLength(1);
    expect(screen.queryByText("Undid: event update")).toBeNull();
  });
});
