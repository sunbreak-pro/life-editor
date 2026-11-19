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
    expect(resolveInitialSection()).toBe("briefing");
  });

  it("resumes the last-visited section when the pref is absent (implicit last)", () => {
    persistLastSection("connect");
    expect(resolveInitialSection()).toBe("connect");
  });

  it("resumes the last-visited section when the pref is explicitly 'last'", () => {
    localStorage.setItem(STARTUP_KEY, "last");
    persistLastSection("schedule");
    expect(resolveInitialSection()).toBe("schedule");
  });

  it("opens a fixed section when the pref is a valid section id", () => {
    localStorage.setItem(STARTUP_KEY, "materials");
    persistLastSection("connect");
    expect(resolveInitialSection()).toBe("materials");
  });

  it("falls back to the default for an invalid fixed section id", () => {
    localStorage.setItem(STARTUP_KEY, "does-not-exist");
    expect(resolveInitialSection()).toBe("briefing");
  });

  it("falls back to the default for a stored section that was removed (#2717)", () => {
    localStorage.setItem(LAST_KEY, "work");
    expect(resolveInitialSection()).toBe("briefing");
    localStorage.setItem(STARTUP_KEY, "work");
    expect(resolveInitialSection()).toBe("briefing");
  });

  it("falls back to the default for a stored Analytics section (#2754)", () => {
    localStorage.setItem(LAST_KEY, "analytics");
    expect(resolveInitialSection()).toBe("briefing");
    localStorage.setItem(STARTUP_KEY, "analytics");
    expect(resolveInitialSection()).toBe("briefing");
  });

  it("falls back to the default for an invalid stored last-section", () => {
    localStorage.setItem(STARTUP_KEY, "last");
    localStorage.setItem(LAST_KEY, "bogus-section");
    expect(resolveInitialSection()).toBe("briefing");
  });
});

describe("persistLastSection", () => {
  it("writes the last section to localStorage", () => {
    persistLastSection("materials");
    expect(localStorage.getItem(LAST_KEY)).toBe("materials");
  });
});
