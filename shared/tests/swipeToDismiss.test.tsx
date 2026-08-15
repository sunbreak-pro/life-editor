import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BottomSheet,
  MobileDrawer,
  RightSidebarToggle,
} from "../src/components";
import { RightSidebarProvider } from "../src/context";

/*
 * Swipe-to-close for the two mobile overlays (#792).
 *
 * The gesture is driven with pointer events carrying EXPLICIT clientX/clientY,
 * dispatched straight at the element. jsdom has no layout — every rect is 0
 * (CLAUDE.md §7.1) — so nothing here may read a measured position, and the
 * hook's threshold is a fixed pixel count for exactly that reason. jsdom also
 * lacks a PointerEvent constructor, so these are MouseEvents typed
 * "pointerdown"/etc.: React delegates on the event's TYPE and reads clientX /
 * clientY off the native event, which is all the hook touches.
 *
 * The two release outcomes the issue names — under the threshold springs back
 * (still open), over it closes — are pinned for both panels, plus the axis lock
 * that keeps a vertical scroll inside the drawer from being read as a dismiss.
 */

/** A pointer event jsdom can actually build, with the coordinates that matter. */
function pointerEvent(type: string, clientX: number, clientY: number): Event {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
}

/**
 * One press-drag-release. Moves in two steps so the first one clears the
 * hook's 8px axis-lock distance and the second lands where the caller asked.
 */
function swipe(
  target: HTMLElement,
  { dx = 0, dy = 0 }: { dx?: number; dy?: number },
) {
  fireEvent(target, pointerEvent("pointerdown", 0, 0));
  fireEvent(
    target,
    pointerEvent("pointermove", Math.sign(dx) * 10, Math.sign(dy) * 10),
  );
  fireEvent(target, pointerEvent("pointermove", dx, dy));
  fireEvent(target, pointerEvent("pointerup", dx, dy));
}

/** The sheet's drag strip — the handle + header wrapper, first child of the panel. */
function stripOf(dialog: HTMLElement): HTMLElement {
  const strip = dialog.firstElementChild;
  if (!(strip instanceof HTMLElement)) throw new Error("drag strip missing");
  return strip;
}

const DRAWER_LABELS = {
  title: "Details",
  close: "Close details",
  empty: "Nothing selected yet",
};

function renderOpenDrawer() {
  render(
    <RightSidebarProvider>
      <RightSidebarToggle
        variant="hamburger"
        openLabel="Open details"
        closeLabel="Hide details"
      />
      <MobileDrawer
        title={DRAWER_LABELS.title}
        closeLabel={DRAWER_LABELS.close}
        emptyLabel={DRAWER_LABELS.empty}
      />
    </RightSidebarProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open details" }));
  return screen.getByRole("dialog", { name: DRAWER_LABELS.title });
}

describe("BottomSheet swipe-to-close", () => {
  function renderSheet(onClose: () => void) {
    render(
      <BottomSheet open onClose={onClose} title="Sheet" closeLabel="Close">
        <button type="button">inside</button>
      </BottomSheet>,
    );
    return screen.getByRole("dialog");
  }

  it("closes when the drag past the threshold is released", () => {
    const onClose = vi.fn();
    const dialog = renderSheet(onClose);

    swipe(stripOf(dialog), { dy: 120 });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("springs back and stays open when the drag stops short", () => {
    const onClose = vi.fn();
    const dialog = renderSheet(onClose);
    const strip = stripOf(dialog);

    fireEvent(strip, pointerEvent("pointerdown", 0, 0));
    fireEvent(strip, pointerEvent("pointermove", 0, 40));
    // Mid-drag the panel follows the finger.
    expect(dialog.style.transform).toBe("translateY(40px)");

    fireEvent(strip, pointerEvent("pointerup", 0, 40));

    expect(onClose).not.toHaveBeenCalled();
    // Released under the threshold, the panel returns to its resting place.
    expect(dialog.style.transform).toBe("");
  });

  it("ignores an upward drag — the sheet does not lift off its edge", () => {
    const onClose = vi.fn();
    const dialog = renderSheet(onClose);

    swipe(stripOf(dialog), { dy: -120 });

    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe("");
  });

  it("still closes from the button after a swipe was abandoned", () => {
    const onClose = vi.fn();
    const dialog = renderSheet(onClose);

    swipe(stripOf(dialog), { dy: 20 });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).toBeInTheDocument();
  });
});

describe("MobileDrawer swipe-to-close", () => {
  it("closes when the leftward drag past the threshold is released", () => {
    const dialog = renderOpenDrawer();

    swipe(dialog, { dx: -120 });

    expect(
      screen.queryByRole("dialog", { name: DRAWER_LABELS.title }),
    ).not.toBeInTheDocument();
  });

  it("springs back and stays open when the drag stops short", () => {
    const dialog = renderOpenDrawer();

    fireEvent(dialog, pointerEvent("pointerdown", 0, 0));
    fireEvent(dialog, pointerEvent("pointermove", -40, 0));
    expect(dialog.style.transform).toBe("translateX(-40px)");

    fireEvent(dialog, pointerEvent("pointerup", -40, 0));

    expect(
      screen.getByRole("dialog", { name: DRAWER_LABELS.title }),
    ).toBeInTheDocument();
    expect(dialog.style.transform).toBe("");
  });

  it("leaves a vertical drag alone so scrolling the contents cannot close it", () => {
    const dialog = renderOpenDrawer();

    // Far past the threshold in distance, but along the axis the drawer does
    // not own — the press is handed back after the axis lock and never claimed.
    swipe(dialog, { dy: 200 });

    expect(
      screen.getByRole("dialog", { name: DRAWER_LABELS.title }),
    ).toBeInTheDocument();
    expect(dialog.style.transform).toBe("");
  });

  it("ignores a rightward drag — the drawer only leaves by its own edge", () => {
    const dialog = renderOpenDrawer();

    swipe(dialog, { dx: 200 });

    expect(
      screen.getByRole("dialog", { name: DRAWER_LABELS.title }),
    ).toBeInTheDocument();
  });
});
