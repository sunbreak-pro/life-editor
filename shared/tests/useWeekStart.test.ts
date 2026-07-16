import { describe, it, expect, beforeEach } from "vitest";
import {
  parseWeekStart,
  getWeekStartsOn,
  WEEK_START_STORAGE_KEY,
} from "../src/hooks/useWeekStart";

/*
 * Week-start pref #217 — pure parse/read logic (no React). jsdom provides
 * localStorage; each test starts from a clean slate.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("parseWeekStart", () => {
  it("parses Monday", () => {
    expect(parseWeekStart("1")).toBe(1);
  });

  it("parses Sunday", () => {
    expect(parseWeekStart("0")).toBe(0);
  });

  it("falls back to Sunday for garbage / null", () => {
    expect(parseWeekStart("2")).toBe(0);
    expect(parseWeekStart("monday")).toBe(0);
    expect(parseWeekStart("")).toBe(0);
    expect(parseWeekStart(null)).toBe(0);
  });
});

describe("getWeekStartsOn", () => {
  it("defaults to Sunday when nothing is stored", () => {
    expect(getWeekStartsOn()).toBe(0);
  });

  it("reads a stored Monday pref", () => {
    localStorage.setItem(WEEK_START_STORAGE_KEY, "1");
    expect(getWeekStartsOn()).toBe(1);
  });

  it("falls back to Sunday for an invalid stored value", () => {
    localStorage.setItem(WEEK_START_STORAGE_KEY, "6");
    expect(getWeekStartsOn()).toBe(0);
  });
});
