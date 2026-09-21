import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotePasswordDialog } from "../src/notes/NotePasswordDialog";

/*
 * #1278 moved this dialog's error line onto the shared NoticePanel's text
 * variant. The line's COPY was already safe — it comes in through `labels` —
 * but its `id` was not: both password inputs point `aria-describedby` at it,
 * and a swap that dropped the id would detach that description with nothing
 * on screen changing and no gate noticing.
 *
 * So this suite pins the wiring rather than the wording: whatever node
 * announces the failure is the same node the field says describes it.
 */

const LABELS = {
  setTitle: "Set a password",
  removeTitle: "Remove the password",
  verifyTitle: "Enter the password",
  passwordLabel: "Password",
  currentPasswordLabel: "Current password",
  confirmPasswordLabel: "Confirm password",
  submit: "Save",
  busy: "Saving…",
  cancel: "Cancel",
  mismatch: "The two entries do not match.",
  wrongPassword: "That password is not right.",
  required: "A password is required.",
  saveFailed: "Could not save.",
};

function renderDialog(mode: "set" | "remove" | "verify" = "set") {
  const onSubmit = vi.fn(() => Promise.resolve());
  const onClose = vi.fn();
  render(
    <NotePasswordDialog
      mode={mode}
      labels={LABELS}
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  );
  return { onSubmit, onClose };
}

describe("NotePasswordDialog — the error line (#1278)", () => {
  it("describes both fields by the node that announces the failure", () => {
    const { onSubmit } = renderDialog("set");

    // Empty submit is the cheapest way to the `required` branch, and it is
    // also the one that must NOT reach the host.
    fireEvent.click(screen.getByRole("button", { name: LABELS.submit }));
    expect(onSubmit).not.toHaveBeenCalled();

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(LABELS.required);
    expect(alert.id).toBeTruthy();

    // "set" mode draws both the password and the confirm field, and each one
    // claims this line as its description. Queried by type rather than by
    // label: the first field's label text is mode-dependent, and what this
    // case is about is that EVERY field points at the line.
    const fields = document.querySelectorAll<HTMLInputElement>(
      'input[type="password"]',
    );
    expect(fields).toHaveLength(2);
    for (const field of fields) {
      expect(field.getAttribute("aria-describedby")).toBe(alert.id);
      expect(field.getAttribute("aria-invalid")).toBe("true");
    }
  });

  it("carries no error line, and no description, before anything fails", () => {
    renderDialog("verify");
    expect(screen.queryByRole("alert")).toBeNull();
    const field = document.querySelector('input[type="password"]');
    expect(field?.getAttribute("aria-describedby")).toBeNull();
    expect(field?.getAttribute("aria-invalid")).toBeNull();
  });
});

/*
 * #1804 — this dialog was the one place that raised `aria-busy` and drew
 * nothing. The submit button went pale (disabled:opacity-40) and pale is also
 * what an unusable button looks like, so a sighted user could not tell a save
 * in flight from a save that had refused to start.
 */
describe("NotePasswordDialog — the in-flight cue (#1804)", () => {
  it("shows a spinner and the busy wording while the write runs", async () => {
    let settle: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );
    const { container } = render(
      <NotePasswordDialog
        mode="verify"
        labels={LABELS}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    // A non-empty field is what gets past the `required` guard and into the
    // await — the whole state under test only exists between the two.
    fireEvent.change(
      container.querySelector<HTMLInputElement>('input[type="password"]')!,
      { target: { value: "hunter2" } },
    );
    fireEvent.click(screen.getByRole("button", { name: LABELS.submit }));

    // Plain DOM reads: jest-dom's matchers are not wired up in web/tests.
    const button = await screen.findByRole("button", { name: LABELS.busy });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(".animate-spin")).not.toBeNull();

    settle();
  });

  it("draws no spinner while the button is simply sitting there", () => {
    const { container } = renderDialogIn("verify");

    expect(container.querySelector(".animate-spin")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: LABELS.submit })
        .getAttribute("aria-busy"),
    ).not.toBe("true");
  });
});

function renderDialogIn(mode: "set" | "remove" | "verify") {
  return render(
    <NotePasswordDialog
      mode={mode}
      labels={LABELS}
      onSubmit={vi.fn(() => Promise.resolve())}
      onClose={vi.fn()}
    />,
  );
}
