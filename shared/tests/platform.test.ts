// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { isMacDesktopShell, isNativeMobile } from "../src/utils/platform";

/*
 * isNativeMobile() decides whether the web host mounts the Mobile 省略
 * Provider / UI (#320), so pin its contract: it reads the window.Capacitor
 * runtime global (deliberately NOT an @capacitor/* import — platform.ts) and
 * resolves false everywhere outside the native WebView. The SSR branch
 * (typeof window === "undefined" → false) is not exercisable under jsdom.
 */

type TestWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

const win = window as unknown as TestWindow;

afterEach(() => {
  delete win.Capacitor;
});

describe("isNativeMobile", () => {
  it("returns false when window.Capacitor is absent (browser / Electron)", () => {
    expect(isNativeMobile()).toBe(false);
  });

  it("returns false when Capacitor lacks isNativePlatform", () => {
    win.Capacitor = {};
    expect(isNativeMobile()).toBe(false);
  });

  it("mirrors Capacitor.isNativePlatform() inside the native WebView", () => {
    win.Capacitor = { isNativePlatform: () => true };
    expect(isNativeMobile()).toBe(true);
    win.Capacitor = { isNativePlatform: () => false };
    expect(isNativeMobile()).toBe(false);
  });
});

/*
 * isMacDesktopShell() gates the macOS title-bar drag band (#1590). It reads the
 * shell's own `window.desktop.platform` rather than the userAgent, because the
 * userAgent says "Macintosh" for a browser tab on macOS too — and a tab has a
 * real title bar, so the band would be 28px of dead space at the top of the web
 * app. Pin both directions.
 */

type DesktopTestWindow = Window & { desktop?: { platform?: string } };

const desktopWin = window as unknown as DesktopTestWindow;

afterEach(() => {
  delete desktopWin.desktop;
});

describe("isMacDesktopShell", () => {
  it("returns false in a browser tab, macOS userAgent or not", () => {
    expect(isMacDesktopShell()).toBe(false);
  });

  it("returns true only for the macOS shell", () => {
    desktopWin.desktop = { platform: "darwin" };
    expect(isMacDesktopShell()).toBe(true);
  });

  it("returns false for the Windows and Linux shells", () => {
    desktopWin.desktop = { platform: "win32" };
    expect(isMacDesktopShell()).toBe(false);
    desktopWin.desktop = { platform: "linux" };
    expect(isMacDesktopShell()).toBe(false);
  });

  it("returns false for a desktop build from before the field existed", () => {
    desktopWin.desktop = {};
    expect(isMacDesktopShell()).toBe(false);
  });
});
