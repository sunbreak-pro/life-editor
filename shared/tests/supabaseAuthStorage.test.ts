import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAuthStorage } from "../src/services/supabaseAuthStorage";

/*
 * #838 — platform-aware Supabase auth-session storage.
 *
 * resolveAuthStorage reads the Electron preload bridge from a host-injected
 * runtime global, so each case installs it on jsdom's window and cleans it up
 * after.
 */

interface MutableWindowGlobals {
  desktop?: unknown;
}

const win = window as unknown as MutableWindowGlobals;

afterEach(() => {
  delete win.desktop;
});

describe("resolveAuthStorage", () => {
  it("returns undefined on plain web (supabase-js keeps its localStorage default)", () => {
    expect(resolveAuthStorage()).toBeUndefined();
  });

  it("wraps the Electron preload bridge when window.desktop.authStorage exists", async () => {
    const bridge = {
      getItem: vi.fn().mockResolvedValue("stored-session"),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
    };
    win.desktop = { authStorage: bridge };

    const storage = resolveAuthStorage();
    expect(storage).toBeDefined();
    await expect(storage!.getItem("sb-x-auth-token")).resolves.toBe(
      "stored-session",
    );
    await storage!.setItem("sb-x-auth-token", "next-session");
    await storage!.removeItem("sb-x-auth-token");
    expect(bridge.getItem).toHaveBeenCalledWith("sb-x-auth-token");
    expect(bridge.setItem).toHaveBeenCalledWith(
      "sb-x-auth-token",
      "next-session",
    );
    expect(bridge.removeItem).toHaveBeenCalledWith("sb-x-auth-token");
  });
});
