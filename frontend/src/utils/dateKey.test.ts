import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatDateKey,
  toLocalISOString,
  formatDisplayDate,
  formatDateHeading,
  formatMonthLabel,
  formatDayFlowDate,
} from "./dateKey";

describe("formatDateKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(formatDateKey(new Date(2025, 0, 15))).toBe("2025-01-15");
  });

  it("pads single-digit months", () => {
    expect(formatDateKey(new Date(2025, 2, 5))).toBe("2025-03-05");
  });

  it("pads single-digit days", () => {
    expect(formatDateKey(new Date(2025, 11, 1))).toBe("2025-12-01");
  });

  it("handles Dec 31", () => {
    expect(formatDateKey(new Date(2025, 11, 31))).toBe("2025-12-31");
  });

  it("handles Jan 1", () => {
    expect(formatDateKey(new Date(2025, 0, 1))).toBe("2025-01-01");
  });

  it("uses local date (not UTC)", () => {
    // Create a date at midnight local time
    const d = new Date(2025, 5, 15, 0, 0, 0);
    expect(formatDateKey(d)).toBe("2025-06-15");
  });
});

// ---------------------------------------------------------------------------
// Characterization tests: these lock the CURRENT observed behavior of dateKey
// helpers, including any quirks, so later refactors are detected. Do NOT
// "correct" expectations toward an idealized form.
// ---------------------------------------------------------------------------

describe("toLocalISOString", () => {
  it("formats local Y-M-DTH:M:S without timezone suffix", () => {
    const d = new Date(2025, 5, 15, 9, 7, 3);
    expect(toLocalISOString(d)).toBe("2025-06-15T09:07:03");
  });

  it("pads single-digit month/day/hour/minute/second", () => {
    const d = new Date(2025, 0, 1, 0, 0, 0);
    expect(toLocalISOString(d)).toBe("2025-01-01T00:00:00");
  });

  it("uses local time fields (not UTC)", () => {
    const d = new Date(2024, 11, 31, 23, 59, 59);
    expect(toLocalISOString(d)).toBe("2024-12-31T23:59:59");
  });

  it("handles leap-day Feb 29 on a leap year", () => {
    const d = new Date(2024, 1, 29, 12, 30, 45);
    expect(toLocalISOString(d)).toBe("2024-02-29T12:30:45");
  });
});

describe("formatDisplayDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("en: same-year date omits the year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 1, 12, 0, 0));
    expect(formatDisplayDate("2025-06-15")).toBe("Jun 15");
  });

  it("en: different-year date includes the year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 1, 12, 0, 0));
    expect(formatDisplayDate("2024-12-31")).toBe("Dec 31, 2024");
  });

  it("ja: same-year date omits the year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 1, 12, 0, 0));
    expect(formatDisplayDate("2025-01-01", "ja")).toBe("1月1日");
  });

  it("ja: different-year date includes the year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 1, 12, 0, 0));
    expect(formatDisplayDate("2026-01-01", "ja")).toBe("2026年1月1日");
  });

  it("ja: locale prefix match (ja-JP) is treated as Japanese", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 1, 12, 0, 0));
    expect(formatDisplayDate("2025-03-05", "ja-JP")).toBe("3月5日");
  });

  it("year-boundary: Dec 31 vs a Jan 1 'now' counts as different year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0));
    expect(formatDisplayDate("2025-12-31")).toBe("Dec 31, 2025");
  });

  it("leap day Feb 29 formats correctly (en, same year)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 1, 12, 0, 0));
    expect(formatDisplayDate("2024-02-29")).toBe("Feb 29");
  });
});

describe("formatDateHeading", () => {
  it("en: full weekday + long month + numeric day/year", () => {
    expect(formatDateHeading("2025-06-15")).toBe("Sunday, June 15, 2025");
  });

  it("ja: localized long date with weekday", () => {
    expect(formatDateHeading("2025-01-01", "ja")).toBe("2025年1月1日水曜日");
  });

  it("ja-JP prefix is treated as Japanese", () => {
    expect(formatDateHeading("2025-12-31", "ja-JP")).toBe(
      "2025年12月31日水曜日",
    );
  });

  it("leap day Feb 29 (en)", () => {
    expect(formatDateHeading("2024-02-29")).toBe("Thursday, February 29, 2024");
  });
});

describe("formatMonthLabel", () => {
  it("ja: 'YYYY-MM' becomes 'YYYY年M月' with leading zero stripped", () => {
    expect(formatMonthLabel("2025-03", "ja")).toBe("2025年3月");
  });

  it("ja: double-digit month preserved", () => {
    expect(formatMonthLabel("2025-12", "ja")).toBe("2025年12月");
  });

  it("en (default): returns the raw monthKey unchanged", () => {
    expect(formatMonthLabel("2025-03")).toBe("2025-03");
  });

  it("ja-JP prefix is treated as Japanese", () => {
    expect(formatMonthLabel("2026-01", "ja-JP")).toBe("2026年1月");
  });
});

describe("formatDayFlowDate", () => {
  it("en: 'M/D(Weekday)' with abbreviated weekday", () => {
    // 2025-06-15 is a Sunday
    expect(formatDayFlowDate(new Date(2025, 5, 15), "en")).toBe("6/15(Sun)");
  });

  it("ja: 'M/D(曜)' with single-char weekday", () => {
    // 2025-01-01 is a Wednesday
    expect(formatDayFlowDate(new Date(2025, 0, 1), "ja")).toBe("1/1(水)");
  });

  it("year boundary Dec 31 (en)", () => {
    // 2025-12-31 is a Wednesday
    expect(formatDayFlowDate(new Date(2025, 11, 31), "en")).toBe("12/31(Wed)");
  });

  it("leap day Feb 29 (ja)", () => {
    // 2024-02-29 is a Thursday
    expect(formatDayFlowDate(new Date(2024, 1, 29), "ja")).toBe("2/29(木)");
  });

  it("ja-JP prefix is treated as Japanese", () => {
    expect(formatDayFlowDate(new Date(2025, 5, 15), "ja-JP")).toBe("6/15(日)");
  });
});
