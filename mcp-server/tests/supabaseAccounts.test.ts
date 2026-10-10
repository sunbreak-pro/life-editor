// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * One Supabase sign-in per account (#2146, plan R8).
 *
 * The confirmation-only account's items must never land in the owner's data, so
 * `getSupabase()` has to hand a gateway call the account its caller is bound
 * to — and, in a Worker isolate serving overlapping requests, hand each of two
 * interleaved calls its own. createClient is replaced so no network is needed.
 */

const signIns: string[] = [];
vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string) => ({
    auth: {
      signInWithPassword: async ({ email }: { email: string }) => {
        signIns.push(email);
        // Yield, so two concurrent sign-ins genuinely overlap.
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { data: { user: { id: `user-of-${email}` } }, error: null };
      },
    },
    from: () => ({}),
    __url: url,
  }),
}));

const { configureSupabase, getSupabase, resetSupabaseForTests } =
  await import("../src/supabase.js");
const { runAs } = await import("../src/callerContext.js");

const owner = {
  url: "https://example.supabase.co",
  anonKey: "anon",
  email: "owner@example.com",
  password: "p1",
};
const review = { ...owner, email: "review@example.com", password: "p2" };
const as = (account: "owner" | "review") => ({
  app: "subscrecorder",
  account,
  scopes: ["read", "write"] as const,
});

afterEach(() => {
  resetSupabaseForTests();
  signIns.length = 0;
});

describe("getSupabase picks the account of the caller", () => {
  it("is the owner outside the gateway, as before", async () => {
    configureSupabase(owner);
    expect((await getSupabase()).userId).toBe("user-of-owner@example.com");
  });

  it("is the owner for an owner-bound app and the review account for a review-bound one", async () => {
    configureSupabase(owner);
    configureSupabase(review, "review");

    const ownerSession = await runAs(as("owner"), () => getSupabase());
    const reviewSession = await runAs(as("review"), () => getSupabase());
    expect(ownerSession.userId).toBe("user-of-owner@example.com");
    expect(reviewSession.userId).toBe("user-of-review@example.com");
    expect(ownerSession.client).not.toBe(reviewSession.client);
  });

  it("keeps two overlapping calls on their own accounts", async () => {
    configureSupabase(owner);
    configureSupabase(review, "review");

    const [a, b, c, d] = await Promise.all([
      runAs(as("review"), () => getSupabase()),
      runAs(as("owner"), () => getSupabase()),
      runAs(as("review"), () => getSupabase()),
      runAs(as("owner"), () => getSupabase()),
    ]);
    expect([a, b, c, d].map((s) => s.userId)).toEqual([
      "user-of-review@example.com",
      "user-of-owner@example.com",
      "user-of-review@example.com",
      "user-of-owner@example.com",
    ]);
    // One sign-in per account, however many calls shared it.
    expect(signIns.sort()).toEqual(["owner@example.com", "review@example.com"]);
  });

  it("never falls back to the owner when the review account is not configured", async () => {
    configureSupabase(owner);
    await expect(runAs(as("review"), () => getSupabase())).rejects.toThrow(
      /review account/,
    );
    expect(signIns).not.toContain("owner@example.com");
  });

  it("drops only the account whose credentials changed", async () => {
    configureSupabase(owner);
    configureSupabase(review, "review");
    const first = await runAs(as("owner"), () => getSupabase());

    configureSupabase({ ...review, password: "rotated" }, "review");
    const second = await runAs(as("owner"), () => getSupabase());
    expect(second.client).toBe(first.client); // the owner's session survived
  });
});
