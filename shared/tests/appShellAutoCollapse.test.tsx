import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AppShell, RightSidebarToggle } from "../src/components";
import {
  MAIN_MIN_WIDTH_PX,
  shouldAutoCollapseNav,
} from "../src/components/AppShell";
import { RightSidebarProvider } from "../src/context";

/*
 * #2544 — at 768px the expanded nav (270px at the default 18px root) and the
 * right sidebar's own 240px floor left <main> 258px. While the panel is open
 * and <main> would drop under 320px, the shell folds the nav to its rail for
 * display only: the stored collapsed key is never written by the fold.
 *
 * jsdom has no layout, so these cases pin the decision through the widths the
 * shell computes from (window.innerWidth, the root font size, the stored panel
 * width), not through anything measured.
 */

const COLLAPSED_KEY = "life-editor.shell.sidebar-collapsed";
const PANEL_WIDTH_KEY = "life-editor.shell.right-sidebar-width";

const LABELS = {
  appName: "Life Editor",
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
  signOut: "Sign out",
  more: "More",
  moreTitle: "More",
  moreClose: "Close",
};

const PANEL_LABELS = {
  title: "Details",
  close: "Close details",
  empty: "Nothing selected",
  resize: "Resize details",
};

const ORIGINAL_INNER_WIDTH = window.innerWidth;

function setWindowWidth(px: number): void {
  window.innerWidth = px;
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

function renderShell(): void {
  render(
    <RightSidebarProvider>
      <AppShell
        sections={[{ id: "schedule", label: "Schedule", icon: <span /> }]}
        activeSection="schedule"
        onNavigate={vi.fn()}
        userEmail="user@example.com"
        onSignOut={vi.fn()}
        labels={LABELS}
        detailPanelLabels={PANEL_LABELS}
        header={
          <RightSidebarToggle
            variant="panel"
            openLabel="Open details"
            closeLabel="Hide details"
          />
        }
      >
        <p>section body</p>
      </AppShell>
    </RightSidebarProvider>,
  );
}

const openPanel = (): void => {
  fireEvent.click(screen.getByRole("button", { name: "Open details" }));
};

const navIsRail = (): boolean =>
  screen.queryByRole("button", { name: "Expand sidebar" }) !== null;

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  } satisfies Partial<MediaQueryList>);
  document.documentElement.style.fontSize = "18px";
  window.innerWidth = 768;
});

afterEach(() => {
  // @ts-expect-error — clear the stub between tests.
  delete window.matchMedia;
  document.documentElement.style.fontSize = "";
  window.innerWidth = ORIGINAL_INNER_WIDTH;
  localStorage.clear();
});

describe("shouldAutoCollapseNav (#2544)", () => {
  it.each([
    // [window, root font px, stored panel width, folds]
    [768, 18, 320, true], // the reported case: 768 - 270 - 240 = 258
    [768, 16, 240, true], // 768 - 240 - 240 = 288
    [800, 16, 240, false], // 800 - 240 - 240 = 320, exactly the floor
    [829, 18, 560, true], // row 559 → panel 240 → main 319
    [830, 18, 560, false], // row 560 → panel 240 → main 320
    [1000, 18, 560, false], // the cap shrinks the panel to 240 → main 490
    [1280, 18, 560, false], // the panel keeps 490, <main> keeps 520
    [1280, 25, 560, false], // the largest font step still leaves room
  ])(
    "window %ipx, root %ipx, panel %ipx → folds=%s",
    (windowWidth, rootFontPx, rightSidebarWidth, folds) => {
      expect(
        shouldAutoCollapseNav({ windowWidth, rootFontPx, rightSidebarWidth }),
      ).toBe(folds);
    },
  );

  it("leaves <main> at least the floor once the nav is a rail", () => {
    // 768px at the default root: rail 72px, panel 240px.
    expect(768 - 4 * 18 - 240).toBeGreaterThanOrEqual(MAIN_MIN_WIDTH_PX);
  });
});

describe("AppShell auto-folds the nav for the right sidebar (#2544)", () => {
  it("folds the expanded nav while the panel is open at 768px", () => {
    renderShell();
    expect(navIsRail()).toBe(false);

    openPanel();
    expect(navIsRail()).toBe(true);
    // Display only: the user's choice was never written.
    expect(localStorage.getItem(COLLAPSED_KEY)).toBeNull();
  });

  it("gives the nav back when the panel closes, storage untouched", () => {
    renderShell();
    openPanel();
    expect(navIsRail()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Hide details" }));
    expect(navIsRail()).toBe(false);
    expect(localStorage.getItem(COLLAPSED_KEY)).toBeNull();
  });

  it("gives the nav back when the window widens past the floor", () => {
    renderShell();
    openPanel();
    expect(navIsRail()).toBe(true);

    setWindowWidth(1280);
    expect(navIsRail()).toBe(false);

    setWindowWidth(768);
    expect(navIsRail()).toBe(true);
    expect(localStorage.getItem(COLLAPSED_KEY)).toBeNull();
  });

  it("re-decides when the font-size step changes the root font size", async () => {
    window.innerWidth = 810;
    renderShell();
    openPanel();
    // 18px root: 810 - 270 - 240 = 300, under the floor, so it folds.
    expect(navIsRail()).toBe(true);

    await act(async () => {
      document.documentElement.style.fontSize = "16px";
      // MutationObserver callbacks run as a microtask.
      await Promise.resolve();
    });
    // 16px root: 810 - 240 - 240 = 330, so the user's nav comes back.
    expect(navIsRail()).toBe(false);
  });

  it("does not fold at 1280px", () => {
    localStorage.setItem(PANEL_WIDTH_KEY, JSON.stringify(560));
    window.innerWidth = 1280;
    renderShell();
    openPanel();
    expect(navIsRail()).toBe(false);
  });

  it("expanding the folded nav closes the panel instead of storing a choice", () => {
    renderShell();
    openPanel();
    expect(navIsRail()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(
      screen.queryByRole("complementary", { name: "Details" }),
    ).not.toBeInTheDocument();
    expect(navIsRail()).toBe(false);
    expect(localStorage.getItem(COLLAPSED_KEY)).toBeNull();
  });

  it("keeps a nav the user collapsed collapsed, and the toggle still stores it", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(localStorage.getItem(COLLAPSED_KEY)).toBe("true");

    openPanel();
    // The user's own rail: expanding it is a real choice, panel stays open.
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(localStorage.getItem(COLLAPSED_KEY)).toBe("false");
    expect(
      screen.getByRole("complementary", { name: "Details" }),
    ).toBeInTheDocument();
    // …and since that leaves <main> too narrow, the fold takes over again.
    expect(navIsRail()).toBe(true);
  });
});
