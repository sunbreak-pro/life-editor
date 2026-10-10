import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  goalPeriodKey,
  isGoalPeriodKey,
  judgeGoals,
  type GoalAchievement,
  type GoalAchievementInput,
  type GoalPeriodKind,
} from "../src/utils/goalAchievement.js";

/*
 * #2102 — the MCP copy of the goal rule must answer exactly like shared's.
 *
 * This server does not depend on shared, so the functions are repeated in
 * src/utils/goalAchievement.ts. Two guards, because each misses what the
 * other catches:
 *   - the cases: the same JSON file shared's suite runs, read from shared's
 *     tests (a test-time file read, not a package dependency — the same way
 *     toolCatalogFreshness.test.ts reads shared's generated catalog);
 *   - the text: the two files must be identical below the marker line, so an
 *     edit to one copy that no case happens to exercise still fails here.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string): string =>
  readFileSync(resolve(here, path), "utf8").replace(/\r\n/g, "\n");

interface Fixture {
  periodKeys: { kind: GoalPeriodKind; date: string; key: string }[];
  periodKeyValidity: { kind: GoalPeriodKind; key: string; valid: boolean }[];
  achievement: (GoalAchievementInput & {
    name: string;
    expected: Record<string, GoalAchievement>;
  })[];
}

const fixture = JSON.parse(
  read("../../shared/tests/fixtures/goalAchievement.json"),
) as Fixture;

describe("goalPeriodKey (shared fixture)", () => {
  it.each(fixture.periodKeys)(
    "$kind of $date is $key",
    ({ kind, date, key }) => {
      expect(goalPeriodKey(kind, date)).toBe(key);
    },
  );
});

describe("isGoalPeriodKey (shared fixture)", () => {
  it.each(fixture.periodKeyValidity)(
    "$kind key $key → $valid",
    ({ kind, key, valid }) => {
      expect(isGoalPeriodKey(kind, key)).toBe(valid);
    },
  );
});

describe("judgeGoals (shared fixture)", () => {
  it.each(fixture.achievement)("$name", ({ goals, todos, links, expected }) => {
    expect(judgeGoals({ goals, todos, links })).toEqual(expected);
  });
});

describe("the two copies", () => {
  it("are identical below the marker line", () => {
    const MARKER = "// ── IDENTICAL BELOW THIS LINE";
    const body = (text: string): string => {
      const at = text.indexOf(MARKER);
      expect(at).toBeGreaterThan(-1);
      return text.slice(at);
    };
    expect(body(read("../src/utils/goalAchievement.ts"))).toBe(
      body(read("../../shared/src/utils/goalAchievement.ts")),
    );
  });
});
