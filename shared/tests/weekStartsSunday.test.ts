import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  WEEK_STARTS_ON,
  monthGridKeys,
  startOfWeekKey,
} from "../src/utils/scheduleGridLayout";
import { calendarWeekRange } from "../src/utils/analyticsAggregation";
import { goalPeriodKeys } from "../src/components/briefing/goalPeriods";

/*
 * #1102 — the week starts on Sunday and nothing moves it.
 *
 * The switchable preference (`life-editor-week-start`, #217) is gone. It never
 * had a Settings UI, and the one thing a hand-written "1" could still do was
 * file this week's goal under a key the paper stops reading the moment the
 * value changes (D-20260816-briefing-1). Two nets:
 *
 *   1. a stale "1" in localStorage moves no boundary — nothing reads the key;
 *   2. no source file names the key or the retired hook.
 *
 * (2) is the important one. The grid math still TAKES a week start (its Monday
 * case is what pins the step-back arithmetic that drifted in #860), so a
 * consumer that resolved its own would type-check, render, and pass every
 * other suite in the repo. A leftover reader is invisible to everything except
 * a search.
 */

const STALE_KEY = "life-editor-week-start";

/** Wed 2026-08-19. Its Sunday-started week opens 08-16; a Monday one, 08-17. */
const WEDNESDAY = "2026-08-19";

beforeEach(() => {
  // What a hand edit (or a pre-#1102 install) leaves behind.
  localStorage.setItem(STALE_KEY, "1");
});

afterEach(() => {
  localStorage.clear();
});

describe("week start (#1102)", () => {
  it("is Sunday", () => {
    expect(WEEK_STARTS_ON).toBe(0);
  });

  it("snaps a date key back to Sunday, not to the stored Monday", () => {
    expect(startOfWeekKey(WEDNESDAY, WEEK_STARTS_ON)).toBe("2026-08-16");
  });

  it("opens every month-grid row on a Sunday", () => {
    const rows = monthGridKeys(WEDNESDAY, WEEK_STARTS_ON);
    // 2026-08-01 is a Saturday, so the grid starts in the previous month.
    expect(rows[0]?.[0]).toBe("2026-07-26");
    for (const row of rows) {
      expect(new Date(`${row[0]}T00:00:00`).getDay()).toBe(0);
    }
  });

  it("files a goal under the Sunday week key", () => {
    expect(goalPeriodKeys(WEDNESDAY, WEEK_STARTS_ON).week).toBe("2026-08-16");
  });

  it("runs the Analytics week from Sunday to Saturday", () => {
    expect(
      calendarWeekRange(new Date(2026, 7, 19, 10, 0, 0), WEEK_STARTS_ON),
    ).toEqual({ startKey: "2026-08-16", endKey: "2026-08-22" });
  });
});

/** Every .ts / .tsx file under `dir`, recursively. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = `${dir}/${entry}`;
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

describe("no source still reads a stored week start (#1102)", () => {
  const RETIRED = [STALE_KEY, "useWeekStartPref", "hooks/useWeekStart"];

  for (const rel of ["../src", "../../web/src"]) {
    it(`${rel} names none of them`, () => {
      const root = fileURLToPath(new URL(rel, import.meta.url));
      const files = sourceFiles(root);
      // A wrong path would scan nothing and pass — say so instead.
      expect(files.length).toBeGreaterThan(50);

      const offenders = files.filter((f) => {
        const src = readFileSync(f, "utf8");
        return RETIRED.some((token) => src.includes(token));
      });
      expect(offenders).toEqual([]);
    });
  }
});
