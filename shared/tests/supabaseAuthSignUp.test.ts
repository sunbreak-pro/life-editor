import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * #1197 — signUp's third outcome and the resend that goes with it.
 *
 * With "Confirm email" ON, Supabase answers a successful signUp with a user
 * and NO session. Read as `!session`, that is indistinguishable from a
 * failure, which is exactly how the screen used to report it. These cases pin
 * the distinction, and the redirect target that decides where the mailed link
 * lands (without it, the link goes to Supabase's default and the user ends up
 * anywhere but the app).
 */

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
}));

vi.mock("../src/services/supabaseClient", () => ({
  getSupabaseClient: () => ({ auth }),
}));

const { signUp, resendConfirmationEmail, authRedirectUrl } = await import(
  "../src/services/SupabaseAuth"
);

const USER = { id: "u1", email: "me@example.com" };
const SESSION = { access_token: "t", user: USER };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signUp", () => {
  it("reports a confirmation wait when the account exists but no session was started", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: USER, session: null },
      error: null,
    });

    const result = await signUp("me@example.com", "correct-horse-battery");

    expect(result.error).toBeNull();
    expect(result.session).toBeNull();
    expect(result.pendingConfirmation).toBe(true);
  });

  it("does not report a wait when confirmation is off and a session comes back", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: USER, session: SESSION },
      error: null,
    });

    const result = await signUp("me@example.com", "correct-horse-battery");

    expect(result.session).toBe(SESSION);
    expect(result.pendingConfirmation).toBe(false);
  });

  it("does not report a wait when the call failed outright", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Password should be at least 12 characters" },
    });

    const result = await signUp("me@example.com", "short");

    expect(result.error).toBe("Password should be at least 12 characters");
    expect(result.pendingConfirmation).toBe(false);
  });

  it("tells Supabase where the confirmation link should land", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: USER, session: null },
      error: null,
    });

    await signUp("me@example.com", "correct-horse-battery");

    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { emailRedirectTo: authRedirectUrl() },
      }),
    );
  });
});

describe("resendConfirmationEmail", () => {
  it("asks for the signup mail again, with the same landing target", async () => {
    auth.resend.mockResolvedValue({ error: null });

    const result = await resendConfirmationEmail("me@example.com");

    expect(result.error).toBeNull();
    expect(auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "me@example.com",
      options: { emailRedirectTo: authRedirectUrl() },
    });
  });

  it("surfaces the failure message so the screen can decide what to say", async () => {
    auth.resend.mockResolvedValue({ error: { message: "rate limit" } });

    expect(await resendConfirmationEmail("me@example.com")).toEqual({
      error: "rate limit",
    });
  });
});
