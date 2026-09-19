import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  UndoRedoProvider,
  useUndoRedoContext,
  type ConfirmRequest,
} from "@life-editor/shared";
import { HeaderUndoRedo } from "../src/HeaderUndoRedo";
import { useRepeatUndoGate } from "../src/schedule/useRepeatUndoGate";

/*
 * #1638 (ユーザー指定): an Undo / Redo that reaches a repeating item asks first
 * and says which occurrences it covers.
 *
 * Driven through the real provider and the real header buttons, because the
 * part worth pinning is the join: the manager holds the question, the Schedule
 * host answers it, and a cancel has to leave the history exactly as it was —
 * otherwise "cancel" becomes a way to lose a command.
 */

function harness(answer: boolean | Promise<boolean>) {
  const asked: ConfirmRequest[] = [];
  const askConfirm = vi.fn((request: ConfirmRequest) => {
    asked.push(request);
    return Promise.resolve(answer);
  });
  const ran: string[] = [];

  function Host() {
    const { push } = useUndoRedoContext();
    useRepeatUndoGate(askConfirm);
    return (
      <>
        <button
          onClick={() =>
            push("routine", {
              label: "updateRoutine",
              confirm: { kind: "repeat", scope: "future" },
              undo: () => {
                ran.push("undo");
              },
              redo: () => {
                ran.push("redo");
              },
            })
          }
        >
          repeat write
        </button>
        <button
          onClick={() =>
            push("scheduleItem", {
              label: "updateScheduleItem",
              undo: () => {
                ran.push("plain undo");
              },
              redo: () => {},
            })
          }
        >
          plain write
        </button>
      </>
    );
  }

  render(
    <UndoRedoProvider>
      <HeaderUndoRedo />
      <Host />
    </UndoRedoProvider>,
  );
  return { askConfirm, asked, ran };
}

const button = (name: string) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;

describe("useRepeatUndoGate", () => {
  it("asks before undoing a repeat write, naming the scope", async () => {
    const h = harness(true);
    fireEvent.click(screen.getByText("repeat write"));

    await act(async () => fireEvent.click(button("Undo")));

    expect(h.askConfirm).toHaveBeenCalledTimes(1);
    expect(h.asked[0].message).toContain(
      "It applies to this and the following occurrences.",
    );
    expect(h.asked[0].confirmLabel).toBe("Undo");
    expect(h.ran).toEqual(["undo"]);
  });

  it("changes nothing when the question is declined", async () => {
    const h = harness(false);
    fireEvent.click(screen.getByText("repeat write"));

    await act(async () => fireEvent.click(button("Undo")));

    expect(h.ran).toEqual([]);
    // Still undoable, and nothing to redo: the command never moved.
    expect(button("Undo").disabled).toBe(false);
    expect(button("Redo").disabled).toBe(true);
  });

  it("asks again, with the other wording, on the redo", async () => {
    const h = harness(true);
    fireEvent.click(screen.getByText("repeat write"));

    await act(async () => fireEvent.click(button("Undo")));
    await act(async () => fireEvent.click(button("Redo")));

    expect(h.askConfirm).toHaveBeenCalledTimes(2);
    expect(h.asked[1].confirmLabel).toBe("Redo");
    expect(h.ran).toEqual(["undo", "redo"]);
  });

  it("leaves a one-off write alone", async () => {
    const h = harness(true);
    fireEvent.click(screen.getByText("plain write"));

    await act(async () => fireEvent.click(button("Undo")));

    expect(h.askConfirm).not.toHaveBeenCalled();
    expect(h.ran).toEqual(["plain undo"]);
  });
});
