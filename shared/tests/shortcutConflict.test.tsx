import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ShortcutConfigProvider } from "../src/context/ShortcutConfigContext";
import { useShortcutConfig } from "../src/hooks/useShortcutConfig";
import type { ShortcutConfigContextValue } from "../src/context/ShortcutConfigContextValue";

/*
 * The rebind dialog refuses a key another action already owns, but it can only
 * refuse what findConflict reports. bindingsConflict is pinned as a unit in
 * shortcutBinding.test.ts; this suite pins the WIRING, because the mismatch
 * behind the bug only appears once the DEFAULTS (several stored as `key`) are
 * compared against a captured binding (always stored as `code`).
 */

const STORAGE_KEY = "life-editor-shortcut-config";

function mountShortcuts(): ShortcutConfigContextValue {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ShortcutConfigProvider>{children}</ShortcutConfigProvider>
  );
  const { result } = renderHook(() => useShortcutConfig(), { wrapper });
  const value = result.current;
  if (!value) throw new Error("ShortcutConfigProvider did not provide a value");
  return value;
}

beforeEach(() => {
  localStorage.clear();
});

describe("ShortcutConfigProvider — findConflict", () => {
  it("reports the default that already owns the captured key", () => {
    // Ctrl+2 exactly as the dialog captures it, offered to the Todo row.
    const conflict = mountShortcuts().findConflict(
      { code: "Digit2", meta: true },
      "nav:tasks",
    );
    expect(conflict?.id).toBe("nav:daily");
  });

  it("reports an existing OVERRIDE, not only the defaults", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ "nav:notes": { code: "Digit9", meta: true } }),
    );
    const conflict = mountShortcuts().findConflict(
      { code: "Digit9", meta: true },
      "nav:tasks",
    );
    expect(conflict?.id).toBe("nav:notes");
  });

  it("does not report the row being rebound against itself", () => {
    const conflict = mountShortcuts().findConflict(
      { code: "Digit2", meta: true },
      "nav:daily",
    );
    expect(conflict).toBeUndefined();
  });

  it("leaves a key nothing owns free", () => {
    const conflict = mountShortcuts().findConflict(
      { code: "Digit9", meta: true },
      "nav:tasks",
    );
    expect(conflict).toBeUndefined();
  });
});
