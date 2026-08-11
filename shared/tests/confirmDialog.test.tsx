import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  ConfirmDialog,
  useConfirmDialog,
  type ConfirmRequest,
} from "../src/components";

/*
 * #707 — the in-app replacement for window.confirm / window.alert.
 *
 * What is worth pinning is the part the native calls used to do for free and
 * that a promise-based dialog can silently get wrong: an unanswered question
 * must not read as "yes", refusing must reach the caller as `false`, and the
 * acknowledge-only shape must not offer a choice that does not exist.
 */

const QUESTION: ConfirmRequest = {
  message: "Convert “Dentist” to a Todo?",
  confirmLabel: "Convert",
  cancelLabel: "Cancel",
};

const STATEMENT: ConfirmRequest = {
  // The wording the user specified for the routine refusal
  // (D-20260810-sched-5) — nothing to decide, so no second button.
  message: "Todoに繰り返しの機能はないため、変換は不可能です",
  confirmLabel: "OK",
};

/** The host wiring CalendarTab uses, reduced to the parts under test. */
function Harness({
  first = QUESTION,
  second,
  onAnswer,
}: {
  first?: ConfirmRequest;
  second?: ConfirmRequest;
  onAnswer: (answer: boolean, which: "first" | "second") => void;
}) {
  const { request, ask, resolve } = useConfirmDialog();
  return (
    <>
      <button
        type="button"
        onClick={() => void ask(first).then((a) => onAnswer(a, "first"))}
      >
        ask first
      </button>
      {second && (
        <button
          type="button"
          onClick={() => void ask(second).then((a) => onAnswer(a, "second"))}
        >
          ask second
        </button>
      )}
      {request && (
        <ConfirmDialog
          open
          message={request.message}
          confirmLabel={request.confirmLabel}
          cancelLabel={request.cancelLabel}
          danger={request.danger}
          onConfirm={() => resolve(true)}
          onCancel={() => resolve(false)}
        />
      )}
    </>
  );
}

const openFirst = () => fireEvent.click(screen.getByText("ask first"));

describe("ConfirmDialog / useConfirmDialog (#707)", () => {
  it("asks nothing until the host asks, then names itself with the question", () => {
    render(<Harness onAnswer={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    openFirst();
    // The message IS the accessible name: a screen reader should announce the
    // question, not a generic "Confirm".
    expect(screen.getByRole("dialog", { name: QUESTION.message })).toBeTruthy();
  });

  it("resolves true on the affirmative and closes", async () => {
    const onAnswer = vi.fn();
    render(<Harness onAnswer={onAnswer} />);
    openFirst();
    fireEvent.click(screen.getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true, "first"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("resolves false on cancel and on Escape", async () => {
    const onAnswer = vi.fn();
    render(<Harness onAnswer={onAnswer} />);
    openFirst();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false, "first"));

    openFirst();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
    expect(onAnswer).toHaveBeenNthCalledWith(2, false, "first");
  });

  it("offers no way to refuse when there is nothing to decide", () => {
    render(<Harness first={STATEMENT} onAnswer={vi.fn()} />);
    openFirst();
    // A refusal that reports WHY is an announcement. A Cancel button here
    // would invent a choice — and both answers would do the same thing.
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.getByRole("button", { name: "OK" })).toBeTruthy();
  });

  it("refuses a second question instead of replacing the one on screen", async () => {
    const onAnswer = vi.fn();
    render(<Harness second={STATEMENT} onAnswer={onAnswer} />);
    openFirst();
    fireEvent.click(screen.getByText("ask second"));
    // Replacing it would leave the first caller waiting forever; `false` is
    // the safe answer for every question this dialog carries.
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false, "second"));
    expect(screen.getByRole("dialog", { name: QUESTION.message })).toBeTruthy();
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });
});
