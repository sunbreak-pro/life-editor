import { describe, it, expect } from "vitest";
import { isImeComposing } from "../src/utils/imeGuard";

/*
 * The one IME guard every keydown handler asks (#737).
 *
 * It replaced two rival spellings — some handlers read `isComposing` alone,
 * others read it together with keyCode 229 — and the difference was not
 * cosmetic: on WebKit (macOS + iOS, this project's main target) the Enter that
 * CONFIRMS a Japanese conversion arrives with `isComposing: false` and keyCode
 * 229, so the shorter spelling let exactly the keypress that matters through
 * and saved a half-typed draft.
 *
 * jsdom has no input method, so the fields are set on the event here rather
 * than produced by a real conversion — what is pinned is the decision, not the
 * IME. Real-device behaviour still needs a browser (see the PR body).
 */

/** A native keydown, as a document listener or ProseMirror handler sees it. */
const native = (over: Partial<KeyboardEvent>) =>
  ({ isComposing: false, keyCode: 13, ...over }) as KeyboardEvent;

/** React's synthetic shape: `isComposing` lives on the native event only. */
const synthetic = (over: Partial<KeyboardEvent>) => ({
  nativeEvent: native(over),
});

describe("isImeComposing", () => {
  it("is false for a plain Enter", () => {
    expect(isImeComposing(native({}))).toBe(false);
    expect(isImeComposing(synthetic({}))).toBe(false);
  });

  it("is true while a composition is open", () => {
    expect(isImeComposing(native({ isComposing: true }))).toBe(true);
    expect(isImeComposing(synthetic({ isComposing: true }))).toBe(true);
  });

  it("is true for the confirming Enter WebKit reports with keyCode 229", () => {
    // The whole reason the guard is two conditions: the flag is already back to
    // false by the time this arrives, and treating it as a command commits a
    // draft the user was still writing.
    expect(isImeComposing(native({ isComposing: false, keyCode: 229 }))).toBe(
      true,
    );
    expect(
      isImeComposing(synthetic({ isComposing: false, keyCode: 229 })),
    ).toBe(true);
  });

  it("reads the native event, not the synthetic wrapper", () => {
    // React does not surface `isComposing` on its synthetic event at all, so a
    // guard that looked at the wrapper would silently always answer "no".
    const e = { nativeEvent: native({ isComposing: true }) };
    expect(isImeComposing(e)).toBe(true);
  });
});
