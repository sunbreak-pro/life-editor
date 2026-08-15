import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemActionPopover, clampToViewport } from "../src/components";
import type { ItemAction } from "../src/components";

/*
 * Bottom-edge clamping (#826). The panel used to be placed with a fixed 220px
 * height guess, so an event's panel (summary + 4 actions + the edit-detail
 * button) ran past the bottom of the window when opened low in week view and
 * its last row could not be clicked. The panel now measures itself and
 * re-clamps with the real number.
 *
 * jsdom has no layout — every element reports offsetHeight 0 — so the measured
 * height is stubbed on HTMLElement.prototype here. That is the one fact these
 * tests fake; the placement arithmetic under test is the real code.
 */

const GAP = 8;

// jsdom defines offsetHeight on the prototype itself, so the stub REPLACES it.
// Keep the original descriptor to put back — deleting the stub would leave
// offsetHeight undefined for every later suite in the process.
const nativeOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetHeight",
);

function stubPanelHeight(height: number) {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => height,
  });
}

function actions(count: number): ItemAction[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `a${i}`,
    label: `Action ${i}`,
    onSelect: vi.fn(),
  }));
}

function renderPopover(y: number, actionCount = 4) {
  render(
    <ItemActionPopover
      position={{ x: 100, y }}
      summary={<p>Gym · 19:00–23:00</p>}
      actions={actions(actionCount)}
      onEditDetail={vi.fn()}
      editDetailLabel="Edit detail"
      label="Item actions"
      onClose={vi.fn()}
    />,
  );
  return screen.getByRole("dialog", { name: "Item actions" });
}

afterEach(() => {
  if (nativeOffsetHeight) {
    Object.defineProperty(
      HTMLElement.prototype,
      "offsetHeight",
      nativeOffsetHeight,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
  }
  window.innerHeight = 768;
  window.innerWidth = 1024;
});

describe("ItemActionPopover viewport clamping (#826)", () => {
  it("pushes a panel taller than the estimate fully back on screen", () => {
    window.innerHeight = 800;
    stubPanelHeight(320); // > the 220px first-paint estimate
    const panel = renderPopover(700); // click near the bottom (19:00+ in week view)

    // Bottom edge, not the anchor, decides the top once the panel is measured.
    expect(panel.style.top).toBe(`${800 - 320 - GAP}px`);
    expect(panel.style.maxHeight).toBe("");
  });

  it("keeps the gap at the top edge for a click at the very top", () => {
    window.innerHeight = 800;
    stubPanelHeight(320);
    const panel = renderPopover(0); // 0:00 row

    expect(panel.style.top).toBe(`${GAP}px`);
  });

  it("does not move a panel that already fits below the anchor", () => {
    window.innerHeight = 800;
    stubPanelHeight(320);
    const panel = renderPopover(100);

    expect(panel.style.top).toBe("100px");
  });

  it("re-clamps when the host passes more actions", () => {
    window.innerHeight = 800;
    stubPanelHeight(560); // a host with a long action list
    const panel = renderPopover(700, 10);

    expect(panel.style.top).toBe(`${800 - 560 - GAP}px`);
  });

  it("caps the height and scrolls internally when the panel cannot fit", () => {
    window.innerHeight = 400;
    stubPanelHeight(560);
    const panel = renderPopover(300);

    expect(panel.style.top).toBe(`${GAP}px`);
    expect(panel.style.maxHeight).toBe(`${400 - GAP * 2}px`);
    expect(panel.style.overflowY).toBe("auto");
  });
});

describe("clampToViewport", () => {
  it("clamps both edges horizontally", () => {
    window.innerWidth = 1000;
    expect(clampToViewport({ x: 990, y: 0 }, 248, 100).left).toBe(
      1000 - 248 - GAP,
    );
    expect(clampToViewport({ x: 0, y: 0 }, 248, 100).left).toBe(GAP);
  });

  it("reports no maxHeight while the panel fits", () => {
    window.innerHeight = 800;
    expect(clampToViewport({ x: 0, y: 0 }, 248, 100).maxHeight).toBeUndefined();
  });

  it("re-deriving from a capped height keeps the same cap (no oscillation)", () => {
    window.innerHeight = 400;
    const first = clampToViewport({ x: 0, y: 300 }, 248, 560);
    expect(first.maxHeight).toBe(400 - GAP * 2);
    // Feeding the measured (capped) height back in must not drop the cap.
    const second = clampToViewport({ x: 0, y: 300 }, 248, first.maxHeight!);
    expect(second).toEqual(first);
  });
});
