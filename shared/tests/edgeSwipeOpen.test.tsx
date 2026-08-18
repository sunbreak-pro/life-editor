import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BottomSheet,
  MobileDrawer,
  RightSidebarToggle,
} from "../src/components";
import { RightSidebarProvider } from "../src/context";
import { useEdgeSwipeOpen } from "../src/hooks/useEdgeSwipeOpen";

/*
 * Edge-swipe to open the mobile drawer (#1050).
 *
 * Driven the same way as the #792 dismiss tests: MouseEvents typed
 * "pointerdown"/etc. carrying explicit clientX/clientY, because jsdom has no
 * PointerEvent constructor and no layout at all (CLAUDE.md §7.1). The hook's
 * edge zone and threshold are fixed pixel counts for that reason — nothing
 * here may read a measured position.
 *
 * The cases that matter are the ones that must NOT fire: a press that starts
 * away from the edge, a drag that leans vertical (a list being scrolled), a
 * leftward drag, and any press at all while a sheet is on top. Those are the
 * DoD's "既存ジェスチャを奪わない" restated as tests.
 */

function pointerEvent(type: string, clientX: number, clientY: number): Event {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
}

/** One press-drag-release on window, from (x, y) by (dx, dy). */
function swipeFrom(
  x: number,
  y: number,
  { dx = 0, dy = 0 }: { dx?: number; dy?: number },
) {
  fireEvent(window, pointerEvent("pointerdown", x, y));
  // First step clears the 8px axis lock; second lands where asked.
  fireEvent(
    window,
    pointerEvent("pointermove", x + Math.sign(dx) * 10, y + Math.sign(dy) * 10),
  );
  fireEvent(window, pointerEvent("pointermove", x + dx, y + dy));
  fireEvent(window, pointerEvent("pointerup", x + dx, y + dy));
}

function Probe({
  onOpen,
  shouldStart,
}: {
  onOpen: () => void;
  shouldStart?: () => boolean;
}) {
  useEdgeSwipeOpen({ onOpen, shouldStart });
  return null;
}

function renderProbe(shouldStart?: () => boolean) {
  const onOpen = vi.fn();
  render(<Probe onOpen={onOpen} shouldStart={shouldStart} />);
  return onOpen;
}

describe("useEdgeSwipeOpen", () => {
  it("opens on a rightward drag begun at the left edge", () => {
    const onOpen = renderProbe();
    swipeFrom(4, 300, { dx: 120 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("ignores a drag that starts away from the edge", () => {
    const onOpen = renderProbe();
    // Mid-screen: this is the calendar / list territory the DoD protects.
    swipeFrom(200, 300, { dx: 120 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ignores a drag that stops short of the threshold", () => {
    const onOpen = renderProbe();
    swipeFrom(4, 300, { dx: 30 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("hands a vertical drag back — scrolling near the edge is not an open", () => {
    const onOpen = renderProbe();
    // Far past the threshold in distance, but along the axis we do not own.
    swipeFrom(4, 300, { dy: 200 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ignores a leftward drag from the edge", () => {
    const onOpen = renderProbe();
    swipeFrom(4, 300, { dx: -120 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not reconsider a press once its axis went the other way", () => {
    const onOpen = renderProbe();
    fireEvent(window, pointerEvent("pointerdown", 4, 300));
    // Commits vertical…
    fireEvent(window, pointerEvent("pointermove", 4, 320));
    // …then wanders right past the threshold. Still not ours.
    fireEvent(window, pointerEvent("pointermove", 140, 320));
    fireEvent(window, pointerEvent("pointerup", 140, 320));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("stands down when shouldStart vetoes the press", () => {
    const onOpen = renderProbe(() => false);
    swipeFrom(4, 300, { dx: 120 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("never cancels the event, so the press still reaches the page", () => {
    renderProbe();
    const down = pointerEvent("pointerdown", 4, 300);
    fireEvent(window, down);
    const move = pointerEvent("pointermove", 60, 300);
    fireEvent(window, move);
    expect(down.defaultPrevented).toBe(false);
    expect(move.defaultPrevented).toBe(false);
  });
});

const LABELS = {
  title: "Details",
  close: "Close details",
  empty: "Nothing selected yet",
};

function renderDrawer(extra?: ReactNode) {
  render(
    <RightSidebarProvider>
      <RightSidebarToggle
        variant="hamburger"
        openLabel="Open details"
        closeLabel="Hide details"
      />
      <MobileDrawer
        title={LABELS.title}
        closeLabel={LABELS.close}
        emptyLabel={LABELS.empty}
      />
      {extra}
    </RightSidebarProvider>,
  );
}

describe("MobileDrawer edge-swipe to open", () => {
  it("opens from a rightward drag at the left edge", () => {
    renderDrawer();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    swipeFrom(4, 300, { dx: 120 });
    expect(
      screen.getByRole("dialog", { name: LABELS.title }),
    ).toBeInTheDocument();
  });

  it("stays shut while a sheet is already on top", () => {
    renderDrawer(
      <BottomSheet open onClose={() => {}} title="On top" closeLabel="Close">
        <button type="button">inside</button>
      </BottomSheet>,
    );
    swipeFrom(4, 300, { dx: 120 });
    expect(
      screen.queryByRole("dialog", { name: LABELS.title }),
    ).not.toBeInTheDocument();
  });

  it("does not re-close the drawer it just opened", () => {
    renderDrawer();
    swipeFrom(4, 300, { dx: 120 });
    swipeFrom(4, 300, { dx: 120 });
    expect(
      screen.getByRole("dialog", { name: LABELS.title }),
    ).toBeInTheDocument();
  });

  it("slides in rather than appearing, with the scrim fading behind it", () => {
    renderDrawer();
    swipeFrom(4, 300, { dx: 120 });
    const dialog = screen.getByRole("dialog", { name: LABELS.title });
    expect(dialog).toHaveClass("lumen-drawer-in-left");
    expect(dialog.parentElement).toHaveClass("lumen-scrim-in");
  });
});
