import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthScreen } from "../src/AuthScreen";

/*
 * What the sign-in form says after a press. The app has one user and no
 * sign-up (#2752), so this form is the only way in: a failure that shows
 * nothing, or the wrong line, leaves that user locked out without a reason.
 */

const state = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
    signIn: state.signIn,
  };
});

const SESSION = { access_token: "token" };

async function submitSignIn(): Promise<void> {
  fireEvent.change(screen.getByLabelText("auth.email"), {
    target: { value: "  me@example.com  " },
  });
  fireEvent.change(screen.getByLabelText("auth.password"), {
    target: { value: "correct-horse" },
  });
  fireEvent.click(screen.getByRole("button", { name: "auth.signIn" }));
  await waitFor(() =>
    expect(state.signIn).toHaveBeenCalledWith(
      "me@example.com",
      "correct-horse",
    ),
  );
}

/** The button is back from its busy label, so the result has been handled. */
async function settled(): Promise<void> {
  const button = await screen.findByRole("button", { name: "auth.signIn" });
  expect((button as HTMLButtonElement).disabled).toBe(false);
}

describe("AuthScreen — signing in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // A failed sign-in logs the raw message on purpose.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names the credentials when Supabase rejects them", async () => {
    state.signIn.mockResolvedValue({
      session: null,
      error: "Invalid login credentials",
    });
    render(<AuthScreen />);
    await submitSignIn();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "auth.errors.invalidCredentials",
    );
    expect(screen.queryByText("auth.errors.generic")).toBeNull();
  });

  it("reports a success that came back without a session", async () => {
    state.signIn.mockResolvedValue({ session: null, error: null });
    render(<AuthScreen />);
    await submitSignIn();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "auth.errors.generic",
    );
  });

  it("shows no error once a session is back", async () => {
    state.signIn.mockResolvedValue({ session: SESSION, error: null });
    render(<AuthScreen />);
    await submitSignIn();
    await settled();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/^auth\.errors\./)).toBeNull();
  });
});
