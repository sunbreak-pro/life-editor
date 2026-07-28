import { describe, expect, it, beforeEach } from "vitest";
import {
  loadPositions,
  savePositions,
  loadViewport,
  saveViewport,
} from "../src/components/Connect/graph/graphStorage";

/*
 * #361 — the Connect graph wrote node positions every 4s but nothing read them
 * back, so each mount re-simulated from scratch under a viewport that HAD been
 * restored. These guard the round trip and, above all, the rejection of
 * malformed entries: a single NaN coordinate seeded into d3-force spreads
 * through the whole layout on the next tick.
 */

const POSITIONS_KEY = "life-editor.connect.pointGraph.positions";

describe("graphStorage positions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips saved positions", () => {
    savePositions({ "note-1": { x: 12, y: -4.5 } });
    expect(loadPositions()).toEqual({ "note-1": { x: 12, y: -4.5 } });
  });

  it("returns an empty map when nothing was ever saved", () => {
    expect(loadPositions()).toEqual({});
  });

  it("returns an empty map on unparsable JSON", () => {
    localStorage.setItem(POSITIONS_KEY, "{not json");
    expect(loadPositions()).toEqual({});
  });

  it("drops entries that are not a finite {x, y} pair", () => {
    localStorage.setItem(
      POSITIONS_KEY,
      JSON.stringify({
        good: { x: 1, y: 2 },
        nan: { x: Number.NaN, y: 2 },
        infinite: { x: 1, y: Number.POSITIVE_INFINITY },
        stringy: { x: "1", y: "2" },
        partial: { x: 3 },
        nulled: null,
        scalar: 7,
      }),
    );
    expect(loadPositions()).toEqual({ good: { x: 1, y: 2 } });
  });

  // The case above cannot reach `Number.isFinite`: JSON.stringify turns NaN
  // and Infinity into null, so those entries die on the typeof check. A JSON
  // literal that overflows on PARSE is the one input that arrives as a real
  // non-finite number — without this, deleting the isFinite guard would still
  // leave the suite green.
  it("drops a coordinate whose JSON literal overflows to Infinity", () => {
    localStorage.setItem(POSITIONS_KEY, '{"big":{"x":1e999,"y":0}}');
    expect(loadPositions()).toEqual({});
  });

  // `out.__proto__ = {...}` on a plain object replaces the prototype instead
  // of adding a key, which would make EVERY id lookup return that {x, y}.
  it("does not let a stored __proto__ key poison later lookups", () => {
    localStorage.setItem(
      POSITIONS_KEY,
      '{"__proto__":{"x":1,"y":2},"real":{"x":3,"y":4}}',
    );
    const loaded = loadPositions();
    expect(loaded["never-stored"]).toBeUndefined();
    expect(loaded["real"]).toEqual({ x: 3, y: 4 });
  });

  it("keeps the viewport half working (it was always symmetric)", () => {
    saveViewport({ x: 5, y: 6, k: 1.5 });
    expect(loadViewport()).toEqual({ x: 5, y: 6, k: 1.5 });
  });
});
