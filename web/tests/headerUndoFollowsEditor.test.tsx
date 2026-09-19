import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import {
  UndoRedoProvider,
  useUndoRedoContext,
  type EditorHistory,
} from "@life-editor/shared";
import { HeaderUndoRedo } from "../src/HeaderUndoRedo";

/*
 * #1690 — the header buttons follow focus, so they agree with Ctrl+Z.
 *
 * Two histories exist. Inside a body editor Ctrl+Z goes to TipTap
 * (useGlobalShortcuts hands field keystrokes to the field and never to the
 * app stack); the header pair only ever drove the app stack. Pressing Undo
 * while writing therefore reversed something else entirely — a schedule drag
 * on another screen — and the two controls disagreed about what undo meant.
 *
 * The editor itself is not mounted here: what is under test is the routing,
 * and a real TipTap instance in jsdom would only add a slow way to produce
 * the same handle (rules/frontend.md §テスト環境の制約).
 */

function makeHistory(): EditorHistory & {
  ran: string[];
  fire: () => void;
  setCanUndo: (v: boolean) => void;
} {
  const ran: string[] = [];
  const listeners = new Set<() => void>();
  let canUndo = true;
  const h = {
    ran,
    undo: () => {
      ran.push("undo");
    },
    redo: () => {
      ran.push("redo");
    },
    canUndo: () => canUndo,
    canRedo: () => false,
    subscribe: (onChange: () => void) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    fire: () => listeners.forEach((l) => l()),
    setCanUndo: (v: boolean) => {
      canUndo = v;
    },
  };
  return h;
}

function Harness({
  history,
  appUndo,
}: {
  history: EditorHistory | null;
  appUndo: () => void;
}) {
  const { push, setEditorHistory } = useUndoRedoContext();
  useEffect(() => {
    setEditorHistory(history);
    return () => setEditorHistory(null);
  }, [history, setEditorHistory]);
  // A button, not a mount effect: the provider registers its change listener
  // in its OWN effect, which runs after a child's, so a push from mount would
  // never reach the header and the buttons would stay dead.
  return (
    <button
      type="button"
      onClick={() =>
        push("todoTree", {
          label: "todoTreeChange",
          undo: appUndo,
          redo: () => {},
        })
      }
    >
      push
    </button>
  );
}

function renderHeader(history: EditorHistory | null, appUndo: () => void) {
  render(
    <UndoRedoProvider>
      <HeaderUndoRedo />
      <Harness history={history} appUndo={appUndo} />
    </UndoRedoProvider>,
  );
  fireEvent.click(screen.getByText("push"));
}

const undoButton = () =>
  screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;

describe("HeaderUndoRedo routing (#1690)", () => {
  it("drives the app stack when no body editor has focus", async () => {
    const appUndo = vi.fn();
    renderHeader(null, appUndo);

    await act(async () => fireEvent.click(undoButton()));

    expect(appUndo).toHaveBeenCalledTimes(1);
  });

  it("drives the editor's history while it has focus, not the app stack", async () => {
    const appUndo = vi.fn();
    const history = makeHistory();
    renderHeader(history, appUndo);

    await act(async () => fireEvent.click(undoButton()));

    expect(history.ran).toEqual(["undo"]);
    // The app command is still on the stack, untouched.
    expect(appUndo).not.toHaveBeenCalled();
  });

  it("greys out with the editor's own flags, live", async () => {
    const history = makeHistory();
    renderHeader(history, vi.fn());
    expect(undoButton().disabled).toBe(false);

    // A transaction that empties the editor's history.
    history.setCanUndo(false);
    await act(async () => history.fire());

    expect(undoButton().disabled).toBe(true);
  });

  it("does not take focus when pressed, so a repeat keeps reaching the editor", async () => {
    const history = makeHistory();
    renderHeader(history, vi.fn());

    // A plain button focuses on mousedown; this pair must not, or the editor
    // would blur and withdraw its history before the click landed.
    const prevented = !fireEvent.mouseDown(undoButton());

    expect(prevented).toBe(true);
  });
});
