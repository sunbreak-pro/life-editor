import { describe, it, expect } from "vitest";
import { isImeComposing } from "./imeSafe";

describe("isImeComposing", () => {
  it("returns true for a React synthetic event composing via nativeEvent", () => {
    const e = {
      nativeEvent: { isComposing: true },
    } as unknown as React.KeyboardEvent;
    expect(isImeComposing(e)).toBe(true);
  });

  it("returns false for a React synthetic event not composing", () => {
    const e = {
      nativeEvent: { isComposing: false },
    } as unknown as React.KeyboardEvent;
    expect(isImeComposing(e)).toBe(false);
  });

  it("returns true for a raw DOM KeyboardEvent composing", () => {
    const e = { isComposing: true } as unknown as KeyboardEvent;
    expect(isImeComposing(e)).toBe(true);
  });

  it("returns false for a raw DOM KeyboardEvent not composing", () => {
    const e = { isComposing: false } as unknown as KeyboardEvent;
    expect(isImeComposing(e)).toBe(false);
  });

  it("returns an explicit boolean false when isComposing is absent on both shapes", () => {
    const e = {} as unknown as KeyboardEvent;
    const result = isImeComposing(e);
    expect(result).toBe(false);
    expect(typeof result).toBe("boolean");
  });

  it("prefers nativeEvent.isComposing over a raw isComposing fallback", () => {
    // React synthetic events expose both; nativeEvent must win.
    const e = {
      isComposing: false,
      nativeEvent: { isComposing: true },
    } as unknown as React.KeyboardEvent;
    expect(isImeComposing(e)).toBe(true);
  });

  it("falls back to raw isComposing when nativeEvent is undefined", () => {
    const e = {
      nativeEvent: undefined,
      isComposing: true,
    } as unknown as React.KeyboardEvent;
    expect(isImeComposing(e)).toBe(true);
  });
});
