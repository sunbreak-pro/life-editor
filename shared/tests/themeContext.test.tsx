import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "../src/context/ThemeContext";
import { useThemeContext } from "../src/hooks/useThemeContext";

/*
 * ThemeProvider §216 — themeMode migration + system resolution + fontFamily /
 * reduce-motion DOM reflection. jsdom has no matchMedia, so a controllable
 * stub drives the prefers-color-scheme path (same technique as
 * useMediaQuery.test.ts).
 */

function installMatchMedia(initialDark: boolean) {
  const listeners = new Set<() => void>();
  let dark = initialDark;
  const darkMql = {
    get matches() {
      return dark;
    },
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) =>
      listeners.delete(cb),
  };
  // @ts-expect-error — minimal MediaQueryList stub for tests.
  window.matchMedia = vi.fn((query: string) => {
    if (query.includes("prefers-color-scheme: dark")) {
      return darkMql;
    }
    return {
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });
  return {
    setDark(next: boolean) {
      dark = next;
      listeners.forEach((cb) => cb());
    },
  };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-reduce-motion");
  document.documentElement.style.fontFamily = "";
});

afterEach(() => {
  // @ts-expect-error — remove the test stub so other suites see jsdom's default.
  delete window.matchMedia;
});

describe("ThemeProvider §216", () => {
  it("defaults themeMode to light and ignores OS dark for the explicit default", () => {
    installMatchMedia(true); // OS prefers dark
    const { result } = renderHook(() => useThemeContext(), { wrapper });
    expect(result.current.themeMode).toBe("light");
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("migrates an existing light-editor-theme=dark into themeMode default", () => {
    localStorage.setItem("life-editor-theme", "dark");
    installMatchMedia(false);
    const { result } = renderHook(() => useThemeContext(), { wrapper });
    expect(result.current.themeMode).toBe("dark");
    expect(result.current.theme).toBe("dark");
  });

  it("resolves system mode from matchMedia and follows OS changes", () => {
    const mm = installMatchMedia(false);
    const { result } = renderHook(() => useThemeContext(), { wrapper });
    act(() => result.current.setThemeMode("system"));
    expect(result.current.theme).toBe("light");
    act(() => mm.setDark(true));
    expect(result.current.theme).toBe("dark");
    act(() => mm.setDark(false));
    expect(result.current.theme).toBe("light");
  });

  it("keeps setTheme/toggleTheme working by reflecting into themeMode", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useThemeContext(), { wrapper });
    act(() => result.current.setTheme("dark"));
    expect(result.current.themeMode).toBe("dark");
    expect(result.current.theme).toBe("dark");
    act(() => result.current.toggleTheme());
    expect(result.current.themeMode).toBe("light");
    expect(result.current.theme).toBe("light");
  });

  it("reflects reduce-motion on documentElement (system removes the attribute)", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useThemeContext(), { wrapper });
    act(() => result.current.setReduceMotion("reduce"));
    expect(document.documentElement.getAttribute("data-reduce-motion")).toBe(
      "reduce",
    );
    act(() => result.current.setReduceMotion("off"));
    expect(document.documentElement.getAttribute("data-reduce-motion")).toBe(
      "off",
    );
    act(() => result.current.setReduceMotion("system"));
    expect(document.documentElement.hasAttribute("data-reduce-motion")).toBe(
      false,
    );
  });

  it("applies font-family to documentElement (system clears the inline style)", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useThemeContext(), { wrapper });
    act(() => result.current.setFontFamily("mono"));
    expect(document.documentElement.style.fontFamily).toContain("ui-monospace");
    act(() => result.current.setFontFamily("serif"));
    expect(document.documentElement.style.fontFamily).toContain("Georgia");
    act(() => result.current.setFontFamily("system"));
    expect(document.documentElement.style.fontFamily).toBe("");
  });
});
