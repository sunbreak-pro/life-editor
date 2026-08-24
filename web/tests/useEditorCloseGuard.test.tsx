import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ConfirmRequest } from "@life-editor/shared";
import { useEditorCloseGuard } from "../src/schedule/useEditorCloseGuard";

/*
 * #889 — the guard in front of every way OUT of the Calendar's event editor,
 * pulled out of CalendarTab.
 *
 * `decideUnsavedClose` already has its own suite (unsavedCloseGuard.test.ts):
 * ask when dirty, do not ask when clean, keep the flag on a refusal. What that
 * one cannot see is the half that could not follow it out of the host — the
 * FLAG the decision reads, and the two different things the two exits do with
 * the same answer:
 *
 *   - `requestClose` CLEARS the flag on an agreed discard. The draft dies with
 *     the surface, so the next exit must not ask about a draft that is gone.
 *   - `requestDiscardKeepingFlag` deliberately does NOT (#998). The conversion
 *     asks its own question next — the routine refusal, or the confirm — and a
 *     refusal there leaves the draft on screen. Clear the flag here and the
 *     next exit throws that draft away without asking, having just promised
 *     not to (the same nuance as ScheduleTodoDetail's requestClose, #736).
 *
 * The two sat fifty lines apart in a 1,300-line host, which is exactly how a
 * near-miss like that survives review. They travel together now, so the pin is
 * on the ASYMMETRY: the tests below are the same script twice, differing only
 * in which exit ran, and they must not agree.
 *
 * The flag is a ref with no rendered consequence, so it is observed the only
 * way the app can observe it — by asking again and seeing whether a dialog
 * comes up.
 *
 * `useTranslation` is stubbed to echo its key: the request literal is what the
 * <ConfirmDialog> renders, and an echo makes the four fields read as the keys
 * that produced them (the same strings scheduleOverlays.test.tsx queries).
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** What the host's `askConfirm` receives; pinned once, below. */
const DISCARD_REQUEST: ConfirmRequest = {
  message: "common.unsavedCloseConfirm",
  confirmLabel: "common.discard",
  cancelLabel: "common.cancel",
  danger: true,
};

function setup(answer: boolean) {
  const askConfirm = vi.fn(async (request: ConfirmRequest) => {
    void request;
    return answer;
  });
  const close = vi.fn();
  const { result } = renderHook(() => useEditorCloseGuard(askConfirm));
  return {
    askConfirm,
    close,
    /** The pane reporting its draft state — the flag's only writer. */
    setDirty: (dirty: boolean) => result.current.onDirtyChange(dirty),
    requestClose: () =>
      act(async () => {
        await result.current.requestClose(close);
      }),
    requestDiscard: async () => {
      let discarded: boolean | undefined;
      await act(async () => {
        discarded = await result.current.requestDiscardKeepingFlag();
      });
      return discarded;
    },
  };
}

describe("useEditorCloseGuard — nothing pending", () => {
  it("closes without putting a dialog up at all", async () => {
    const { askConfirm, close, requestClose } = setup(true);
    await requestClose();
    expect(askConfirm).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  /*
   * The pane fires `onDirtyChange(false)` on unmount so a host holding the
   * flag in a ref cannot be left believing a torn-down editor is still dirty.
   * Without that, the NEXT editor's first Escape would ask about a draft that
   * belonged to the previous one.
   */
  it("goes back to silent once the pane says the draft is gone", async () => {
    const { askConfirm, requestClose, setDirty } = setup(true);
    setDirty(true);
    setDirty(false);
    await requestClose();
    expect(askConfirm).not.toHaveBeenCalled();
  });
});

describe("useEditorCloseGuard — requestClose", () => {
  it("asks before discarding, and closes when the answer is yes", async () => {
    const { askConfirm, close, requestClose, setDirty } = setup(true);
    setDirty(true);
    await requestClose();
    expect(askConfirm).toHaveBeenCalledWith(DISCARD_REQUEST);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps the surface open on a refusal, and keeps asking", async () => {
    const { askConfirm, close, requestClose, setDirty } = setup(false);
    setDirty(true);
    await requestClose();
    expect(close).not.toHaveBeenCalled();

    // The draft is still there, so the next Escape has to ask again.
    await requestClose();
    expect(askConfirm).toHaveBeenCalledTimes(2);
    expect(close).not.toHaveBeenCalled();
  });

  it("CLEARS the flag on an agreed discard — the next exit asks nothing", async () => {
    const { askConfirm, close, requestClose, setDirty } = setup(true);
    setDirty(true);
    await requestClose();
    expect(askConfirm).toHaveBeenCalledTimes(1);

    await requestClose();
    expect(askConfirm).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(2);
  });
});

describe("useEditorCloseGuard — requestDiscardKeepingFlag (#998)", () => {
  /*
   * The asymmetry, and the whole reason this cannot be assembled out of
   * requestClose at the call site. Same script as the case above; the only
   * difference is which exit ran, and the counts must come out different.
   */
  it("KEEPS the flag on an agreed discard — a later exit still asks", async () => {
    const { askConfirm, requestClose, requestDiscard, setDirty } = setup(true);
    setDirty(true);
    expect(await requestDiscard()).toBe(true);
    expect(askConfirm).toHaveBeenCalledTimes(1);

    // The conversion could still be refused downstream, leaving the draft on
    // screen — so the guard must not have been disarmed by this press.
    await requestClose();
    expect(askConfirm).toHaveBeenCalledTimes(2);
  });

  it("returns the go/no-go alone", async () => {
    const agreed = setup(true);
    agreed.setDirty(true);
    expect(await agreed.requestDiscard()).toBe(true);

    const refused = setup(false);
    refused.setDirty(true);
    expect(await refused.requestDiscard()).toBe(false);
  });

  it("does not ask when there is no draft to discard", async () => {
    const { askConfirm, requestDiscard } = setup(true);
    expect(await requestDiscard()).toBe(true);
    expect(askConfirm).not.toHaveBeenCalled();
  });

  /*
   * One `askDiscard`, folded from two character-identical literals in the
   * host. Two copies is how a close and a convert end up with two differently
   * worded dialogs about the same draft.
   */
  it("asks the very same question the close does", async () => {
    const { askConfirm, requestClose, requestDiscard, setDirty } = setup(false);
    setDirty(true);
    await requestClose();
    await requestDiscard();
    expect(askConfirm).toHaveBeenCalledTimes(2);
    expect(askConfirm.mock.calls[0][0]).toEqual(askConfirm.mock.calls[1][0]);
    expect(askConfirm.mock.calls[0][0]).toEqual(DISCARD_REQUEST);
  });
});
