// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { isNativeMobile } from "../src/utils/platform";

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
