import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useGlobalShortcuts,
  resolveShortcut,
  isEditableTarget,
  hasAccelerator,
  isActiveInInput,
} from "../src/hooks/useGlobalShortcuts";
import { matchBinding } from "../src/utils/shortcutBinding";
import { DEFAULT_SHORTCUTS } from "../src/constants/defaultShortcuts";
import type { ShortcutId } from "../src/types/shortcut";
import type { ShortcutConfigContextValue } from "../src/context/ShortcutConfigContextValue";

/*
 * W3-0 global shortcut executor. Tests the pure dispatch + guard helpers
 * (resolveShortcut / isEditableTarget / hasAccelerator) without React. The
 * matcher is the real config behaviour, built from DEFAULT_SHORTCUTS so the
 * test mirrors what ShortcutConfigProvider.matchEvent does (override ?? default
 * → matchBinding).
 */

// matchEvent stand-in mirroring ShortcutConfigProvider.matchEvent over defaults.
function defaultMatchEvent(e: KeyboardEvent, id: ShortcutId): boolean {
  const binding = DEFAULT_SHORTCUTS.find((s) => s.id === id)?.defaultBinding;
  return binding ? matchBinding(e, binding) : false;
}

const ALL_IDS: readonly ShortcutId[] = DEFAULT_SHORTCUTS.map((s) => s.id);

type EvtOver = Partial<
  Pick<
    KeyboardEvent,
    | "key"
    | "code"
    | "metaKey"
    | "ctrlKey"
    | "shiftKey"
    | "altKey"
    | "isComposing"
  >
>;

function evt(over: EvtOver) {
  return {
    key: "",
    code: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    isComposing: false,
    ...over,
  } as KeyboardEvent;
}

describe("hasAccelerator", () => {
  it("is true for meta or ctrl, false otherwise", () => {
    expect(hasAccelerator(evt({ metaKey: true }))).toBe(true);
    expect(hasAccelerator(evt({ ctrlKey: true }))).toBe(true);
    expect(hasAccelerator(evt({ shiftKey: true }))).toBe(false);
    expect(hasAccelerator(evt({}))).toBe(false);
  });
});

describe("isActiveInInput (QA #2 — definition-driven flag)", () => {
  it("reads activeInInput from the matching definition", () => {
    // settings is activeInInput:true; new-todo is false (defaults).
    expect(isActiveInInput("global:settings")).toBe(true);
    expect(isActiveInInput("global:new-task")).toBe(false);
  });

  it("mirrors every definition's flag exactly (no hardcoded drift)", () => {
    for (const def of DEFAULT_SHORTCUTS) {
      expect(isActiveInInput(def.id)).toBe(def.activeInInput);
    }
  });

  it("defaults to false for an unknown id", () => {
    expect(isActiveInInput("does:not-exist" as ShortcutId)).toBe(false);
  });
});

describe("isEditableTarget", () => {
  it("detects input / textarea / select", () => {
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(document.createElement("select"))).toBe(true);
  });

  it("detects contentEditable elements", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    Object.defineProperty(div, "isContentEditable", { value: true });
    expect(isEditableTarget(div)).toBe(true);
  });

  it("is false for non-editable elements and null", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("resolveShortcut", () => {
  it("resolves the settings accelerator", () => {
    const id = resolveShortcut(
      evt({ code: "Comma", metaKey: true }),
      null,
      ALL_IDS,
      defaultMatchEvent,
    );
    expect(id).toBe("global:settings");
  });

  it("resolves a nav shortcut (Cmd+1 → nav:tasks)", () => {
    const id = resolveShortcut(
      evt({ key: "1", metaKey: true }),
      null,
      ALL_IDS,
      defaultMatchEvent,
    );
    expect(id).toBe("nav:tasks");
  });

  it("resolves bare 'n' (new-todo) when not in an input", () => {
    const id = resolveShortcut(
      evt({ key: "n" }),
      document.createElement("div"),
      ALL_IDS,
      defaultMatchEvent,
    );
    expect(id).toBe("global:new-task");
  });

  it("IME guard: returns null while composing", () => {
    // An accelerator that WOULD match outside composition, so the null comes
    // from the guard and not from a missing binding.
    const id = resolveShortcut(
      evt({ code: "Comma", metaKey: true, isComposing: true }),
      null,
      ALL_IDS,
      defaultMatchEvent,
    );
    expect(id).toBeNull();
  });

  it("input guard: suppresses bare 'n' while typing in an input", () => {
    const id = resolveShortcut(
      evt({ key: "n" }),
      document.createElement("input"),
      ALL_IDS,
      defaultMatchEvent,
    );
    expect(id).toBeNull();
  });

  it("input guard: accelerator shortcuts STILL fire while typing", () => {
    const id = resolveShortcut(
      evt({ code: "Comma", metaKey: true }),
      document.createElement("input"),
      ALL_IDS,
      defaultMatchEvent,
    );
    expect(id).toBe("global:settings");
  });

  it("returns null when nothing matches", () => {
    const id = resolveShortcut(
      evt({ key: "x" }),
      null,
      ALL_IDS,
      defaultMatchEvent,
    );
    expect(id).toBeNull();
  });

  it("distinguishes redo (Cmd+Shift+Z) from undo (Cmd+Z)", () => {
    expect(
      resolveShortcut(
        evt({ code: "KeyZ", metaKey: true, shiftKey: true }),
        null,
        ALL_IDS,
        defaultMatchEvent,
      ),
    ).toBe("edit:redo");
    expect(
      resolveShortcut(
        evt({ code: "KeyZ", metaKey: true }),
        null,
        ALL_IDS,
        defaultMatchEvent,
      ),
    ).toBe("edit:undo");
  });

  it("input guard is flag-driven (QA #2): suppresses an activeInInput:false match while typing", () => {
    // Force a custom activeInInput map: pretend nav:tasks is NOT active in
    // input, even though it's an accelerator. The flag — not hasAccelerator —
    // now drives the guard, so it must be suppressed inside an input.
    const id = resolveShortcut(
      evt({ key: "1", metaKey: true }),
      document.createElement("input"),
      ALL_IDS,
      defaultMatchEvent,
      (sid) => sid !== "nav:tasks", // nav:tasks → false
    );
    expect(id).toBeNull();
  });

  it("input guard is flag-driven (QA #2): allows an activeInInput:true bare key while typing", () => {
    // A bare 'n' shortcut that the flag map declares active-in-input now fires
    // even though it has no accelerator — proving the old accelerator-only
    // inference was replaced by the definition flag.
    const id = resolveShortcut(
      evt({ key: "n" }),
      document.createElement("input"),
      ALL_IDS,
      defaultMatchEvent,
      (sid) => sid === "global:new-task", // make new-todo active-in-input
    );
    expect(id).toBe("global:new-task");
  });

  it("respects the matcher (rebind: Cmd+J now maps to a custom id)", () => {
    // Simulate a rebound config where nav:notes is moved to Cmd+J.
    const rebind = vi.fn((e: KeyboardEvent, id: ShortcutId) =>
      id === "nav:notes"
        ? matchBinding(e, { code: "KeyJ", meta: true })
        : defaultMatchEvent(e, id),
    );
    const id = resolveShortcut(
      evt({ code: "KeyJ", metaKey: true }),
      null,
      ALL_IDS,
      rebind,
    );
    expect(id).toBe("nav:notes");
  });
});

/*
 * #2719 — the command palette is gone, and with it the Cmd+K / Ctrl+K
 * binding. No default binding sits on K any more, so the key resolves to
 * nothing; the settings accelerator next to it still dispatches end to end on
 * `window`, which shows the null above is not a dead listener.
 */
describe("useGlobalShortcuts — no palette binding (#2719)", () => {
  const config = {
    matchEvent: defaultMatchEvent,
  } as unknown as ShortcutConfigContextValue;

  it.each([
    ["Ctrl+K", { ctrlKey: true }],
    ["Cmd+K", { metaKey: true }],
  ])("%s resolves to no shortcut", (_name, mods) => {
    expect(
      resolveShortcut(evt({ key: "k", code: "KeyK", ...mods }), null, ALL_IDS, defaultMatchEvent),
    ).toBeNull();
  });

  it("no default binding is a palette id", () => {
    expect(DEFAULT_SHORTCUTS.map((s) => s.id)).not.toContain(
      "global:command-palette",
    );
  });

  it.each([
    ["Ctrl+K", { ctrlKey: true }],
    ["Cmd+K", { metaKey: true }],
  ])("%s calls no handler, while Cmd+Comma still opens settings", (_name, mods) => {
    const handlers = {
      onOpenSettings: vi.fn(),
      onNewTodo: vi.fn(),
      onNavigate: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
    };
    const { unmount } = renderHook(() => useGlobalShortcuts(config, handlers));
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", code: "KeyK", ...mods }),
    );
    for (const fn of Object.values(handlers)) {
      expect(fn).not.toHaveBeenCalled();
    }
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: ",", code: "Comma", metaKey: true }),
    );
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
    unmount();
  });
});
