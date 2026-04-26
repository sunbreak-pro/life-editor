import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import {
  VIRTUAL_LINK_EDGES_HIDDEN_ID,
  isSpecialFilterId,
  loadPositions,
  loadViewport,
  savePositions,
  saveViewport,
} from "./tagGraphStorage";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe("VIRTUAL_LINK_EDGES_HIDDEN_ID", () => {
  it("starts with the special-filter prefix", () => {
    expect(isSpecialFilterId(VIRTUAL_LINK_EDGES_HIDDEN_ID)).toBe(true);
  });
});

describe("isSpecialFilterId", () => {
  it("returns true for ids starting with __", () => {
    expect(isSpecialFilterId("__virtual:foo")).toBe(true);
  });
  it("returns false for normal ids", () => {
    expect(isSpecialFilterId("tag-123")).toBe(false);
    expect(isSpecialFilterId("")).toBe(false);
  });
});

describe("loadPositions / savePositions", () => {
  it("returns empty object when no value stored", () => {
    expect(loadPositions()).toEqual({});
  });

  it("round-trips position records", () => {
    const positions = { "tag-1": { x: 10, y: 20 }, "tag-2": { x: 30, y: 40 } };
    savePositions(positions);
    expect(loadPositions()).toEqual(positions);
  });

  it("returns empty object when stored value is invalid JSON", () => {
    localStorage.setItem(STORAGE_KEYS.TAG_GRAPH_POSITIONS, "{not-json");
    expect(loadPositions()).toEqual({});
  });
});

describe("loadViewport / saveViewport", () => {
  it("returns null when no value stored", () => {
    expect(loadViewport()).toBeNull();
  });

  it("round-trips viewport records", () => {
    const vp = { x: 100, y: -50, zoom: 1.5 };
    saveViewport(vp);
    expect(loadViewport()).toEqual(vp);
  });

  it("returns null when stored value is invalid JSON", () => {
    localStorage.setItem(STORAGE_KEYS.TAG_GRAPH_VIEWPORT, "garbage");
    expect(loadViewport()).toBeNull();
  });
});
