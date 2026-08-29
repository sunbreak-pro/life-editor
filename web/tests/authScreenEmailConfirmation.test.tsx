import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthScreen } from "../src/AuthScreen";

/*
 * #1197 — what the auth screen does when "Confirm email" is ON.
 *
 * With the setting on, signUp succeeds and returns NO session. Before this,
 * that landed in the `noSession` error branch: the account had been created,
 * the mail was already sent, and the screen told the user something had gone
 * wrong. These cases pin the third outcome — neither an error nor a way in —
 * and the two error messages that only exist because of it.
 *
 * The setting itself is never read: the shape of the signUp result is the only
 * signal, which is what lets the owner flip the toggle without a deploy.
 */

const state = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updatePassword: vi.fn(),
  resendConfirmationEmail: vi.fn(),
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
    resendConfirmationEmail: state.resendConfirmationEmail,
  };
});

const EMAIL = "me@example.com";
const PASSWORD = "correct-horse-battery";

/** Fill the sign-up form and submit it. */
function signUpWith(email = EMAIL) {
  fireEvent.click(screen.getByRole("radio", { name: "auth.signUp" }));
  fireEvent.change(screen.getByLabelText("auth.email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("auth.password"), {
    target: { value: PASSWORD },
  });
  fireEvent.click(screen.getByRole("button", { name: "auth.signUp" }));
}

describe("AuthScreen — email confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resendConfirmationEmail.mockResolvedValue({ error: null });
  });

  it("shows the pending-confirmation card, not an error, when signUp starts no session", async () => {
    state.signUp.mockResolvedValue({
      error: null,
      session: null,
      pendingConfirmation: true,
    });
    render(<AuthScreen />);
    signUpWith("  me@example.com  ");

    expect(await screen.findByText("auth.confirm.heading")).toBeTruthy();
    // The address is printed so a typo in it is visible, trimmed the same way
    // it was handed to signUp.
    expect(screen.getByText(EMAIL)).toBeTruthy();
    expect(screen.queryByText("auth.errors.noSession")).toBeNull();
  });

  it("leaves the screen alone when confirmation is off and a session comes back", async () => {
    state.signUp.mockResolvedValue({
      error: null,
      session: { user: { email: EMAIL } },
      pendingConfirmation: false,
    });
    render(<AuthScreen />);
    signUpWith();

    await waitFor(() => expect(state.signUp).toHaveBeenCalled());
    expect(screen.queryByText("auth.confirm.heading")).toBeNull();
    expect(screen.queryByText("auth.errors.noSession")).toBeNull();
  });

  it("resends the link to the address the account was created with", async () => {
    state.signUp.mockResolvedValue({
      error: null,
      session: null,
      pendingConfirmation: true,
    });
    render(<AuthScreen />);
    signUpWith();
    await screen.findByText("auth.confirm.heading");

    fireEvent.click(screen.getByRole("button", { name: "auth.confirm.resend" }));

    await waitFor(() =>
      expect(state.resendConfirmationEmail).toHaveBeenCalledWith(EMAIL),
    );
    expect(await screen.findByText("auth.confirm.sent")).toBeTruthy();
  });

  it("reports a failed resend without losing the card", async () => {
    state.signUp.mockResolvedValue({
      error: null,
      session: null,
      pendingConfirmation: true,
    });
    state.resendConfirmationEmail.mockResolvedValue({
      error: "rate limit exceeded",
    });
    render(<AuthScreen />);
    signUpWith();
    await screen.findByText("auth.confirm.heading");

    fireEvent.click(screen.getByRole("button", { name: "auth.confirm.resend" }));

    expect(await screen.findByText("auth.confirm.error")).toBeTruthy();
    expect(screen.getByText("auth.confirm.heading")).toBeTruthy();
  });

  it("goes back to a clean sign-in form", async () => {
    state.signUp.mockResolvedValue({
      error: null,
      session: null,
      pendingConfirmation: true,
    });
    render(<AuthScreen />);
    signUpWith();
    await screen.findByText("auth.confirm.heading");

    fireEvent.click(screen.getByRole("button", { name: "auth.confirm.back" }));

    // Sign-in mode, not sign-up: the account exists now, so registering again
    // is not the next step.
    expect(screen.getByRole("button", { name: "auth.signIn" })).toBeTruthy();
    expect(
      (screen.getByLabelText("auth.password") as HTMLInputElement).value,
    ).toBe("");
  });

  it("explains an unconfirmed sign-in instead of blaming the password", async () => {
    state.signIn.mockResolvedValue({
      error: "Email not confirmed",
      session: null,
    });
    render(<AuthScreen />);
    fireEvent.change(screen.getByLabelText("auth.email"), {
      target: { value: EMAIL },
    });
    fireEvent.change(screen.getByLabelText("auth.password"), {
      target: { value: PASSWORD },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.signIn" }));

    expect(
      await screen.findByText("auth.errors.emailNotConfirmed"),
    ).toBeTruthy();
  });
});
