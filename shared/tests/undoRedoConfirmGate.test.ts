import { describe, it, expect, vi } from "vitest";
import {
  UndoRedoManager,
  type UndoCommand,
} from "../src/utils/undoRedo/UndoRedoManager";

/*
 * #1638 — the question a repeat command has to pass before it runs.
 *
 * Undo is a keystroke, and a command that was applied to a whole series
 * reverses days the user cannot see from where they are standing. The manager
 * only knows that such a command carries a `confirm` block; what the dialog
 * says is the host's (§6.4).
 *
 * The cancelled case is the one worth pinning hardest: a "no" must leave the
 * history exactly as it was, or cancelling would be a way to quietly drop a
 * command.
 */

function cmd(over: Partial<UndoCommand> = {}): UndoCommand & {
  ran: string[];
} {
  const ran: string[] = [];
  return {
    label: "updateRoutine",
    undo: () => {
      ran.push("undo");
    },
    redo: () => {
      ran.push("redo");
    },
    ran,
    ...over,
  };
}

describe("UndoRedoManager — the confirm gate (#1638)", () => {
  it("asks before undoing a command that carries a confirm spec", async () => {
    const m = new UndoRedoManager();
    const gate = vi.fn(async () => true);
    m.setConfirmGate(gate);
    const c = cmd({ confirm: { kind: "repeat", scope: "future" } });
    m.push(c);

    const outcome = await m.undo();

    expect(gate).toHaveBeenCalledWith({
      direction: "undo",
      label: "updateRoutine",
      confirm: { kind: "repeat", scope: "future" },
    });
    expect(outcome?.ok).toBe(true);
    expect(c.ran).toEqual(["undo"]);
  });

  it("leaves both stacks untouched when the answer is no", async () => {
    const m = new UndoRedoManager();
    m.setConfirmGate(async () => false);
    const c = cmd({ confirm: { kind: "repeat", scope: "all" } });
    m.push(c);

    const outcome = await m.undo();

    expect(outcome).toBeNull();
    expect(c.ran).toEqual([]);
    expect(m.canUndo()).toBe(true);
    expect(m.canRedo()).toBe(false);
  });

  it("asks again on the redo of the same command", async () => {
    const m = new UndoRedoManager();
    const gate = vi.fn(async () => true);
    m.setConfirmGate(gate);
    const c = cmd({ confirm: { kind: "repeat", scope: "this" } });
    m.push(c);

    await m.undo();
    const outcome = await m.redo();

    expect(gate).toHaveBeenCalledTimes(2);
    expect(gate.mock.calls[1][0]).toMatchObject({ direction: "redo" });
    expect(outcome?.ok).toBe(true);
    expect(c.ran).toEqual(["undo", "redo"]);
  });

  it("does not ask for a command with no confirm spec", async () => {
    const m = new UndoRedoManager();
    const gate = vi.fn(async () => true);
    m.setConfirmGate(gate);
    const c = cmd();
    m.push(c);

    await m.undo();

    expect(gate).not.toHaveBeenCalled();
    expect(c.ran).toEqual(["undo"]);
  });

  it("runs the command straight through when no host registered a gate", async () => {
    // A Schedule command can be reversed from a screen with no dialog (the
    // keyboard shortcut after the section unmounted its gate). Refusing to run
    // would make the command unreversible; running it is what it was before.
    const m = new UndoRedoManager();
    const c = cmd({ confirm: { kind: "repeat", scope: "all" } });
    m.push(c);

    await m.undo();

    expect(c.ran).toEqual(["undo"]);
  });

  it("drops the answer when another write lands while the dialog is open", async () => {
    const m = new UndoRedoManager();
    let release: (() => void) | null = null;
    m.setConfirmGate(
      () =>
        new Promise<boolean>((resolve) => {
          release = () => resolve(true);
        }),
    );
    const asked = cmd({ confirm: { kind: "repeat", scope: "all" } });
    m.push(asked);

    const pending = m.undo();
    // The user answers "yes" — but something else has been pushed in the
    // meantime, so the yes was about a command that is no longer on top.
    const newer = cmd({ label: "updateScheduleItem" });
    m.push(newer);
    release!();

    expect(await pending).toBeNull();
    expect(asked.ran).toEqual([]);
    expect(newer.ran).toEqual([]);
    expect(m.canUndo()).toBe(true);
  });

  it("forgets the gate when it is cleared", async () => {
    const m = new UndoRedoManager();
    const gate = vi.fn(async () => false);
    m.setConfirmGate(gate);
    m.setConfirmGate(null);
    const c = cmd({ confirm: { kind: "repeat", scope: "this" } });
    m.push(c);

    await m.undo();

    expect(gate).not.toHaveBeenCalled();
    expect(c.ran).toEqual(["undo"]);
  });
});
