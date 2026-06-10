import { describe, it, expect } from "vitest";
import {
  bindingToDisplayString,
  matchBinding,
  bindingsEqual,
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

describe("bindingsEqual", () => {
  it("treats undefined modifiers as false", () => {
    expect(bindingsEqual({ code: "KeyK", meta: true }, { code: "KeyK", meta: true })).toBe(
      true,
    );
    expect(
      bindingsEqual(
        { code: "KeyK", meta: true },
        { code: "KeyK", meta: true, shift: false },
      ),
    ).toBe(true);
  });

  it("distinguishes different keys / modifiers", () => {
    expect(bindingsEqual({ key: "n" }, { key: "m" })).toBe(false);
    expect(
      bindingsEqual({ code: "KeyZ", meta: true }, { code: "KeyZ", meta: true, shift: true }),
    ).toBe(false);
  });
});
