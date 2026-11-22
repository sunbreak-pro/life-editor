import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Where the "reset your password" email sends the user back to. Without a
 * redirectTo the link lands on Supabase's default URL, where there is no
 * screen to set the new password on, and nothing else in the app notices.
 */

const auth = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn() }));

vi.mock("../src/services/supabaseClient", () => ({
  getSupabaseClient: () => ({ auth }),
}));

const { authRedirectUrl, sendPasswordResetEmail } =
  await import("../src/services/SupabaseAuth");

beforeEach(() => {
  vi.clearAllMocks();
  auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendPasswordResetEmail", () => {
  it("sends the link back to the origin the request was made from", async () => {
    const result = await sendPasswordResetEmail("me@example.com");

    expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("me@example.com", {
      redirectTo: authRedirectUrl(),
    });
    expect(authRedirectUrl()).toBe(window.location.origin);
    expect(result).toEqual({ error: null });
  });

  // The packaged Desktop runs on file://, which Supabase cannot redirect to.
  it("sends the link to the public web build when there is no web origin", async () => {
    vi.stubGlobal("window", {
      location: { protocol: "file:", origin: "null" },
    });

    await sendPasswordResetEmail("me@example.com");

    const redirectTo: unknown =
      auth.resetPasswordForEmail.mock.calls[0]?.[1]?.redirectTo;
    expect(redirectTo).toBe(authRedirectUrl());
    expect(redirectTo).toMatch(/^https:\/\//);
  });
});
