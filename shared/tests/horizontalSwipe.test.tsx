import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  HORIZONTAL_SWIPE_TOUCH_CLASS,
  useHorizontalSwipe,
  type HorizontalSwipeOptions,
} from "../src/hooks/useHorizontalSwipe";

/*
 * #2034 — swipe left / right to page (the Mobile month calendar).
 *
 * Driven the way swipeToDismiss.test.tsx drives #792: pointer events carrying
 * explicit clientX / clientY, built as MouseEvents because jsdom has no
 * PointerEvent constructor (React delegates on the TYPE and reads the
 * coordinates off the native event). jsdom has no layout either, which is
 * why the hook's threshold is a fixed pixel count.
 */

function pointerEvent(type: string, clientX: number, clientY: number): Event {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
}

function touchMove(clientX: number, clientY: number): Event {
  const event = new Event("touchmove", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", { value: [{ clientX, clientY }] });
  return event;
}

/** Well clear of the drawer's 44px edge zone unless a case says otherwise. */
const START_X = 200;
const START_Y = 300;

/** Press at (x, y), move in two steps (clear the axis lock, then land), release. */
function swipe(
  target: HTMLElement,
  { dx = 0, dy = 0, x = START_X }: { dx?: number; dy?: number; x?: number },
) {
  fireEvent(target, pointerEvent("pointerdown", x, START_Y));
  fireEvent(
    target,
    pointerEvent(
      "pointermove",
      x + Math.sign(dx) * 10,
      START_Y + Math.sign(dy) * 10,
    ),
  );
  fireEvent(target, pointerEvent("pointermove", x + dx, START_Y + dy));
  fireEvent(target, pointerEvent("pointerup", x + dx, START_Y + dy));
}

function Surface(
  props: Partial<HorizontalSwipeOptions> & { onCellClick?: () => void },
) {
  const handlers = useHorizontalSwipe({
    onSwipeLeft: props.onSwipeLeft ?? (() => {}),
    onSwipeRight: props.onSwipeRight ?? (() => {}),
    enabled: props.enabled,
  });
  return (
    <div
      data-testid="surface"
      className={HORIZONTAL_SWIPE_TOUCH_CLASS}
      {...handlers}
    >
      <button type="button" onClick={props.onCellClick}>
        cell
      </button>
    </div>
  );
}

function setup(props: Partial<HorizontalSwipeOptions> = {}) {
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  const onCellClick = vi.fn();
  render(
    <Surface
      onSwipeLeft={onSwipeLeft}
      onSwipeRight={onSwipeRight}
      onCellClick={onCellClick}
      {...props}
    />,
  );
  return {
    surface: screen.getByTestId("surface"),
    cell: screen.getByRole("button", { name: "cell" }),
    onSwipeLeft,
    onSwipeRight,
    onCellClick,
  };
}

describe("useHorizontalSwipe (#2034)", () => {
  it("pages forward on a leftward swipe and back on a rightward one, once each", () => {
    const h = setup();
    swipe(h.cell, { dx: -80 });
    expect(h.onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(h.onSwipeRight).not.toHaveBeenCalled();

    swipe(h.cell, { dx: 80 });
    expect(h.onSwipeRight).toHaveBeenCalledTimes(1);
    expect(h.onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a short drag that stays under the threshold", () => {
    const h = setup();
    swipe(h.cell, { dx: -40 });
    expect(h.onSwipeLeft).not.toHaveBeenCalled();
  });

  it("leaves a vertical scroll alone, even one that drifts sideways later", () => {
    const h = setup();
    swipe(h.cell, { dy: 120 });
    // Decided vertical at the first sample; a long sideways tail afterwards
    // cannot turn the same press into a page turn.
    fireEvent(h.cell, pointerEvent("pointerdown", START_X, START_Y));
    fireEvent(h.cell, pointerEvent("pointermove", START_X, START_Y + 20));
    fireEvent(h.cell, pointerEvent("pointermove", START_X - 90, START_Y + 25));
    fireEvent(h.cell, pointerEvent("pointerup", START_X - 90, START_Y + 25));
    expect(h.onSwipeLeft).not.toHaveBeenCalled();
    expect(h.onSwipeRight).not.toHaveBeenCalled();
  });

  it("lets a tap through to the cell and pages nothing", () => {
    const h = setup();
    fireEvent(h.cell, pointerEvent("pointerdown", START_X, START_Y));
    fireEvent(h.cell, pointerEvent("pointerup", START_X + 2, START_Y + 1));
    fireEvent.click(h.cell);
    expect(h.onCellClick).toHaveBeenCalledTimes(1);
    expect(h.onSwipeLeft).not.toHaveBeenCalled();
    expect(h.onSwipeRight).not.toHaveBeenCalled();
  });

  it("swallows the one click a swipe ends in, and only that one", () => {
    const h = setup();
    swipe(h.cell, { dx: -80 });
    // The browser's click after the release — on the month grid it would open
    // the drawer on whatever day the finger lifted over.
    fireEvent.click(h.cell);
    expect(h.onCellClick).not.toHaveBeenCalled();

    // The next tap is the user's again.
    fireEvent(h.cell, pointerEvent("pointerdown", START_X, START_Y));
    fireEvent(h.cell, pointerEvent("pointerup", START_X, START_Y));
    fireEvent.click(h.cell);
    expect(h.onCellClick).toHaveBeenCalledTimes(1);
  });

  it("leaves presses that start at the left screen edge to the drawer", () => {
    const h = setup();
    swipe(h.cell, { x: 20, dx: 120 });
    expect(h.onSwipeRight).not.toHaveBeenCalled();
    // Just outside the zone is ours again.
    swipe(h.cell, { x: 60, dx: 120 });
    expect(h.onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it("ignores secondary mouse buttons", () => {
    const h = setup();
    fireEvent(
      h.cell,
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientX: START_X,
        clientY: START_Y,
        button: 2,
      }),
    );
    fireEvent(h.cell, pointerEvent("pointermove", START_X - 20, START_Y));
    fireEvent(h.cell, pointerEvent("pointerup", START_X - 90, START_Y));
    expect(h.onSwipeLeft).not.toHaveBeenCalled();
  });

  it("does nothing while disabled", () => {
    const h = setup({ enabled: false });
    swipe(h.cell, { dx: -80 });
    expect(h.onSwipeLeft).not.toHaveBeenCalled();
  });

  it("forgets the press on pointercancel (the browser took the gesture)", () => {
    const h = setup();
    fireEvent(h.cell, pointerEvent("pointerdown", START_X, START_Y));
    fireEvent(h.cell, pointerEvent("pointermove", START_X - 20, START_Y));
    fireEvent(h.cell, pointerEvent("pointercancel", START_X - 20, START_Y));
    fireEvent(h.cell, pointerEvent("pointerup", START_X - 90, START_Y));
    expect(h.onSwipeLeft).not.toHaveBeenCalled();
  });

  it("holds the browser off a horizontal touch drag, and only that (#1204)", () => {
    const h = setup();
    fireEvent(h.cell, pointerEvent("pointerdown", START_X, START_Y));
    const sideways = touchMove(START_X - 12, START_Y + 2);
    window.dispatchEvent(sideways);
    expect(sideways.defaultPrevented).toBe(true);
    fireEvent(h.cell, pointerEvent("pointerup", START_X - 12, START_Y + 2));

    fireEvent(h.cell, pointerEvent("pointerdown", START_X, START_Y));
    const scroll = touchMove(START_X + 2, START_Y + 30);
    window.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(false);
  });

  it("tells the browser the horizontal pan is the surface's own", () => {
    const h = setup();
    expect(h.surface.className).toContain("touch-pan-y");
    expect(h.surface.className).toContain("touch-pinch-zoom");
  });
});
