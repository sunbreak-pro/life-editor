import { describe, expect, it } from "vitest";
import * as server from "../src/utils/aiCustomization.js";
import * as shared from "../../shared/src/services/aiCustomizationLimits.js";

/*
 * The server's copy of the Claude customization limits (#2121) against the
 * app's (#2118). shared's own suite pins its file to the 0037 CHECKs; this one
 * pins the copy to shared, so the tools and the editing screen refuse exactly
 * the same values.
 */

const PROBES = [
  "",
  " ",
  " ",
  "a",
  "abc-123",
  "-abc",
  "abc-",
  "a--b",
  "ABC",
  "con",
  "com1",
  "console",
  "line\nbreak",
  "line\rbreak",
  "😀".repeat(1_000),
  "😀".repeat(1_001),
  "x".repeat(64),
  "x".repeat(65),
  "x".repeat(1_024),
  "x".repeat(1_025),
  "x".repeat(40_000),
  "x".repeat(40_001),
];

describe("the server's limits match shared's", () => {
  it("uses the same numbers", () => {
    expect(server.AI_RULE_BODY_MAX_CHARS).toBe(shared.AI_RULE_BODY_MAX_CHARS);
    expect(server.AI_MEMORY_BODY_MAX_CHARS).toBe(
      shared.AI_MEMORY_BODY_MAX_CHARS,
    );
    expect(server.AI_SKILL_SLUG_MAX_CHARS).toBe(shared.AI_SKILL_SLUG_MAX_CHARS);
    expect(server.AI_SKILL_DESCRIPTION_MAX_CHARS).toBe(
      shared.AI_SKILL_DESCRIPTION_MAX_CHARS,
    );
    expect(server.AI_SKILL_BODY_MAX_CHARS).toBe(shared.AI_SKILL_BODY_MAX_CHARS);
  });

  it.each(PROBES.map((p) => [JSON.stringify(p).slice(0, 24), p]))(
    "gives the same verdicts for %s",
    (_label, probe) => {
      expect(server.countChars(probe)).toBe(shared.countChars(probe));
      expect(server.aiMemoryBodyIssue(probe)).toBe(
        shared.aiMemoryBodyIssue(probe),
      );
      expect(server.aiSkillSlugIssue(probe)).toBe(
        shared.aiSkillSlugIssue(probe),
      );
      expect(server.aiSkillDescriptionIssue(probe)).toBe(
        shared.aiSkillDescriptionIssue(probe),
      );
      expect(server.aiSkillBodyIssue(probe)).toBe(
        shared.aiSkillBodyIssue(probe),
      );
    },
  );
});
