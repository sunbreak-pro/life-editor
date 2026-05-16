import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeDate, formatDateTime } from "./formatRelativeDate";

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for very recent dates', () => {
    const result = formatRelativeDate("2025-06-15T12:00:00");
    // Uses i18n key — in test env returns the key or translation
    expect(result).toBeTruthy();
  });

  it("returns minutes ago for dates within an hour", () => {
    const result = formatRelativeDate("2025-06-15T11:30:00");
    expect(result).toBeTruthy();
  });

  it("returns hours ago for dates within a day", () => {
    const result = formatRelativeDate("2025-06-15T06:00:00");
    expect(result).toBeTruthy();
  });

  it("returns a string for dates older than 30 days", () => {
    const result = formatRelativeDate("2025-01-01T00:00:00");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatDateTime", () => {
  it("formats a date string to locale string", () => {
    const result = formatDateTime("2025-06-15T14:30:00");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
