import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeleteAccountDialog } from "../src/components";

/*
 * Account-deletion confirmation (#1200).
 *
 * This is the only action in the app with nothing behind it — no Trash, no
 * undo, no restore — so the gate itself is the feature. What is pinned here
 * is that the gate cannot be walked past: the confirm button stays inert
 * until the account's own address has actually been typed back, and the ways
 * a dialog is normally dismissed by accident (a click on the backdrop) do not
 * apply to this one.
 *
 * The tolerance rules matter as much as the gate. A phone keyboard
 * capitalises the first letter on its own and a paste brings whitespace with
 * it; neither is the user failing to confirm, and refusing them would train
 * people to fight the field rather than read it.
 */

const EMAIL = "me@example.com";

const LABELS = {
  title: "このアカウントを削除しますか?",
  body: "アカウントとデータをすべて消去します。",
  consequences: ["データを削除します", "ログインできなくなります"],
  typePrompt: `確認のため ${EMAIL} と入力してください`,
  inputLabel: "メールアドレスの確認入力",
  confirm: "完全に削除する",
  busyLabel: "削除しています…",
  cancel: "キャンセル",
};

const onConfirm = vi.fn();
const onCancel = vi.fn();
const onValueChange = vi.fn();

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof DeleteAccountDialog>> = {},
) {
  return render(
    <DeleteAccountDialog
      open
      email={EMAIL}
      value=""
      onValueChange={onValueChange}
      onConfirm={onConfirm}
      onCancel={onCancel}
      labels={LABELS}
      {...overrides}
    />,
  );
}

const confirmButton = () =>
  screen.getByRole("button", { name: LABELS.confirm }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteAccountDialog", () => {
  it("names what goes, and starts with the confirm button locked", () => {
    renderDialog();

    screen.getByText("データを削除します");
    screen.getByText("ログインできなくなります");
    expect(confirmButton().disabled).toBe(true);
  });

  it("stays locked while the typed address is only close", () => {
    renderDialog({ value: "me@example.co" });

    expect(confirmButton().disabled).toBe(true);
  });

  it("arms once the address matches", () => {
    renderDialog({ value: EMAIL });

    expect(confirmButton().disabled).toBe(false);
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("forgives the case and whitespace a keyboard adds on its own", () => {
    renderDialog({ value: "  Me@Example.com " });

    expect(confirmButton().disabled).toBe(false);
  });

  it("never arms on an empty address, even against an empty field", () => {
    // The session read can fail (#919 catches it), leaving `email` blank — and
    // an empty gate is no gate at all.
    renderDialog({ email: "", value: "" });

    expect(confirmButton().disabled).toBe(true);
  });

  it("reports the typing to the host", () => {
    renderDialog();

    fireEvent.change(screen.getByRole("textbox", { name: LABELS.inputLabel }), {
      target: { value: "m" },
    });

    expect(onValueChange.mock.calls).toEqual([["m"]]);
  });

  it("locks everything while the deletion is in flight", () => {
    renderDialog({ value: EMAIL, busy: true });

    expect(
      screen
        .getByRole("button", { name: LABELS.busyLabel })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: LABELS.cancel }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("textbox", {
          name: LABELS.inputLabel,
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
  });

  it("shows a failure without closing, so the retry is one press away", () => {
    renderDialog({ value: EMAIL, error: "削除できませんでした" });

    screen.getByRole("alert");
    screen.getByText("削除できませんでした");
    expect(confirmButton().disabled).toBe(false);
  });

  it("cancels on the cancel button", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: LABELS.cancel }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss on a backdrop click", () => {
    // Modal's default is close-on-backdrop; this dialog opts out, because a
    // stray click is exactly the kind of thing that must not steer it.
    const { baseElement } = renderDialog();
    const backdrop = baseElement.querySelector(".fixed.inset-0");

    fireEvent.mouseDown(backdrop as Element);

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByRole("dialog")).toBe(null);
  });
});
