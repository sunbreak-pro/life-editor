import { describe, it, expect } from "vitest";
import { holidaysInRange, holidaysInYear } from "../src/utils/japaneseHolidays";

/*
 * #1626 — the holiday table the calendar draws from.
 *
 * Computed rather than fetched (see the module header), so these cases are the
 * only thing standing between a wrong rule and a calendar that states a wrong
 * fact. The parts worth pinning hardest are the ones no fixed date can get
 * right: the Happy-Monday days, the two equinoxes, and the two follow-on rules
 * (振替休日 / 国民の休日) that turn ordinary days into holidays.
 *
 * September 2026 is the Issue's own example: the 21st 敬老の日, the 22nd a
 * 国民の休日 caught between it and 秋分の日 on the 23rd.
 */

const named = (year: number) =>
  new Map(holidaysInYear(year).map((h) => [h.date, h.name]));

describe("japaneseHolidays — fixed and Happy-Monday days", () => {
  it("places the fixed dates", () => {
    const y = named(2026);
    expect(y.get("2026-01-01")).toBe("元日");
    expect(y.get("2026-02-11")).toBe("建国記念の日");
    expect(y.get("2026-02-23")).toBe("天皇誕生日");
    expect(y.get("2026-04-29")).toBe("昭和の日");
    expect(y.get("2026-05-03")).toBe("憲法記念日");
    expect(y.get("2026-08-11")).toBe("山の日");
    expect(y.get("2026-11-03")).toBe("文化の日");
    expect(y.get("2026-11-23")).toBe("勤労感謝の日");
  });

  it("walks the Happy-Monday days to their Monday", () => {
    const y2026 = named(2026);
    expect(y2026.get("2026-01-12")).toBe("成人の日");
    expect(y2026.get("2026-07-20")).toBe("海の日");
    expect(y2026.get("2026-09-21")).toBe("敬老の日");
    expect(y2026.get("2026-10-12")).toBe("スポーツの日");
    // A second year, so none of the four can pass on a hardcoded date.
    const y2027 = named(2027);
    expect(y2027.get("2027-01-11")).toBe("成人の日");
    expect(y2027.get("2027-07-19")).toBe("海の日");
    expect(y2027.get("2027-09-20")).toBe("敬老の日");
    expect(y2027.get("2027-10-11")).toBe("スポーツの日");
  });

  it("puts every Happy-Monday day on an actual Monday", () => {
    const movable = new Set(["成人の日", "海の日", "敬老の日", "スポーツの日"]);
    for (let year = 2020; year <= 2040; year += 1) {
      for (const h of holidaysInYear(year)) {
        if (!movable.has(h.name)) continue;
        const [y, m, d] = h.date.split("-").map(Number);
        expect(`${h.name} ${h.date} ${new Date(y, m - 1, d).getDay()}`).toBe(
          `${h.name} ${h.date} 1`,
        );
      }
    }
  });

  it("computes both equinoxes", () => {
    expect(named(2026).get("2026-03-20")).toBe("春分の日");
    expect(named(2026).get("2026-09-23")).toBe("秋分の日");
    // A different year, so neither can pass on a hardcoded pair.
    expect(named(2027).get("2027-03-21")).toBe("春分の日");
    expect(named(2027).get("2027-09-23")).toBe("秋分の日");
  });
});

describe("japaneseHolidays — the two follow-on rules", () => {
  it("makes the day between two holidays a 国民の休日", () => {
    // The Issue's example: 9/21 敬老の日, 9/23 秋分の日, and the Tuesday
    // between them becomes a holiday of its own.
    expect(named(2026).get("2026-09-22")).toBe("国民の休日");
  });

  it("moves a Sunday holiday to the next day that is free", () => {
    // 2027-03-21 春分の日 is a Sunday with nothing beside it, so the
    // substitute is the very next day.
    expect(named(2027).get("2027-03-22")).toBe("振替休日");
  });

  it("walks the substitute PAST the holidays that follow it", () => {
    // 2026-05-03 憲法記念日 is a Sunday, but 5/4 and 5/5 are holidays too —
    // the substitute has to land on 5/6, not on 5/4.
    const y = named(2026);
    expect(y.get("2026-05-04")).toBe("みどりの日");
    expect(y.get("2026-05-05")).toBe("こどもの日");
    expect(y.get("2026-05-06")).toBe("振替休日");
  });

  it("never marks a Sunday as a 国民の休日", () => {
    // A Sunday is already a day off and its neighbour would take the
    // substitute instead — marking it would count the same day twice.
    for (let year = 2020; year <= 2040; year += 1) {
      for (const h of holidaysInYear(year)) {
        if (h.name !== "国民の休日") continue;
        const [y, m, d] = h.date.split("-").map(Number);
        expect(`${h.date} ${new Date(y, m - 1, d).getDay()}`).not.toMatch(
          / 0$/,
        );
      }
    }
  });

  it("gives every year one entry per day", () => {
    for (let year = 2020; year <= 2040; year += 1) {
      const dates = holidaysInYear(year).map((h) => h.date);
      expect(new Set(dates).size).toBe(dates.length);
    }
  });
});

describe("holidaysInRange", () => {
  it("returns the holidays inside the window, in order", () => {
    expect(holidaysInRange("2026-09-01", "2026-09-30")).toEqual([
      { date: "2026-09-21", name: "敬老の日" },
      { date: "2026-09-22", name: "国民の休日" },
      { date: "2026-09-23", name: "秋分の日" },
    ]);
  });

  it("spans a year boundary", () => {
    // Nothing between Christmas and New Year is a holiday by law, so the
    // window's only entry is the one on the far side of the boundary.
    expect(holidaysInRange("2026-12-28", "2027-01-05")).toEqual([
      { date: "2027-01-01", name: "元日" },
    ]);
  });

  it("answers nothing for an inverted or out-of-span window", () => {
    expect(holidaysInRange("2026-09-30", "2026-09-01")).toEqual([]);
    // Outside the equinox polynomial's trusted range: better a calendar with
    // no holidays on it than one with the wrong day on it.
    expect(holidaysInRange("2200-01-01", "2200-12-31")).toEqual([]);
    expect(holidaysInRange("1900-01-01", "1900-12-31")).toEqual([]);
  });
});
