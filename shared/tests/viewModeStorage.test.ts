import { describe, it, expect, beforeEach } from "vitest";
import {
  isKanbanViewMode,
  readKanbanViewMode,
  persistKanbanViewMode,
} from "../src/components/Kanban/viewModeStorage";

/*
 * Kanban view-mode persistence (life-tags S1). The folder view was retired, so
 * the guard now accepts only status / tag, AND a pre-S1 "folder" value stored
 * in localStorage must be self-healed to its successor ("tag") on read — the
 * stale id never reaches a caller and is rewritten so it never lingers.
 */

const STORAGE_KEY = "life-editor:kanban-view-mode";

describe("isKanbanViewMode", () => {
  it("accepts the two live modes", () => {
    expect(isKanbanViewMode("status")).toBe(true);
    expect(isKanbanViewMode("tag")).toBe(true);
  });

  it("rejects the retired folder mode and junk", () => {
    expect(isKanbanViewMode("folder")).toBe(false);
    expect(isKanbanViewMode("nope")).toBe(false);
    expect(isKanbanViewMode(null)).toBe(false);
  });
});

describe("readKanbanViewMode", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the fallback when nothing is stored", () => {
    expect(readKanbanViewMode("tag")).toBe("tag");
    expect(readKanbanViewMode("status")).toBe("status");
  });

  it("returns a valid stored mode verbatim", () => {
    persistKanbanViewMode("status");
    expect(readKanbanViewMode("tag")).toBe("status");
  });

  it("self-heals a legacy 'folder' value to 'tag' and rewrites storage", () => {
    window.localStorage.setItem(STORAGE_KEY, "folder");
    expect(readKanbanViewMode("status")).toBe("tag");
    // The stale id is rewritten so it never lingers for the next read.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("tag");
  });

  it("falls back for an unrecognized stored value", () => {
    window.localStorage.setItem(STORAGE_KEY, "bogus");
    expect(readKanbanViewMode("status")).toBe("status");
  });
});
