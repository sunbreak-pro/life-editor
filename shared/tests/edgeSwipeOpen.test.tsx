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

/**
 * A touchmove jsdom can build. jsdom has no TouchEvent constructor either, so
 * the touch list is attached by hand — `touches.length` and `clientX/clientY`
 * are the whole surface the hook reads.
 */
function touchMove(
  clientX: number,
  clientY: number,
  count = 1,
): Event & { touches: unknown } {
  const event = new Event("touchmove", { bubbles: true, cancelable: true });
  const touches = Array.from({ length: count }, () => ({ clientX, clientY }));
  Object.defineProperty(event, "touches", { value: touches });
  return event as Event & { touches: unknown };
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

  it("survives an 8px vertical wobble at the head of a rightward pull", () => {
    // #1204: the old one-sample axis lock read this wobble as "vertical" and
    // dropped the press for good, so the 80px pull that followed did nothing.
    const onOpen = renderProbe();
    fireEvent(window, pointerEvent("pointerdown", 4, 300));
    fireEvent(window, pointerEvent("pointermove", 4, 308));
    fireEvent(window, pointerEvent("pointermove", 84, 300));
    fireEvent(window, pointerEvent("pointerup", 84, 300));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("opens on a diagonal whose dx and dy arrive equal", () => {
    // #1204: `dx > dy` was false at exactly 45°, so a diagonal pull off the
    // edge never committed to either axis and released as nothing.
    const onOpen = renderProbe();
    fireEvent(window, pointerEvent("pointerdown", 4, 300));
    fireEvent(window, pointerEvent("pointermove", 14, 310));
    fireEvent(window, pointerEvent("pointermove", 84, 370));
    fireEvent(window, pointerEvent("pointerup", 84, 370));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("stands down when shouldStart vetoes the press", () => {
    const onOpen = renderProbe(() => false);
    swipeFrom(4, 300, { dx: 120 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("never cancels the pointer stream, so the press still reaches the page", () => {
    renderProbe();
    const down = pointerEvent("pointerdown", 4, 300);
    fireEvent(window, down);
    const move = pointerEvent("pointermove", 60, 300);
    fireEvent(window, move);
    expect(down.defaultPrevented).toBe(false);
    expect(move.defaultPrevented).toBe(false);
  });
});

/*
 * #1204: on a real finger the browser claimed the pan and cancelled the pointer
 * stream at ~20px, so the threshold above was unreachable. These pin the one
 * place the hook now cancels anything — and, more importantly, the three places
 * it still must not.
 */
describe("useEdgeSwipeOpen touch defence", () => {
  it("holds the browser off for an edge-born rightward touch", () => {
    renderProbe();
    fireEvent(window, pointerEvent("pointerdown", 4, 300));
    const move = touchMove(24, 302);
    fireEvent(window, move);
    expect(move.defaultPrevented).toBe(true);
  });

  it("leaves a touch that started away from the edge alone", () => {
    renderProbe();
    fireEvent(window, pointerEvent("pointerdown", 200, 300));
    const move = touchMove(320, 300);
    fireEvent(window, move);
    expect(move.defaultPrevented).toBe(false);
  });

  it("leaves vertical scrolling alone from its very first sample", () => {
    renderProbe();
    fireEvent(window, pointerEvent("pointerdown", 4, 300));
    // Undecided, but leaning vertical: the browser keeps the gesture.
    const first = touchMove(4, 306);
    fireEvent(window, first);
    expect(first.defaultPrevented).toBe(false);
    // …and once it is unmistakably a scroll, the press is gone for good.
    const later = touchMove(4, 340);
    fireEvent(window, later);
    expect(later.defaultPrevented).toBe(false);
  });

  it("never fights a second finger — pinch and zoom stay the browser's", () => {
    renderProbe();
    fireEvent(window, pointerEvent("pointerdown", 4, 300));
    const move = touchMove(60, 300, 2);
    fireEvent(window, move);
    expect(move.defaultPrevented).toBe(false);
  });

  it("refuses the native drag a leftover text selection would start", () => {
    renderProbe();
    fireEvent(window, pointerEvent("pointerdown", 4, 300));
    const tracked = new Event("dragstart", { bubbles: true, cancelable: true });
    fireEvent(window, tracked);
    expect(tracked.defaultPrevented).toBe(true);

    fireEvent(window, pointerEvent("pointerup", 4, 300));
    const idle = new Event("dragstart", { bubbles: true, cancelable: true });
    fireEvent(window, idle);
    expect(idle.defaultPrevented).toBe(false);
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
