import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAuthStorage } from "../src/services/supabaseAuthStorage";

/*
 * #838 — platform-aware Supabase auth-session storage.
 *
 * resolveAuthStorage reads host-injected runtime globals (Electron preload
 * bridge / Capacitor native bridge), so each case installs the global it
 * needs on jsdom's window and cleans it up after.
 */

interface MutableWindowGlobals {
  desktop?: unknown;
  Capacitor?: unknown;
}

const win = window as unknown as MutableWindowGlobals;

afterEach(() => {
  delete win.desktop;
  delete win.Capacitor;
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

  it("wraps Capacitor Preferences on the native mobile shell", async () => {
    const preferences = {
      get: vi.fn().mockResolvedValue({ value: "mobile-session" }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    win.Capacitor = {
      isNativePlatform: () => true,
      Plugins: { Preferences: preferences },
    };

    const storage = resolveAuthStorage();
    expect(storage).toBeDefined();
    await expect(storage!.getItem("sb-x-auth-token")).resolves.toBe(
      "mobile-session",
    );
    await storage!.setItem("sb-x-auth-token", "next-session");
    await storage!.removeItem("sb-x-auth-token");
    expect(preferences.get).toHaveBeenCalledWith({ key: "sb-x-auth-token" });
    expect(preferences.set).toHaveBeenCalledWith({
      key: "sb-x-auth-token",
      value: "next-session",
    });
    expect(preferences.remove).toHaveBeenCalledWith({ key: "sb-x-auth-token" });
  });

  it("falls back to the default when the native shell lacks the Preferences plugin", () => {
    win.Capacitor = { isNativePlatform: () => true, Plugins: {} };
    expect(resolveAuthStorage()).toBeUndefined();
  });

  it("does not treat a non-native Capacitor global (web build of Capacitor) as mobile", () => {
    const preferences = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    win.Capacitor = {
      isNativePlatform: () => false,
      Plugins: { Preferences: preferences },
    };
    expect(resolveAuthStorage()).toBeUndefined();
  });
});
