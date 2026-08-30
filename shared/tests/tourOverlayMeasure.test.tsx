import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { TourOverlay, type TourLabels } from "../src/components/tour";

/*
 * The spotlight keeps following an anchor that settles after it was first
 * measured (#1249).
 *
 * WHAT BROKE, in a real browser at 390x844: the tour's first step points at
 * Briefing's 朝刊 tab, which on narrow rides INSIDE the page body. The loading
 * branch of BriefingView wraps it in `py-8`, the loaded branch in a `py-3`
 * bordered row — so the tab lifts about 20px the moment the fetch lands, and
 * the taller content brings a scrollbar with it that takes another ~8px off
 * the tab's width. Measured against the skeleton, the spotlight sat low and
 * wide over nothing (anchor top 33.8 vs spotlight top 52.3; width 110.5 vs an
 * expected 102.8). Dispatching a `resize` snapped it right, which is what
 * identified the cause: nothing re-measured on its own.
 *
 * HOW IT IS ASSERTED HERE. jsdom has no layout, so every real rect is all-zero
 * (CLAUDE.md §7.1) — the geometry cannot be reproduced. What CAN be pinned is
 * the property the fix is actually about: the overlay re-reads the anchor and
 * moves, without any event being dispatched at it. So the anchor's
 * `getBoundingClientRect` is stubbed, swapped for a second value, and one
 * animation frame is let through. Before the fix that second value is never
 * read and both assertions below fail on the first rect.
 *
 * `requestAnimationFrame` is replaced with a queue rather than driven by a
 * timer: the loop schedules its next frame from inside the callback, so a real
 * rAF would make "one frame" a race with the clock.
 */

const LABELS: TourLabels = {
  dialogLabel: "Tutorial step",
  next: "Next",
  done: "Done",
  skip: "Skip",
  progress: "1 / 10",
  waitingForAction: "Try it",
};

/** Rounded off the real measurements — exact values keep the maths readable. */
const SKELETON = { top: 52, left: 12, width: 110, height: 32 };
const SETTLED = { top: 34, left: 12, width: 102, height: 32 };

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function stubRect(el: HTMLElement, box: Box): void {
  el.getBoundingClientRect = () =>
    ({
      top: box.top,
      left: box.left,
      width: box.width,
      height: box.height,
      right: box.left + box.width,
      bottom: box.top + box.height,
      x: box.left,
      y: box.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

let nextFrameId = 1;
let pending = new Map<number, FrameRequestCallback>();
let realRaf: typeof globalThis.requestAnimationFrame;
let realCaf: typeof globalThis.cancelAnimationFrame;

/** Run every frame queued so far — and only those, so the loop cannot spin. */
async function flushFrame(): Promise<void> {
  const due = [...pending.values()];
  pending = new Map();
  await act(async () => {
    for (const cb of due) cb(0);
  });
}

const mounted: HTMLElement[] = [];

function mountAnchor(box: Box): HTMLElement {
  const anchor = document.createElement("button");
  anchor.setAttribute("data-tour-id", "briefing-morning-tab");
  document.body.appendChild(anchor);
  mounted.push(anchor);
  stubRect(anchor, box);
  return anchor;
}

function renderOverlay(anchor: HTMLElement) {
  return render(
    <TourOverlay
      anchorElement={anchor}
      copy="This is your morning paper."
      stepNumber={1}
      totalSteps={10}
      waitsForAction={false}
      onNext={vi.fn()}
      onSkip={vi.fn()}
      onDismiss={vi.fn()}
      labels={LABELS}
    />,
  );
}

function spotlight(): HTMLElement {
  const el = document.querySelector<HTMLElement>(".lumen-scrim-in");
  if (!el) throw new Error("spotlight not rendered");
  return el;
}

function bubble(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!el) throw new Error("bubble not rendered");
  return el;
}

beforeEach(() => {
  nextFrameId = 1;
  pending = new Map();
  realRaf = globalThis.requestAnimationFrame;
  realCaf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = nextFrameId++;
    pending.set(id, cb);
    return id;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => {
    pending.delete(id);
  }) as typeof globalThis.cancelAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = realRaf;
  globalThis.cancelAnimationFrame = realCaf;
  for (const el of mounted.splice(0)) el.remove();
});

describe("TourOverlay anchor measurement", () => {
  it("re-measures a spotlight whose anchor moved after the first paint", async () => {
    const anchor = mountAnchor(SKELETON);
    renderOverlay(anchor);

    // SPOTLIGHT_GAP is 8: the box is inset half a gap and grown by a full one.
    expect(spotlight().style.top).toBe("48px");
    expect(spotlight().style.width).toBe("118px");

    stubRect(anchor, SETTLED);
    await flushFrame();

    expect(spotlight().style.top).toBe("30px");
    expect(spotlight().style.width).toBe("110px");
  });

  it("carries the bubble with it", async () => {
    const anchor = mountAnchor(SKELETON);
    renderOverlay(anchor);

    // Anchor bottom (52 + 32) plus the gap. The panel measures 0x0 in jsdom, so
    // clampToViewport falls back to the estimated size and nothing is clamped.
    expect(bubble().style.top).toBe("92px");

    stubRect(anchor, SETTLED);
    await flushFrame();

    expect(bubble().style.top).toBe("74px");
  });

  it("keeps exactly one frame in flight, and none after unmount", async () => {
    const anchor = mountAnchor(SKELETON);
    const view = renderOverlay(anchor);

    await flushFrame();
    // One, not a pile: the loop re-arms from inside its own callback, so a
    // second scheduler anywhere in here would compound every frame.
    expect(pending.size).toBe(1);

    view.unmount();
    // And the outstanding one is cancelled rather than left to measure a
    // detached anchor for the rest of the session.
    expect(pending.size).toBe(0);
  });
});
