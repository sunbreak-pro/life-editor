import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarNarrowLayout } from "../src/schedule/CalendarNarrowLayout";
import type { CalendarNarrowLayoutProps } from "../src/schedule/CalendarNarrowLayout";

/*
 * #2034 — on Mobile, swiping the month calendar left / right moves to the
 * next / previous month: the same `step(1)` / `step(-1)` the ‹ › steppers
 * call (CalendarTab hands both to `header.onNext` / `header.onPrev`).
 *
 * The gesture's own rules (axis lock, threshold, the drawer's edge zone, the
 * browser defence) are pinned in shared/tests/horizontalSwipe.test.tsx. This
 * file pins what only the layout can get wrong: WHICH surface listens, which
 * direction goes to which stepper, and that a day tap still opens the day.
 *
 * Pointer events are MouseEvents typed "pointerdown"/etc. — jsdom has no
 * PointerEvent constructor, and React reads clientX / clientY off the native
 * event, which is all the hook touches. `useTranslation` echoes its key.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

function pointerEvent(type: string, clientX: number, clientY: number): Event {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
}

/** Clear of the drawer's 44px edge zone. */
const X = 200;
const Y = 300;

function swipe(target: Element, dx: number, dy = 0) {
  fireEvent(target, pointerEvent("pointerdown", X, Y));
  fireEvent(
    target,
    pointerEvent("pointermove", X + Math.sign(dx) * 10, Y + Math.sign(dy) * 10),
  );
  fireEvent(target, pointerEvent("pointermove", X + dx, Y + dy));
  fireEvent(target, pointerEvent("pointerup", X + dx, Y + dy));
  // The click a real release ends in.
  fireEvent.click(target);
}

function renderNarrow() {
  const header = {
    periodLabel: "August 2026",
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
  };
  const onSelectDay = vi.fn();
  const props: CalendarNarrowLayoutProps = {
    header,
    banner: null,
    state: { loading: false, error: false, onRetry: vi.fn() },
    month: {
      anchorDate: "2026-08-20",
      today: "2026-08-16",
      weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      items: [],
      onSelectDay,
      formatDayLabel: (k) => k,
    },
  };
  render(<CalendarNarrowLayout {...props} />);
  // A day cell's full-face button — where a finger on the month lands.
  const day = screen.getByRole("button", { name: "2026-08-20" });
  return { header, onSelectDay, day };
}

describe("the narrow month calendar, swiped (#2034)", () => {
  it("moves to the next month on a leftward swipe", () => {
    const h = renderNarrow();
    swipe(h.day, -80);
    expect(h.header.onNext).toHaveBeenCalledTimes(1);
    expect(h.header.onPrev).not.toHaveBeenCalled();
  });

  it("moves to the previous month on a rightward swipe", () => {
    const h = renderNarrow();
    swipe(h.day, 80);
    expect(h.header.onPrev).toHaveBeenCalledTimes(1);
    expect(h.header.onNext).not.toHaveBeenCalled();
  });

  it("does not open the day the swipe ended on", () => {
    const h = renderNarrow();
    swipe(h.day, -80);
    expect(h.onSelectDay).not.toHaveBeenCalled();
  });

  it("leaves a vertical scroll alone", () => {
    const h = renderNarrow();
    swipe(h.day, 0, 120);
    expect(h.header.onNext).not.toHaveBeenCalled();
    expect(h.header.onPrev).not.toHaveBeenCalled();
  });

  it("still opens the day on a tap, and moves no month", () => {
    const h = renderNarrow();
    fireEvent(h.day, pointerEvent("pointerdown", X, Y));
    fireEvent(h.day, pointerEvent("pointerup", X + 1, Y + 1));
    fireEvent.click(h.day);
    expect(h.onSelectDay).toHaveBeenCalledWith("2026-08-20");
    expect(h.header.onNext).not.toHaveBeenCalled();
    expect(h.header.onPrev).not.toHaveBeenCalled();
  });

  it("leaves the steppers where they were — one press, one month", () => {
    const h = renderNarrow();
    fireEvent.click(screen.getByLabelText("scheduleScreen.next"));
    expect(h.header.onNext).toHaveBeenCalledTimes(1);
  });

  it("owns the horizontal pan on the grid's scroller, and only there", () => {
    renderNarrow();
    const grid = screen.getByRole("grid", { name: "scheduleScreen.calendar" });
    const scroller = grid.parentElement;
    expect(scroller?.className).toContain("touch-pan-y");
    // The heading row keeps the browser's defaults.
    const heading = screen.getByText("August 2026");
    expect(heading.closest(".touch-pan-y")).toBeNull();
  });
});
