import { describe, it, expect, vi } from "vitest";
import { decideUnsavedClose } from "../src/schedule/unsavedCloseGuard";

/*
 * The guard CalendarTab runs on every exit from the event editor (#628). Pinned
 * here rather than through the component because CalendarTab needs the whole
 * Schedule Provider chain to render — the same reason todoChipUndoWiring's
 * writes live in their own module.
 */

describe("decideUnsavedClose", () => {
  it("closes without asking when nothing is pending", async () => {
    const askDiscard = vi.fn(() => true);
    // Asking here would train the user to dismiss the dialog unread, which is
    // exactly what makes the real one useless later.
    await expect(
      decideUnsavedClose({ dirty: false, askDiscard }),
    ).resolves.toEqual({
      close: true,
      clearDirty: false,
    });
    expect(askDiscard).not.toHaveBeenCalled();
  });

  it("closes and clears the flag when the discard is confirmed", async () => {
    await expect(
      decideUnsavedClose({ dirty: true, askDiscard: () => true }),
    ).resolves.toEqual({
      close: true,
      clearDirty: true,
    });
  });

  it("keeps the surface open AND the flag set when the answer is no", async () => {
    // Clearing the flag on a refused close is the subtle version of the bug
    // this guard exists to prevent: the next Escape would then discard the
    // draft in silence, having just promised not to.
    await expect(
      decideUnsavedClose({ dirty: true, askDiscard: () => false }),
    ).resolves.toEqual({ close: false, clearDirty: false });
  });

  it("asks exactly once per close attempt", async () => {
    const askDiscard = vi.fn(() => false);
    await decideUnsavedClose({ dirty: true, askDiscard });
    expect(askDiscard).toHaveBeenCalledTimes(1);
  });

  // #707: the question is an in-app dialog now, so the answer comes back a
  // tick later. A guard that read the pending promise as a truthy "yes" would
  // discard the draft the moment the dialog opened — before it was answered.
  it("waits for an answer that arrives asynchronously", async () => {
    let answer!: (ok: boolean) => void;
    const asked = new Promise<boolean>((resolve) => {
      answer = resolve;
    });
    const decision = decideUnsavedClose({
      dirty: true,
      askDiscard: () => asked,
    });
    answer(false);
    await expect(decision).resolves.toEqual({
      close: false,
      clearDirty: false,
    });
  });
});
