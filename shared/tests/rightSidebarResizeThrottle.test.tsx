import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { RightSidebar } from "../src/components/RightSidebar";
import { RightSidebarContext } from "../src/context/RightSidebarContextValue";
import type { RightSidebarContextValue } from "../src/context/RightSidebarContextValue";

/*
 * #1103 — the resize handle commits at most one width per frame.
 *
 * Why this is worth pinning: `setWidth` is `useLocalStorage`'s setter, so every
 * call is a React state update AND a synchronous JSON.stringify + setItem. On
 * top of that RightSidebarContext keeps `width` in the same memoized value as
 * `open` / `close`, so one commit re-renders every consumer of that context —
 * NotesView and KanbanView included. Unthrottled, a single drag paid all of
 * that once per pointermove.
 *
 * The seam is the Provider, not a spy on internals: we hand the component a
 * hand-built context whose `setWidth` is a vi.fn(), which gives an exact call
 * count with no production-code seam (same pattern as
 * web/tests/briefingNarrowTray.test.tsx).
 *
 * Two jsdom traps this file works around, both already documented elsewhere in
 * the suite:
 *   1. jsdom has no PointerEvent, so `fireEvent.pointerMove(el, { clientX })`
 *      falls back to a plain Event and SILENTLY drops clientX — the width then
 *      computes to NaN and every assertion passes vacuously. We dispatch a real
 *      MouseEvent instead (shared/tests/weekTimeGrid.test.tsx:180-196).
 *   2. jsdom implements none of the pointer-capture methods, and
 *      RightSidebar's pointerdown calls setPointerCapture unguarded, so it
 *      throws without the prototype stubs below.
 */

const LABELS = {
  title: "Details",
  emptyLabel: "Nothing selected yet",
  resizeLabel: "Resize details panel",
};

/** The aside's right edge, pinned by hand — jsdom has no layout (all rects 0). */
const RIGHT_EDGE = 1000;
const START_WIDTH = 320;

function renderPanel() {
  const setWidth = vi.fn();
  const value: RightSidebarContextValue = {
    isOpen: true,
    open: () => {},
    close: () => {},
    requestClose: () => {},
    toggle: () => {},
    width: START_WIDTH,
    setWidth,
    portalTarget: null,
    setPortalTarget: () => {},
    contentCount: 0,
    registerContent: () => () => {},
  };
  const utils = render(
    <RightSidebarContext.Provider value={value}>
      <RightSidebar {...LABELS} />
    </RightSidebarContext.Provider>,
  );
  const handle = screen.getByRole("separator", { name: LABELS.resizeLabel });
  const aside = handle.closest("aside");
  if (!aside) throw new Error("the panel did not render an <aside>");
  aside.getBoundingClientRect = () =>
    ({
      right: RIGHT_EDGE,
      left: 0,
      top: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return { ...utils, setWidth, handle };
}

/** Width the component computes for a pointer at `clientX` (right edge − x). */
const widthAt = (clientX: number) => RIGHT_EDGE - clientX;

function firePointer(el: Element, type: string, clientX: number) {
  act(() => {
    el.dispatchEvent(
      new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY: 0 }),
    );
  });
}

describe("RightSidebar resize throttle (#1103)", () => {
  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => true);
    // vitest's fake timers pick up rAF/cAF automatically when they exist, and
    // vitest's jsdom env defines them (pretendToBeVisual defaults to true).
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(Element.prototype, "setPointerCapture");
    Reflect.deleteProperty(Element.prototype, "releasePointerCapture");
    Reflect.deleteProperty(Element.prototype, "hasPointerCapture");
  });

  it("commits at most one width per frame, and the last move in the frame wins", () => {
    const { setWidth, handle } = renderPanel();

    firePointer(handle, "pointerdown", 680);
    firePointer(handle, "pointermove", 700);
    firePointer(handle, "pointermove", 690);
    firePointer(handle, "pointermove", 680);

    // The "0 before" half is what makes this a throttle test rather than a
    // call-count test: an implementation that fired on the first move and threw
    // the rest away would also report 1.
    expect(setWidth).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersToNextFrame();
    });

    expect(setWidth).toHaveBeenCalledTimes(1);
    expect(setWidth).toHaveBeenLastCalledWith(widthAt(680));
  });

  it("does not drop the release position, and cancels the frame it queued", () => {
    const { setWidth, handle } = renderPanel();

    firePointer(handle, "pointerdown", 680);
    firePointer(handle, "pointermove", 700);
    firePointer(handle, "pointerup", 700);

    // Flushed synchronously by the gesture ending — not left in the ref.
    expect(setWidth).toHaveBeenCalledTimes(1);
    expect(setWidth).toHaveBeenLastCalledWith(widthAt(700));

    act(() => {
      vi.advanceTimersByTime(32);
    });

    // The queued frame was cancelled, so it cannot re-apply the same width.
    expect(setWidth).toHaveBeenCalledTimes(1);
  });

  it("cancels a queued frame on pointercancel too", () => {
    const { setWidth, handle } = renderPanel();

    firePointer(handle, "pointerdown", 680);
    firePointer(handle, "pointermove", 690);
    firePointer(handle, "pointercancel", 690);

    expect(setWidth).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(32);
    });
    expect(setWidth).toHaveBeenCalledTimes(1);
  });

  it("cancels a queued frame when the panel unmounts mid-drag", () => {
    const { setWidth, handle, unmount } = renderPanel();

    firePointer(handle, "pointerdown", 680);
    firePointer(handle, "pointermove", 700);
    unmount();

    act(() => {
      vi.advanceTimersByTime(32);
    });

    expect(setWidth).not.toHaveBeenCalled();
  });

  it("leaves the keyboard path synchronous (one step per press)", () => {
    const { setWidth, handle } = renderPanel();

    // Guards against a later "tidy-up" routing keydown through the queue: each
    // press steps from the CURRENT width, so N presses in one frame have to be
    // N commits, not one.
    fireEvent.keyDown(handle, { key: "ArrowLeft" });

    expect(setWidth).toHaveBeenCalledTimes(1);
    expect(setWidth).toHaveBeenLastCalledWith(START_WIDTH + 16);
  });
});
