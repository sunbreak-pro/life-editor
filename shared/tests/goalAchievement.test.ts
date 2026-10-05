// @vitest-environment node (this suite touches no DOM)
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
} from "../src/utils/goalAchievement";
import type { GoalPeriodKind } from "../src/types/goal";

/*
 * #2102 — goal achievement and period keys.
 *
 * The cases live in a JSON file, not in this suite, because the MCP server
 * carries its own copy of the same functions (it does not depend on shared)
 * and must give the same answers. mcp-server/tests/goalAchievement.test.ts
 * runs every case below against its copy. Add a case to the JSON and both
 * sides are held to it.
 */

interface Fixture {
  periodKeys: { kind: GoalPeriodKind; date: string; key: string }[];
  periodKeyValidity: { kind: GoalPeriodKind; key: string; valid: boolean }[];
  achievement: (GoalAchievementInput & {
    name: string;
    expected: Record<string, GoalAchievement>;
  })[];
}

const fixture = JSON.parse(
  readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "fixtures/goalAchievement.json",
    ),
    "utf8",
  ),
) as Fixture;

describe("goalPeriodKey (shared fixture)", () => {
  it.each(fixture.periodKeys)(
    "$kind of $date is $key",
    ({ kind, date, key }) => {
      expect(goalPeriodKey(kind, date)).toBe(key);
    },
  );

  it("refuses a date that is not a real YYYY-MM-DD day", () => {
    expect(() => goalPeriodKey("week", "2026-02-31")).toThrow(
      /not a YYYY-MM-DD/,
    );
    expect(() => goalPeriodKey("month", "2026/10/05")).toThrow(
      /not a YYYY-MM-DD/,
    );
  });
});

describe("isGoalPeriodKey (shared fixture)", () => {
  it.each(fixture.periodKeyValidity)(
    "$kind key $key → $valid",
    ({ kind, key, valid }) => {
      expect(isGoalPeriodKey(kind, key)).toBe(valid);
    },
  );

  it("accepts every key goalPeriodKey produces", () => {
    for (const { kind, key } of fixture.periodKeys) {
      expect(isGoalPeriodKey(kind, key)).toBe(true);
    }
  });
});

describe("judgeGoals (shared fixture)", () => {
  it.each(fixture.achievement)("$name", ({ goals, todos, links, expected }) => {
    expect(judgeGoals({ goals, todos, links })).toEqual(expected);
  });

  it("covers every case the Issue names", () => {
    // achieved / not achieved / unconnected / period-end decision / deleted
    // todo / subtask — #2102 DoD. Guards against the JSON losing one.
    const names = fixture.achievement.map((c) => c.name).join("\n");
    for (const needle of [
      "achieved by links",
      "not achieved",
      "unconnected",
      "period-end",
      "deleted todo",
      "subtask",
    ]) {
      expect(names).toContain(needle);
    }
  });

  it("leaves `via` null exactly when the goal is not achieved", () => {
    for (const { goals, todos, links } of fixture.achievement) {
      for (const judged of Object.values(judgeGoals({ goals, todos, links }))) {
        expect(judged.via === null).toBe(!judged.achieved);
      }
    }
  });
});
