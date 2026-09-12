import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell, type AppShellSection } from "../src/components";

/*
 * #1590 — the macOS drag band.
 *
 * macOS hides the title bar in this shell (`titleBarStyle: "hiddenInset"`) but
 * keeps drawing the traffic lights, so the renderer owes them a strip of their
 * own; the same strip is what the window is dragged by, a frameless window
 * having nothing else to grab. Both halves are asserted here: that the band
 * appears for the macOS shell, and — the part that protects Web / Windows /
 * Capacitor — that it appears for nobody else.
 *
 * jsdom has no layout, so its 28px is not observable here (the band's height is
 * pinned against the shell's own offset in desktop/tests/macTitleBar.test.ts).
 * What is observable is whether the element is in the tree at all, which is the
 * regression that would break Web: the band shipping to every host.
 */

const Dot = () => <span data-testid="icon">•</span>;

const SECTIONS: AppShellSection[] = [
  { id: "todos", label: "Todos", icon: <Dot /> },
  { id: "notes", label: "Notes", icon: <Dot /> },
];

const LABELS = {
  appName: "Life Editor",
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
  commandPalette: "Command palette",
  signOut: "Sign out",
  more: "More",
  moreTitle: "More",
  moreClose: "Close",
};

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  } satisfies Partial<MediaQueryList>);
}

type TestWindow = Window & { desktop?: { platform?: string } };
const win = window as unknown as TestWindow;

function renderShell() {
  render(
    <AppShell
      sections={SECTIONS}
      activeSection="todos"
      onNavigate={vi.fn()}
      onTogglePalette={vi.fn()}
      userEmail="u@example.com"
      onSignOut={vi.fn()}
      labels={LABELS}
    >
      <div>body</div>
    </AppShell>,
  );
}

const band = () => document.querySelector('[data-mac-titlebar="drag"]');

afterEach(() => {
  delete win.desktop;
  vi.restoreAllMocks();
});

describe("AppShell macOS title-bar band (#1590)", () => {
  it("reserves a drag band on the macOS desktop shell", () => {
    mockMatchMedia(true);
    win.desktop = { platform: "darwin" };
    renderShell();

    const el = band();
    expect(el).not.toBeNull();
    expect(el?.className).toContain("h-lumen-titlebar-mac");
    // The whole point of the strip: the window can be dragged by it.
    expect(el?.className).toContain("[-webkit-app-region:drag]");
    // Nothing inside it — a drag region swallows clicks on its children, so a
    // control that moved in here would read as dead (contract in AppShell).
    expect(el?.childElementCount).toBe(0);
    // Decoration, not content: it must not appear in the accessibility tree.
    expect(el?.getAttribute("aria-hidden")).toBe("true");
    // The shell still renders everything it did before.
    expect(screen.getByText("body")).toBeDefined();
    expect(screen.getByText("Todos")).toBeDefined();
  });

  it("leaves the Web layout alone when there is no desktop bridge", () => {
    mockMatchMedia(true);
    renderShell();
    expect(band()).toBeNull();
  });

  it("leaves the Windows and Linux shells alone", () => {
    mockMatchMedia(true);
    win.desktop = { platform: "win32" };
    renderShell();
    expect(band()).toBeNull();
  });

  it("leaves an older desktop build without the field alone", () => {
    // A build from before the preload exposed `platform` still has
    // `window.desktop`. Absence has to mean "no mac chrome", not a throw.
    mockMatchMedia(true);
    win.desktop = {};
    expect(() => renderShell()).not.toThrow();
    expect(band()).toBeNull();
  });

  it("does not reach the narrow layout", () => {
    // The desktop window's minWidth is 800 (main/index.ts), so the narrow
    // branch is a phone / Capacitor concern where there are no traffic lights.
    mockMatchMedia(false);
    win.desktop = { platform: "darwin" };
    renderShell();
    expect(band()).toBeNull();
  });
});
