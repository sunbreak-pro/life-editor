import { describe, it, expect, vi } from "vitest";
import { decideUnsavedClose } from "../src/schedule/unsavedCloseGuard";

/*
 * The guard CalendarTab runs on every exit from the event editor (#628). Pinned
 * here rather than through the component because CalendarTab needs the whole
 * Schedule Provider chain to render — the same reason taskChipUndoWiring's
 * writes live in their own module.
 */

describe("decideUnsavedClose", () => {
  it("closes without asking when nothing is pending", () => {
    const askDiscard = vi.fn(() => true);
    // Asking here would train the user to dismiss the dialog unread, which is
    // exactly what makes the real one useless later.
    expect(decideUnsavedClose({ dirty: false, askDiscard })).toEqual({
      close: true,
      clearDirty: false,
    });
    expect(askDiscard).not.toHaveBeenCalled();
  });

  it("closes and clears the flag when the discard is confirmed", () => {
    expect(decideUnsavedClose({ dirty: true, askDiscard: () => true })).toEqual(
      {
        close: true,
        clearDirty: true,
      },
    );
  });

  it("keeps the surface open AND the flag set when the answer is no", () => {
    // Clearing the flag on a refused close is the subtle version of the bug
    // this guard exists to prevent: the next Escape would then discard the
    // draft in silence, having just promised not to.
    expect(
      decideUnsavedClose({ dirty: true, askDiscard: () => false }),
    ).toEqual({ close: false, clearDirty: false });
  });

  it("asks exactly once per close attempt", () => {
    const askDiscard = vi.fn(() => false);
    decideUnsavedClose({ dirty: true, askDiscard });
    expect(askDiscard).toHaveBeenCalledTimes(1);
  });
});
