import { describe, it, expect } from "vitest";
import {
  resolveDrag,
  type DragGeometry,
  type DragOrigin,
} from "../src/utils/scheduleGridLayout";

/*
 * #673 (C6) — the pin under WeekTimeGrid's drag resolution.
 *
 * Every schedule drag bug so far came out of the pointermove listener this
 * logic used to live in (#562's inverted 00:00 full-day bands, #563's all-day
 * lane boundary), and none of them could have a test: reproducing one needs a
 * live pointer sequence over elements with real rects, and jsdom reports every
 * rect as zero. Now the DOM reads happen in the component and the rules take
 * numbers, so the rules are testable while the measuring stays where it must be.
 *
 * Geometry throughout: a 7-day week starting Mon 2026-08-10, 48px per hour over
 * a full 00:00–24:00 window (so 1 minute = 0.8px), snapping to 30 minutes.
 */

const DAY_KEYS = [
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
  "2026-08-14",
  "2026-08-15",
  "2026-08-16",
];

function geometry(over: Partial<DragGeometry> = {}): DragGeometry {
  return {
    dayKeys: DAY_KEYS,
    hourHeight: 48,
    hourRange: [0, 24],
    snapStep: 30,
    allDayLaneBottom: null,
    timeGridTop: null,
    canDropAllDay: false,
    ...over,
  };
}

/** A 09:00–10:00 block on Tue (index 2), grabbed at (500, 400). */
function origin(over: Partial<DragOrigin> = {}): DragOrigin {
  return {
    mode: "move",
    startX: 500,
    startY: 400,
    colWidth: 100,
    origDayIdx: 2,
    origStartMin: 9 * 60,
    durationMin: 60,
    moved: true,
    ...over,
  };
}

describe("resolveDrag — the click threshold", () => {
  it("stays a click until the pointer has travelled far enough", () => {
    const drag = origin({ moved: false });
    expect(resolveDrag(drag, { x: 502, y: 401 }, geometry())).toBeNull();
  });

  it("resolves once the travel crosses the threshold", () => {
    const drag = origin({ moved: false });
    expect(resolveDrag(drag, { x: 500, y: 405 }, geometry())).not.toBeNull();
  });

  it("keeps resolving after the threshold was crossed earlier in the drag", () => {
    // `moved` latches in the caller — a drag that comes back to its origin is
    // still a drag, not a click.
    const drag = origin({ moved: true });
    expect(resolveDrag(drag, { x: 500, y: 400 }, geometry())).not.toBeNull();
  });
});

describe("resolveDrag — move", () => {
  it("turns vertical travel into a snapped start and keeps the duration", () => {
    const out = resolveDrag(origin(), { x: 500, y: 448 }, geometry());
    expect(out).toMatchObject({
      dateISO: "2026-08-12",
      startMin: 10 * 60,
      endMin: 11 * 60,
      allDay: false,
    });
  });

  it("snaps to the nearest slot rather than truncating", () => {
    // +20px = +25min → 09:25, which snaps up to 09:30.
    const out = resolveDrag(origin(), { x: 500, y: 420 }, geometry());
    expect(out?.startMin).toBe(9 * 60 + 30);
  });

  it("maps horizontal travel to whole day columns", () => {
    const out = resolveDrag(origin(), { x: 700, y: 400 }, geometry());
    expect(out?.dateISO).toBe("2026-08-14"); // index 2 + 2
  });

  it("clamps the day remap to the rendered columns", () => {
    const right = resolveDrag(origin(), { x: 1500, y: 400 }, geometry());
    expect(right?.dateISO).toBe("2026-08-16");
    const left = resolveDrag(origin(), { x: -1500, y: 400 }, geometry());
    expect(left?.dateISO).toBe("2026-08-10");
  });

  it("leaves the day alone in a single-column (day view) grid", () => {
    const out = resolveDrag(
      origin({ origDayIdx: 0 }),
      { x: 900, y: 400 },
      geometry({ dayKeys: ["2026-08-12"] }),
    );
    expect(out?.dateISO).toBe("2026-08-12");
  });

  it("leaves the day alone when the column width could not be measured", () => {
    const out = resolveDrag(
      origin({ colWidth: 0 }),
      { x: 900, y: 400 },
      geometry(),
    );
    expect(out?.dateISO).toBe("2026-08-12");
  });

  it("keeps a block dragged off the top edge inside the window (#562)", () => {
    const out = resolveDrag(origin(), { x: 500, y: -4000 }, geometry());
    expect(out?.startMin).toBe(0);
    // The span must stay positive — the pre-#562 bug flattened both ends onto
    // the same minute, which the grid drew as an uneditable full-day band.
    expect(out!.endMin - out!.startMin).toBe(60);
  });

  it("keeps a block dragged off the bottom edge inside the window (#562)", () => {
    const out = resolveDrag(origin(), { x: 500, y: 4000 }, geometry());
    expect(out?.startMin).toBe(23 * 60);
    expect(out?.endMin).toBe(24 * 60);
  });

  it("respects a narrowed visible window", () => {
    const out = resolveDrag(
      origin({ origStartMin: 10 * 60 }),
      { x: 500, y: 4000 },
      geometry({ hourRange: [8, 18] }),
    );
    expect(out?.startMin).toBe(17 * 60);
    expect(out?.endMin).toBe(18 * 60);
  });

  it("does not claim the item became all-day", () => {
    const out = resolveDrag(origin(), { x: 500, y: 448 }, geometry());
    expect(out?.allDay).toBe(false);
    // undefined = leave the item's own all-day flag untouched.
    expect(out?.previewIsAllDay).toBeUndefined();
  });
});

describe("resolveDrag — resize", () => {
  it("moves only the end edge", () => {
    const out = resolveDrag(
      origin({ mode: "resize" }),
      { x: 500, y: 448 },
      geometry(),
    );
    expect(out?.startMin).toBe(9 * 60);
    expect(out?.endMin).toBe(11 * 60);
  });

  it("never shrinks past one snap step, however far up the pointer goes", () => {
    const out = resolveDrag(
      origin({ mode: "resize" }),
      { x: 500, y: -4000 },
      geometry(),
    );
    expect(out?.endMin).toBe(9 * 60 + 30);
  });

  it("ignores horizontal travel — a resize cannot change the day", () => {
    const out = resolveDrag(
      origin({ mode: "resize" }),
      { x: 1500, y: 448 },
      geometry(),
    );
    expect(out?.dateISO).toBe("2026-08-12");
  });
});

describe("resolveDrag — place (all-day chip dropped into the time body)", () => {
  const placing = origin({ mode: "place", origStartMin: 0, durationMin: 60 });

  it("reads the start from the ABSOLUTE pointer position, not the travel", () => {
    // Grid top at y=100; pointer at y=580 → 480px into the body → 10:00.
    const out = resolveDrag(
      placing,
      { x: 500, y: 580 },
      geometry({ timeGridTop: 100 }),
    );
    expect(out).toMatchObject({ startMin: 10 * 60, endMin: 11 * 60 });
  });

  it("keeps the whole block in-window when dropped near the bottom", () => {
    const out = resolveDrag(
      placing,
      { x: 500, y: 5000 },
      geometry({ timeGridTop: 100 }),
    );
    expect(out?.startMin).toBe(23 * 60);
    expect(out?.endMin).toBe(24 * 60);
  });

  it("never changes the day, however far sideways the pointer goes", () => {
    const out = resolveDrag(
      placing,
      { x: 2000, y: 580 },
      geometry({ timeGridTop: 100 }),
    );
    expect(out?.dateISO).toBe("2026-08-12");
  });

  it("flips the preview to timed so the chip leaves the all-day lane", () => {
    const out = resolveDrag(
      placing,
      { x: 500, y: 580 },
      geometry({ timeGridTop: 100 }),
    );
    expect(out?.previewIsAllDay).toBe(false);
  });

  it("falls back to the seeded start when the grid could not be measured", () => {
    const out = resolveDrag(
      origin({ mode: "place", origStartMin: 8 * 60, durationMin: 60 }),
      { x: 500, y: 580 },
      geometry({ timeGridTop: null }),
    );
    expect(out?.startMin).toBe(8 * 60);
  });
});

describe("resolveDrag — the all-day lane (#562 / #563)", () => {
  const overLane = { x: 500, y: 40 };

  it("hands a move back to the lane when the host accepts all-day drops", () => {
    const out = resolveDrag(
      origin(),
      overLane,
      geometry({ allDayLaneBottom: 120, canDropAllDay: true }),
    );
    expect(out).toMatchObject({
      allDay: true,
      startMin: 0,
      endMin: 0,
      previewIsAllDay: true,
    });
  });

  it("still applies the horizontal day remap on the way to the lane", () => {
    const out = resolveDrag(
      origin(),
      { x: 700, y: 40 },
      geometry({ allDayLaneBottom: 120, canDropAllDay: true }),
    );
    expect(out?.dateISO).toBe("2026-08-14");
  });

  it("treats the lane as ordinary space when the host takes no all-day drops", () => {
    // Without the opt-in the pointer's y is just a (clamped) time — the branch
    // that used to mint 00:00 inverted bands must not fire.
    const out = resolveDrag(
      origin(),
      overLane,
      geometry({ allDayLaneBottom: 120, canDropAllDay: false }),
    );
    expect(out?.allDay).toBe(false);
    expect(out!.endMin).toBeGreaterThan(out!.startMin);
  });

  it("reverts a place back to all-day, whatever the host opted into", () => {
    // "place" started on an all-day chip: dropped back on the lane it must
    // report all-day so pointer-up writes nothing.
    const out = resolveDrag(
      origin({ mode: "place" }),
      overLane,
      geometry({ allDayLaneBottom: 120, canDropAllDay: false }),
    );
    expect(out?.allDay).toBe(true);
  });

  it("keeps a place on its own day even over the lane", () => {
    const out = resolveDrag(
      origin({ mode: "place" }),
      { x: 2000, y: 40 },
      geometry({ allDayLaneBottom: 120, canDropAllDay: false }),
    );
    expect(out?.dateISO).toBe("2026-08-12");
  });

  it("puts the boundary ON the lane's bottom edge, exclusive", () => {
    // The edge itself is already the time body (#563 moved the lane inside the
    // scroll box, so this line is the whole difference between "dropped on the
    // lane" and "dropped at the top of the day").
    const onEdge = resolveDrag(
      origin(),
      { x: 500, y: 120 },
      geometry({ allDayLaneBottom: 120, canDropAllDay: true }),
    );
    expect(onEdge?.allDay).toBe(false);
    const justAbove = resolveDrag(
      origin(),
      { x: 500, y: 119 },
      geometry({ allDayLaneBottom: 120, canDropAllDay: true }),
    );
    expect(justAbove?.allDay).toBe(true);
  });

  it("cannot fire at all when there is no lane to be over", () => {
    const out = resolveDrag(
      origin(),
      { x: 500, y: -400 },
      geometry({ allDayLaneBottom: null, canDropAllDay: true }),
    );
    expect(out?.allDay).toBe(false);
  });

  it("never lets a resize become an all-day drop", () => {
    const out = resolveDrag(
      origin({ mode: "resize" }),
      overLane,
      geometry({ allDayLaneBottom: 120, canDropAllDay: true }),
    );
    expect(out?.allDay).toBe(false);
  });
});
