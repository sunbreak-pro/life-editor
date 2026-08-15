import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AppShell, type AppShellSection } from "../src/components";

/*
 * #608 — on a phone the bottom tab bar fought the soft keyboard: it rode up
 * with the shrinking viewport and covered the text the user was typing. The
 * shell now stands the bar down while the keyboard is on screen.
 *
 * #874 changed HOW it stands down: invisible, not unmounted. Unmounting handed
 * the bar's height back to <main>, so opening the keyboard re-flowed the whole
 * screen — visible as a lurch behind any panel the user was typing into. So
 * these tests now check that the bar keeps its BOX and loses its paint.
 *
 * jsdom has neither matchMedia nor visualViewport, so both are stubbed: the
 * first pins the narrow layout, the second plays the keyboard. What this file
 * can pin is the DECISION (bar painted / not painted) — jsdom has no layout,
 * so the resulting look is a 👀 gate on a real phone, not something a test can
 * answer (CLAUDE.md §7.1).
 *
 * The stand-down reads as a class rather than as `toBeVisible()` or a dropped
 * role for one reason: no Tailwind stylesheet is loaded here, so `invisible`
 * computes to nothing and jsdom still reports the bar as shown. In a browser
 * the same class is `visibility: hidden`, which does take the bar out of the
 * accessibility tree and the tab order — that part is the 👀 gate's to confirm.
 */

const Dot = () => <span data-testid="icon">•</span>;

const SECTIONS: AppShellSection[] = [
  { id: "todos", label: "Todos", icon: <Dot /> },
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
  // A bare vi.fn() is untyped, so the partial stub needs no suppression;
  // `satisfies` keeps the shape checked against the real interface (#711).
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  } satisfies Partial<MediaQueryList>);
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

/**
 * The stand-down wrapper the shell puts around the bar. Read off the bar rather
 * than by a test id: the wrapper exists to reserve layout, and a hook added
 * just for the test would be a second reason for it to exist.
 */
const tabBarBox = () => tabBar()?.parentElement ?? null;

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

    expect(tabBarBox()).not.toHaveClass("invisible");

    // Keyboard opens: the visible area loses ~340px.
    viewport.setHeight(500);
    expect(tabBarBox()).toHaveClass("invisible");
    // The section body is untouched — the bar steps aside, the screen does not.
    expect(screen.getByText("section body")).toBeInTheDocument();

    viewport.setHeight(844);
    expect(tabBarBox()).not.toHaveClass("invisible");
  });

  it("keeps the bar's box in the layout while it is stood down (#874)", () => {
    mockMatchMedia(false);
    const viewport = mockVisualViewport(844);
    renderShell();

    viewport.setHeight(500);

    /*
     * The bar is still MOUNTED — this is the whole fix. Unmount it and <main>
     * grows into the freed strip, which is the re-flow #874 was reported as:
     * the page appearing to heave up behind an open panel the moment the
     * keyboard arrives.
     */
    expect(tabBar()).toBeInTheDocument();
    expect(tabBarBox()).toHaveClass("shrink-0");
  });

  it("ignores a shrink the size of a browser toolbar", () => {
    mockMatchMedia(false);
    const viewport = mockVisualViewport(844);
    renderShell();

    // The address bar sliding back in is not a keyboard; hiding navigation for
    // it would make the bar flicker on every scroll.
    viewport.setHeight(784);
    expect(tabBarBox()).not.toHaveClass("invisible");
  });

  it("keeps the bar when the platform has no visualViewport at all", () => {
    mockMatchMedia(false);
    renderShell(); // no visualViewport stub — older browsers, jsdom, Electron

    expect(tabBar()).toBeInTheDocument();
    expect(tabBarBox()).not.toHaveClass("invisible");
  });
});
