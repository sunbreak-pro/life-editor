import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthScreen } from "../src/AuthScreen";

/*
 * #919 — the two halves of "I forgot my password" on the auth screen.
 *
 * Before this, a forgotten password had no way back: the screen offered only
 * credentials, and the recovery link was ignored. Both halves are pinned here
 * because both are invisible in a passing build — the request card is one
 * click away from a screen that otherwise looks unchanged, and the reset card
 * only ever appears when App reports a recovery event.
 *
 * The confirmation wording is asserted too: it must be the same line whether
 * or not the address has an account, or the screen becomes a way to ask
 * Supabase which addresses are registered.
 */

const state = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn(),
  updatePassword: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
    signIn: state.signIn,
    signUp: state.signUp,
    sendPasswordResetEmail: state.sendPasswordResetEmail,
    updatePassword: state.updatePassword,
  };
});

describe("AuthScreen — forgotten password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.sendPasswordResetEmail.mockResolvedValue({ error: null });
    state.updatePassword.mockResolvedValue({ error: null });
  });

  it("opens the reset-request card and carries the typed address over", () => {
    render(<AuthScreen />);
    fireEvent.change(screen.getByLabelText("auth.email"), {
      target: { value: "  me@example.com  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "auth.forgotPassword" }),
    );

    expect(screen.getByText("auth.resetRequest.heading")).toBeTruthy();
    expect(
      (screen.getByLabelText("auth.email") as HTMLInputElement).value,
    ).toBe("me@example.com");
  });

  it("requests the link and answers without disclosing whether the address exists", async () => {
    render(<AuthScreen />);
    fireEvent.click(
      screen.getByRole("button", { name: "auth.forgotPassword" }),
    );
    fireEvent.change(screen.getByLabelText("auth.email"), {
      target: { value: " me@example.com " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "auth.resetRequest.submit" }),
    );

    await waitFor(() =>
      expect(state.sendPasswordResetEmail).toHaveBeenCalledWith(
        "me@example.com",
      ),
    );
    expect(await screen.findByText("auth.resetRequest.sent")).toBeTruthy();
  });

  it("goes back to the credentials card", () => {
    render(<AuthScreen />);
    fireEvent.click(
      screen.getByRole("button", { name: "auth.forgotPassword" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "auth.resetRequest.back" }),
    );

    expect(screen.getByRole("button", { name: "auth.signIn" })).toBeTruthy();
  });

  it("sets the new password from a recovery link and hands the app back", async () => {
    const onRecoveryComplete = vi.fn();
    render(<AuthScreen recovery onRecoveryComplete={onRecoveryComplete} />);

    expect(screen.getByText("auth.recovery.heading")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("auth.recovery.newPassword"), {
      target: { value: "correct-horse" },
    });
    fireEvent.change(screen.getByLabelText("auth.recovery.confirmPassword"), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "auth.recovery.submit" }),
    );

    await waitFor(() =>
      expect(state.updatePassword).toHaveBeenCalledWith("correct-horse"),
    );
    expect(onRecoveryComplete).toHaveBeenCalled();
  });

  it("keeps a mistyped confirmation off the recovery request", async () => {
    const onRecoveryComplete = vi.fn();
    render(<AuthScreen recovery onRecoveryComplete={onRecoveryComplete} />);
    fireEvent.change(screen.getByLabelText("auth.recovery.newPassword"), {
      target: { value: "correct-horse" },
    });
    fireEvent.change(screen.getByLabelText("auth.recovery.confirmPassword"), {
      target: { value: "correct-hosre" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "auth.recovery.submit" }),
    );

    expect(
      await screen.findByText("settings.account.errors.mismatch"),
    ).toBeTruthy();
    expect(state.updatePassword).not.toHaveBeenCalled();
    expect(onRecoveryComplete).not.toHaveBeenCalled();
  });
});
