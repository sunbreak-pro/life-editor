import { describe, it, expect } from "vitest";
import {
  bindingToDisplayString,
  matchBinding,
  bindingsConflict,
  eventToBinding,
} from "../src/utils/shortcutBinding";
import type { KeyBinding } from "../src/types/shortcut";

/*
 * W1 shortcut keybinding helpers. Pure logic extracted from
 * ShortcutConfigContext so display / match / conflict can be pinned without
 * React. Covers happy path + the mac/win modifier-symbol branch + the
 * "no extra modifier" exact-match rule (a binding without meta must NOT match
 * an event that has meta held).
 */

describe("bindingToDisplayString", () => {
  it("renders mac modifier symbols + code label", () => {
    const b: KeyBinding = { code: "KeyK", meta: true };
    expect(bindingToDisplayString(b, true)).toBe("⌘ + K");
  });

  it("renders windows modifier words for the same binding", () => {
    const b: KeyBinding = { code: "KeyZ", meta: true, shift: true };
    expect(bindingToDisplayString(b, false)).toBe("Ctrl + Shift + Z");
  });

  it("maps named keys (Space / arrows) and uppercases bare keys", () => {
    expect(bindingToDisplayString({ key: " " }, true)).toBe("Space");
    expect(bindingToDisplayString({ key: "ArrowLeft" }, true)).toBe("←");
    expect(bindingToDisplayString({ key: "n" }, true)).toBe("N");
  });

  it("strips the Key prefix for unmapped codes", () => {
    expect(bindingToDisplayString({ code: "KeyB" }, true)).toBe("B");
  });

  /*
   * #1483: a rebound shortcut is captured as `code` (eventToBinding), while
   * the nav DEFAULTS are stored as `key`. The settings sheet lists both, so
   * the digit row has to read the same either way — it used to print the raw
   * "Digit2" next to a default's "2".
   */
  it("labels digit codes with the digit (rebound rows match the defaults)", () => {
    expect(bindingToDisplayString({ code: "Digit9", meta: true }, false)).toBe(
      "Ctrl + 9",
    );
    expect(bindingToDisplayString({ code: "Digit2", meta: true }, true)).toBe(
      bindingToDisplayString({ key: "2", meta: true }, true),
    );
  });

  it("labels numpad digits with the digit", () => {
    expect(bindingToDisplayString({ code: "Numpad9" }, true)).toBe("9");
  });

  it("labels punctuation codes with the printed character", () => {
    expect(bindingToDisplayString({ code: "Slash" }, true)).toBe("/");
    expect(bindingToDisplayString({ code: "Minus" }, true)).toBe("-");
    expect(bindingToDisplayString({ code: "BracketLeft" }, true)).toBe("[");
  });

  it("keeps a code it has no rule for rather than emptying the chip", () => {
    expect(bindingToDisplayString({ code: "F5" }, true)).toBe("F5");
  });
});

function evt(
  over: Partial<
    Pick<
      KeyboardEvent,
      "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
    >
  >,
): Pick<
  KeyboardEvent,
  "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
> {
  return {
    key: "",
    code: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...over,
  };
}

describe("matchBinding", () => {
  it("matches a meta+code binding when meta is held", () => {
    expect(
      matchBinding(evt({ code: "KeyK", metaKey: true }), {
        code: "KeyK",
        meta: true,
      }),
    ).toBe(true);
  });

  it("treats ctrl as the meta equivalent (web cross-platform)", () => {
    expect(
      matchBinding(evt({ code: "KeyK", ctrlKey: true }), {
        code: "KeyK",
        meta: true,
      }),
    ).toBe(true);
  });

  it("rejects when an unexpected modifier is held", () => {
    // binding has no meta -> event with meta must NOT match
    expect(
      matchBinding(evt({ key: "n", metaKey: true }), { key: "n" }),
    ).toBe(false);
  });

  it("requires shift to be present when the binding asks for it", () => {
    expect(
      matchBinding(evt({ code: "KeyZ", metaKey: true }), {
        code: "KeyZ",
        meta: true,
        shift: true,
      }),
    ).toBe(false);
  });

  it("matches on key when no code is set", () => {
    expect(matchBinding(evt({ key: "n" }), { key: "n" })).toBe(true);
  });
});

describe("eventToBinding", () => {
  it("captures meta + code (round-trips through matchBinding)", () => {
    const e = evt({ code: "KeyK", metaKey: true });
    const b = eventToBinding(e);
    expect(b).toEqual({ code: "KeyK", meta: true });
    expect(matchBinding(e, b)).toBe(true);
  });

  it("maps ctrl to meta (web accelerator equivalence)", () => {
    expect(eventToBinding(evt({ code: "KeyK", ctrlKey: true }))).toEqual({
      code: "KeyK",
      meta: true,
    });
  });

  it("captures all held modifiers (meta + shift + alt)", () => {
    expect(
      eventToBinding(
        evt({ code: "KeyZ", metaKey: true, shiftKey: true, altKey: true }),
      ),
    ).toEqual({ code: "KeyZ", meta: true, shift: true, alt: true });
  });

  it("prefers code over key, omits unset modifiers", () => {
    expect(eventToBinding(evt({ key: "n", code: "KeyN" }))).toEqual({
      code: "KeyN",
    });
  });

  it("falls back to key when code is empty", () => {
    expect(eventToBinding(evt({ key: "Enter", code: "" }))).toEqual({
      key: "Enter",
    });
  });
});

describe("bindingsConflict", () => {
  it("treats undefined modifiers as false", () => {
    expect(
      bindingsConflict(
        { code: "KeyK", meta: true },
        { code: "KeyK", meta: true },
      ),
    ).toBe(true);
    expect(
      bindingsConflict(
        { code: "KeyK", meta: true },
        { code: "KeyK", meta: true, shift: false },
      ),
    ).toBe(true);
  });

  it("distinguishes different keys / modifiers", () => {
    expect(bindingsConflict({ key: "n" }, { key: "m" })).toBe(false);
    expect(
      bindingsConflict(
        { code: "KeyZ", meta: true },
        { code: "KeyZ", meta: true, shift: true },
      ),
    ).toBe(false);
  });

  /*
   * The bug: a rebind is captured as `code`, the nav DEFAULTS are stored as
   * `key`. Comparing those two structurally said "free", so Ctrl+2 could end
   * up on two actions at once even though matchBinding fires on both.
   */
  it("sees the code and key spellings of one physical key as one key", () => {
    expect(
      bindingsConflict({ code: "Digit2", meta: true }, { key: "2", meta: true }),
    ).toBe(true);
    expect(bindingsConflict({ code: "KeyN" }, { key: "n" })).toBe(true);
    expect(bindingsConflict({ code: "Numpad2" }, { key: "2" })).toBe(true);
  });

  it("treats ctrl and meta as one accelerator (matchBinding does)", () => {
    expect(
      bindingsConflict(
        { code: "KeyK", ctrl: true },
        { code: "KeyK", meta: true },
      ),
    ).toBe(true);
  });

  it("keeps a bare key clear of the same key held with the accelerator", () => {
    expect(bindingsConflict({ key: "n" }, { key: "n", meta: true })).toBe(false);
  });

  it("never collides on a binding that names no key", () => {
    expect(bindingsConflict({ meta: true }, { meta: true })).toBe(false);
  });
});
