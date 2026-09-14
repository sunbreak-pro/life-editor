import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * #1624 — the display name lives in Supabase Auth's user_metadata.
 *
 * Two things are worth pinning here. What reaches `updateUser`: an empty field
 * has to be stored as null (that is how a user goes back to their address),
 * and a name padded with spaces must not be stored padded. And what the
 * sidebar reads back: a missing, blank or non-string value falls back to the
 * address rather than rendering an empty row.
 */

const auth = vi.hoisted(() => ({
  updateUser: vi.fn(),
}));

vi.mock("../src/services/supabaseClient", () => ({
  getSupabaseClient: () => ({ auth }),
}));

const { updateDisplayName } = await import("../src/services/SupabaseAuth");
const {
  accountDisplayLabel,
  normalizeDisplayName,
  readDisplayName,
  DISPLAY_NAME_METADATA_KEY,
} = await import("../src/utils/profile");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateDisplayName", () => {
  it("writes the trimmed name under the metadata key", async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: null });

    const result = await updateDisplayName("  Kodai  ");

    expect(result.error).toBeNull();
    expect(auth.updateUser).toHaveBeenCalledWith({
      data: { [DISPLAY_NAME_METADATA_KEY]: "Kodai" },
    });
  });

  it("stores an empty field as null so the address shows again", async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: null });

    await updateDisplayName("   ");

    expect(auth.updateUser).toHaveBeenCalledWith({
      data: { [DISPLAY_NAME_METADATA_KEY]: null },
    });
  });

  it("passes Supabase's message through on failure", async () => {
    auth.updateUser.mockResolvedValue({
      data: {},
      error: { message: "network down" },
    });

    const result = await updateDisplayName("Kodai");

    expect(result.error).toBe("network down");
  });
});

describe("display name helpers", () => {
  it("normalizes blank input to null", () => {
    expect(normalizeDisplayName("")).toBeNull();
    expect(normalizeDisplayName(" \t ")).toBeNull();
    expect(normalizeDisplayName(" 太郎 ")).toBe("太郎");
  });

  it("reads only a non-empty string", () => {
    expect(readDisplayName(null)).toBe("");
    expect(readDisplayName({ user_metadata: {} })).toBe("");
    expect(
      readDisplayName({ user_metadata: { [DISPLAY_NAME_METADATA_KEY]: 42 } }),
    ).toBe("");
    expect(
      readDisplayName({
        user_metadata: { [DISPLAY_NAME_METADATA_KEY]: " 太郎 " },
      }),
    ).toBe("太郎");
  });

  it("labels the account by name, falling back to the address", () => {
    const email = "me@example.com";
    expect(accountDisplayLabel({ email, user_metadata: {} })).toBe(email);
    expect(
      accountDisplayLabel({
        email,
        user_metadata: { [DISPLAY_NAME_METADATA_KEY]: "  " },
      }),
    ).toBe(email);
    expect(
      accountDisplayLabel({
        email,
        user_metadata: { [DISPLAY_NAME_METADATA_KEY]: "Kodai" },
      }),
    ).toBe("Kodai");
    expect(accountDisplayLabel(undefined)).toBe("");
  });
});
