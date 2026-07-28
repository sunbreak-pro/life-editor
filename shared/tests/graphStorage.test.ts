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

  it("keeps the viewport half working (it was always symmetric)", () => {
    saveViewport({ x: 5, y: 6, k: 1.5 });
    expect(loadViewport()).toEqual({ x: 5, y: 6, k: 1.5 });
  });
});
