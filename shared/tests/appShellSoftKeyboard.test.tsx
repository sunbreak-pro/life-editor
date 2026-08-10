import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AppShell, type AppShellSection } from "../src/components";

/*
 * #608 — on a phone the bottom tab bar fought the soft keyboard: it rode up
 * with the shrinking viewport and covered the text the user was typing. The
 * shell now stands the bar down while the keyboard is on screen.
 *
 * jsdom has neither matchMedia nor visualViewport, so both are stubbed: the
 * first pins the narrow layout, the second plays the keyboard. What this file
 * can pin is the DECISION (bar rendered / not rendered) — jsdom has no layout,
 * so the resulting look is a 👀 gate on a real phone, not something a test can
 * answer (CLAUDE.md §7.1).
 */

const Dot = () => <span data-testid="icon">•</span>;

const SECTIONS: AppShellSection[] = [
  { id: "tasks", label: "Tasks", icon: <Dot /> },
  { id: "daily", label: "Daily", icon: <Dot /> },
  { id: "notes", label: "Notes", icon: <Dot /> },
  { id: "schedule", label: "Schedule", icon: <Dot /> },
  { id: "settings", label: "Settings", icon: <Dot /> },
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
  // @ts-expect-error — minimal MediaQueryList stub for tests.
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

/** Stands in for the phone's viewport; `setHeight` plays the keyboard. */
function mockVisualViewport(height: number) {
  const listeners = new Set<() => void>();
  const vv = {
    width: 390,
    height,
    offsetTop: 0,
    offsetLeft: 0,
    addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) =>
      listeners.delete(fn),
  };
  Object.defineProperty(window, "visualViewport", {
    value: vv,
    configurable: true,
    writable: true,
  });
  return {
    setHeight(next: number) {
      act(() => {
        vv.height = next;
        listeners.forEach((fn) => fn());
      });
    },
  };
}

function renderShell() {
  render(
    <AppShell
      sections={SECTIONS}
      activeSection="notes"
      onNavigate={vi.fn()}
      onTogglePalette={vi.fn()}
      userEmail="user@example.com"
      onSignOut={vi.fn()}
      labels={LABELS}
    >
      <p>section body</p>
    </AppShell>,
  );
}

const tabBar = () => screen.queryByRole("navigation", { name: "More" });

afterEach(() => {
  // @ts-expect-error — clear the stubs between tests.
  delete window.matchMedia;
  // @ts-expect-error — same.
  delete window.visualViewport;
  localStorage.clear();
});

describe("AppShell narrow — soft keyboard (#608)", () => {
  it("hides the bottom tab bar while the keyboard is up and brings it back after", () => {
    mockMatchMedia(false);
    const viewport = mockVisualViewport(844);
    renderShell();

    expect(tabBar()).toBeInTheDocument();

    // Keyboard opens: the visible area loses ~340px.
    viewport.setHeight(500);
    expect(tabBar()).not.toBeInTheDocument();
    // The section body is untouched — the bar steps aside, the screen does not.
    expect(screen.getByText("section body")).toBeInTheDocument();

    viewport.setHeight(844);
    expect(tabBar()).toBeInTheDocument();
  });

  it("ignores a shrink the size of a browser toolbar", () => {
    mockMatchMedia(false);
    const viewport = mockVisualViewport(844);
    renderShell();

    // The address bar sliding back in is not a keyboard; hiding navigation for
    // it would make the bar flicker on every scroll.
    viewport.setHeight(784);
    expect(tabBar()).toBeInTheDocument();
  });

  it("keeps the bar when the platform has no visualViewport at all", () => {
    mockMatchMedia(false);
    renderShell(); // no visualViewport stub — older browsers, jsdom, Electron

    expect(tabBar()).toBeInTheDocument();
  });
});
