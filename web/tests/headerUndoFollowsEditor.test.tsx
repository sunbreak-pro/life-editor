import { describe, it, expect } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import {
  ShortcutConfigProvider,
  UndoRedoProvider,
  nextHistorySeq,
  useUndoRedoContext,
  type EditorHistory,
} from "@life-editor/shared";
import { HeaderUndoRedo } from "../src/HeaderUndoRedo";
import { MobileShellActions } from "../src/MobileShellActions";
import { GlobalShortcuts } from "../src/GlobalShortcuts";

/*
 * Which history the undo controls reach while a body editor is on screen.
 *
 * #1690 — while the body has focus, the header pair drives the body alone, so
 * it agrees with the Ctrl+Z TipTap answers inside the field.
 *
 * #2141 — once focus has left (a phone closing its keyboard), the body's
 * history stays reachable, and it competes with the app stack by which step
 * is NEWER (D-20261008-main-3). The header, Ctrl+Z outside the body and the
 * "More" sheet all go through the provider's one `undoLatest`, so the same
 * sequence must come out of each.
 *
 * The editor itself is not mounted here: what is under test is the routing,
 * and a real TipTap instance in jsdom would only add a slow way to produce
 * the same handle (rules/frontend.md §テスト環境の制約). The fake below stamps
 * its steps from the same clock the real editor's EditorHistoryOrder uses.
 */

type FakeBody = EditorHistory & {
  type: () => void;
  setFocused: (v: boolean) => void;
};

function makeBody(log: string[]): FakeBody {
  const undoSeqs: number[] = [];
  // Each undone step keeps its done stamp and gains an undone stamp, as the
  // real editor's EditorHistoryOrder does.
  const redoSteps: { seq: number; undoneAt: number }[] = [];
  const listeners = new Set<() => void>();
  let focused = false;
  const fire = () => listeners.forEach((l) => l());
  return {
    type: () => {
      undoSeqs.push(nextHistorySeq());
      redoSteps.length = 0;
      fire();
    },
    setFocused: (v) => {
      focused = v;
      fire();
    },
    undo: () => {
      const seq = undoSeqs.pop();
      if (seq === undefined) return;
      redoSteps.push({ seq, undoneAt: nextHistorySeq() });
      log.push("body:undo");
      fire();
    },
    redo: () => {
      const step = redoSteps.pop();
      if (step === undefined) return;
      undoSeqs.push(step.seq);
      log.push("body:redo");
      fire();
    },
    canUndo: () => undoSeqs.length > 0,
    canRedo: () => redoSteps.length > 0,
    isFocused: () => focused,
    undoSeq: () => undoSeqs[undoSeqs.length - 1] ?? null,
    redoSeq: () => redoSteps[redoSteps.length - 1]?.undoneAt ?? null,
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}

function Harness({ body, log }: { body: FakeBody | null; log: string[] }) {
  const { push, setEditorHistory, withdrawEditorHistory } =
    useUndoRedoContext();
  useEffect(() => {
    if (!body) return;
    setEditorHistory(body);
    return () => withdrawEditorHistory(body);
  }, [body, setEditorHistory, withdrawEditorHistory]);
  // A button, not a mount effect: the provider registers its change listener
  // in its OWN effect, which runs after a child's, so a push from mount would
  // never reach the controls.
  return (
    <button
      type="button"
      onClick={() =>
        push("wikiTags", {
          label: "tagChange",
          undo: () => {
            log.push("tag:undo");
          },
          redo: () => {
            log.push("tag:redo");
          },
        })
      }
    >
      tag
    </button>
  );
}

type Surface = "header" | "shortcut" | "sheet";

function renderSurface(surface: Surface, body: FakeBody | null, log: string[]) {
  let controls: ReactNode;
  if (surface === "header") controls = <HeaderUndoRedo />;
  else if (surface === "sheet")
    controls = (
      <ul>
        <MobileShellActions onOpenPalette={() => {}} closeSheet={() => {}} />
      </ul>
    );
  else
    controls = (
      <ShortcutConfigProvider>
        <GlobalShortcuts
          onNavigate={() => {}}
          onOpenSettings={() => {}}
          onTogglePalette={() => {}}
        />
      </ShortcutConfigProvider>
    );
  return render(
    <UndoRedoProvider>
      {controls}
      <Harness body={body} log={log} />
    </UndoRedoProvider>,
  );
}

const undoButton = () =>
  screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
const redoButton = () =>
  screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement;

async function press(surface: Surface, direction: "undo" | "redo") {
  await act(async () => {
    if (surface === "shortcut") {
      fireEvent.keyDown(window, {
        code: "KeyZ",
        key: "z",
        ctrlKey: true,
        shiftKey: direction === "redo",
      });
    } else {
      fireEvent.click(direction === "undo" ? undoButton() : redoButton());
    }
  });
}

async function tag() {
  await act(async () => fireEvent.click(screen.getByText("tag")));
}

describe("undo controls while a body is on screen without focus (#2141)", () => {
  it.each<Surface>(["header", "shortcut", "sheet"])(
    "%s: undoes the newer step first, and redoes in reverse",
    async (surface) => {
      const log: string[] = [];
      const body = makeBody(log);
      renderSurface(surface, body, log);

      // Type "abc", the keyboard closes, then a tag goes on.
      act(() => body.type());
      await tag();

      await press(surface, "undo");
      await press(surface, "undo");
      expect(log).toEqual(["tag:undo", "body:undo"]);

      await press(surface, "redo");
      await press(surface, "redo");
      expect(log).toEqual(["tag:undo", "body:undo", "body:redo", "tag:redo"]);
    },
  );

  it("keeps the header pressable with only the body's change to undo", async () => {
    const log: string[] = [];
    const body = makeBody(log);
    renderSurface("header", body, log);
    expect(undoButton().disabled).toBe(true);

    act(() => body.type());

    expect(undoButton().disabled).toBe(false);
    await press("header", "undo");
    expect(log).toEqual(["body:undo"]);
    expect(undoButton().disabled).toBe(true);
    expect(redoButton().disabled).toBe(false);
  });

  it("reaches the older body step once the newer app step is gone", async () => {
    const log: string[] = [];
    const body = makeBody(log);
    renderSurface("sheet", body, log);

    await tag();
    act(() => body.type());

    await press("sheet", "undo");
    await press("sheet", "undo");
    expect(log).toEqual(["body:undo", "tag:undo"]);
  });

  it("redoes what was undone last, even when it was done later", async () => {
    // Tag, undo the tag, type "abc", undo that, then Redo: "abc" was taken
    // back last, so it comes back first.
    const log: string[] = [];
    const body = makeBody(log);
    renderSurface("header", body, log);
    await tag();
    await press("header", "undo");
    act(() => body.type());
    await press("header", "undo");

    await press("header", "redo");
    await press("header", "redo");

    expect(log).toEqual(["tag:undo", "body:undo", "body:redo", "tag:redo"]);
  });

  it("does not let an unmounting editor withdraw a newer editor's offer", async () => {
    const log: string[] = [];
    const first = makeBody(log);
    const second = makeBody(log);
    const { rerender } = renderSurface("header", first, log);
    act(() => second.type());

    // The second body mounts; then the first goes. The offer must survive.
    rerender(
      <UndoRedoProvider>
        <HeaderUndoRedo />
        <Harness body={first} log={log} />
        <Harness body={second} log={log} />
      </UndoRedoProvider>,
    );
    rerender(
      <UndoRedoProvider>
        <HeaderUndoRedo />
        <Harness body={null} log={log} />
        <Harness body={second} log={log} />
      </UndoRedoProvider>,
    );

    expect(undoButton().disabled).toBe(false);
    await press("header", "undo");
    expect(log).toEqual(["body:undo"]);
  });
});

describe("undo controls while the body has focus (#1690)", () => {
  it("drives the focused body alone, even with a newer app step", async () => {
    const log: string[] = [];
    const body = makeBody(log);
    renderSurface("header", body, log);
    act(() => body.type());
    await tag();
    act(() => body.setFocused(true));

    await press("header", "undo");

    expect(log).toEqual(["body:undo"]);
  });

  it("greys out with the focused body's own flags, live", async () => {
    const log: string[] = [];
    const body = makeBody(log);
    renderSurface("header", body, log);
    await tag();
    act(() => body.setFocused(true));

    // The app stack has a step, but the focused body has none.
    expect(undoButton().disabled).toBe(true);

    act(() => body.type());
    expect(undoButton().disabled).toBe(false);
  });

  it("drives the app stack when no body is on screen", async () => {
    const log: string[] = [];
    renderSurface("header", null, log);
    await tag();

    await press("header", "undo");

    expect(log).toEqual(["tag:undo"]);
  });

  it("does not take focus when pressed, so a repeat keeps reaching the editor", () => {
    const log: string[] = [];
    const body = makeBody(log);
    renderSurface("header", body, log);
    // Something to undo, so the button is live.
    act(() => body.type());

    // A plain button focuses on mousedown; this pair must not, or the editor
    // would blur before the click landed and the press would change rules.
    const prevented = !fireEvent.mouseDown(undoButton());

    expect(prevented).toBe(true);
  });
});
