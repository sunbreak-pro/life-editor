import { describe, it, expect } from "vitest";
import { noteUpdatesToPatch } from "../src/services/noteMapper";

/*
 * Password-safety contract (A audit Top5 #4). noteUpdatesToPatch mirrors
 * the Tauri note_repository::update whitelist EXACTLY: only
 * title/content/isPinned/color/icon may flow through this path. The
 * security-critical invariant is that a content/title save can NEVER emit
 * `password_hash` (or any other column) into the patch, so an UPSERT/PATCH
 * built from it cannot null or clobber a note's password.
 */

describe("noteUpdatesToPatch — partial-payload / password safety", () => {
  it("emits only whitelisted keys for a content save", () => {
    const patch = noteUpdatesToPatch({ content: "new body" });
    expect(patch).toEqual({ content: "new body" });
    expect(Object.keys(patch)).toEqual(["content"]);
  });

  it("never includes password_hash / has_password even if smuggled in", () => {
    // Cast through unknown: simulate an over-broad caller object. The
    // whitelist must drop everything that is not title/content/isPinned/
    // color/icon.
    const sneaky = {
      title: "t",
      password_hash: "$2b$hacked",
      has_password: false,
      version: 999,
    } as unknown as Parameters<typeof noteUpdatesToPatch>[0];
    const patch = noteUpdatesToPatch(sneaky);
    expect(patch).toEqual({ title: "t" });
    expect("password_hash" in patch).toBe(false);
    expect("has_password" in patch).toBe(false);
    expect("version" in patch).toBe(false);
  });

  it("omits untouched columns (partial update never clobbers)", () => {
    const patch = noteUpdatesToPatch({ isPinned: true });
    expect(patch).toEqual({ is_pinned: true });
    // title/content absent -> a PATCH cannot null them.
    expect("title" in patch).toBe(false);
    expect("content" in patch).toBe(false);
  });

  it("maps color/icon presence (including explicit null) without other keys", () => {
    expect(noteUpdatesToPatch({ color: null })).toEqual({ color: null });
    expect(noteUpdatesToPatch({ icon: "star" })).toEqual({ icon: "star" });
  });

  it("ignores undefined values for title/content/isPinned", () => {
    const patch = noteUpdatesToPatch({
      title: undefined,
      content: undefined,
      isPinned: undefined,
    });
    expect(patch).toEqual({});
  });
});
