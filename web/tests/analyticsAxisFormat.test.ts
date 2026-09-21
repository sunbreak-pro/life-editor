import { describe, it, expect } from "vitest";
import { makeAxisFormat } from "../src/analytics/axisFormat";

/*
 * #1864 — one duration format and one date format per Analytics tab, both in
 * the active language. The catalogs are stood in for by the two templates the
 * real ones carry, so what is pinned is the SHAPE the host picks (which half
 * of a duration is dropped, which Intl pattern a bucket gets).
 */
const EN: Record<string, string> = {
  "analytics.hours": "{{hours}}h {{minutes}}m",
  "analytics.axis.hoursOnly": "{{hours}}h",
  "analytics.axis.minutesOnly": "{{minutes}}m",
  "analytics.axis.weekFrom": "{{date}}–",
};
const JA: Record<string, string> = {
  "analytics.hours": "{{hours}}時間{{minutes}}分",
  "analytics.axis.hoursOnly": "{{hours}}時間",
  "analytics.axis.minutesOnly": "{{minutes}}分",
  "analytics.axis.weekFrom": "{{date}}〜",
};

function translator(catalog: Record<string, string>) {
  return (key: string, values: Record<string, string | number>): string =>
    catalog[key].replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
      String(values[name]),
    );
}

describe("makeAxisFormat — durations", () => {
  const en = makeAxisFormat(translator(EN), "en");
  const ja = makeAxisFormat(translator(JA), "ja");

  it("drops the half that is zero so a tick stays narrow", () => {
    expect(en.duration(0)).toBe("0m");
    expect(en.duration(30)).toBe("30m");
    expect(en.duration(120)).toBe("2h");
    expect(en.duration(62)).toBe("1h 2m");
  });

  it("speaks the language the tiles speak", () => {
    expect(ja.duration(30)).toBe("30分");
    expect(ja.duration(120)).toBe("2時間");
    expect(ja.duration(62)).toBe("1時間2分");
  });

  it("rounds once before splitting, so 119.7 is 2h and never 1h 60m", () => {
    expect(en.duration(119.7)).toBe("2h");
  });
});

describe("makeAxisFormat — dates", () => {
  const en = makeAxisFormat(translator(EN), "en");
  const ja = makeAxisFormat(translator(JA), "ja-JP");

  it("formats a day bucket the same way on every chart", () => {
    expect(en.date("2026-09-08", "day")).toBe("9/8");
    expect(ja.date("2026-09-08", "day")).toBe("9/8");
  });

  it("marks a week bucket with the catalog's own sign, not a hardcoded ~", () => {
    expect(en.date("2026-08-23", "week")).toBe("8/23–");
    expect(ja.date("2026-08-23", "week")).toBe("8/23〜");
  });

  it("names a month bucket in the language, year included", () => {
    expect(en.date("2026-09-01", "month")).toBe("Sep 2026");
    expect(ja.date("2026-09-01", "month")).toBe("2026年9月");
  });

  it("reads the key as a LOCAL day (new Date(key) would shift it in UTC-)", () => {
    expect(en.date("2026-01-01", "day")).toBe("1/1");
  });
});
