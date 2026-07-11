import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveInitialSection,
  persistLastSection,
} from "../src/hooks/useStartupSection";

/*
 * Startup section §216 — pure resolve/persist logic (no React). jsdom provides
 * localStorage; each test starts from a clean slate.
 */

const STARTUP_KEY = "life-editor-startup-section";
const LAST_KEY = "life-editor-last-section";

beforeEach(() => {
  localStorage.clear();
});

describe("resolveInitialSection", () => {
  it("falls back to the default when nothing is stored", () => {
    expect(resolveInitialSection()).toBe("materials");
  });

  it("resumes the last-visited section when the pref is absent (implicit last)", () => {
    persistLastSection("work");
    expect(resolveInitialSection()).toBe("work");
  });

  it("resumes the last-visited section when the pref is explicitly 'last'", () => {
    localStorage.setItem(STARTUP_KEY, "last");
    persistLastSection("schedule");
    expect(resolveInitialSection()).toBe("schedule");
  });

  it("opens a fixed section when the pref is a valid section id", () => {
    localStorage.setItem(STARTUP_KEY, "analytics");
    persistLastSection("work");
    expect(resolveInitialSection()).toBe("analytics");
  });

  it("falls back to the default for an invalid fixed section id", () => {
    localStorage.setItem(STARTUP_KEY, "does-not-exist");
    expect(resolveInitialSection()).toBe("materials");
  });

  it("falls back to the default for an invalid stored last-section", () => {
    localStorage.setItem(STARTUP_KEY, "last");
    localStorage.setItem(LAST_KEY, "bogus-section");
    expect(resolveInitialSection()).toBe("materials");
  });
});

describe("persistLastSection", () => {
  it("writes the last section to localStorage", () => {
    persistLastSection("connect");
    expect(localStorage.getItem(LAST_KEY)).toBe("connect");
  });
});
