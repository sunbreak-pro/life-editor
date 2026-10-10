// @vitest-environment node (#1079 — this suite touches no DOM)
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AI_MEMORY_BODY_MAX_CHARS,
  AI_RULE_BODY_MAX_CHARS,
  AI_SKILL_BODY_MAX_CHARS,
  AI_SKILL_DESCRIPTION_MAX_CHARS,
  AI_SKILL_SLUG_MAX_CHARS,
  AiCustomizationValidationError,
  aiMemoryBodyIssue,
  aiRuleBodyIssue,
  aiSkillDescriptionIssue,
  aiSkillIssues,
  aiSkillSlugIssue,
  countChars,
  throwFirstAiIssue,
} from "../src/services/aiCustomizationLimits";
import {
  aiSkillToSkillMarkdown,
  aiSkillUpdatesToPatch,
  rowToAiMemory,
  rowToAiRule,
  rowToAiSkill,
} from "../src/services/aiCustomizationMapper";

/*
 * #2118 — the limits of the Claude customization data, and the row mapping.
 *
 * The limits exist twice: as CHECKs in 0037 (the last word) and as constants
 * the service checks before writing and the editing screen shows. The lockstep
 * block reads the migration, so changing one without the other fails here
 * instead of as a raw 23514 in production.
 */

const migration = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../supabase/migrations/0037_ai_customization.sql",
  ),
  "utf8",
)
  .replace(/\r\n/g, "\n")
  // Comments restate the numbers in prose; only the DDL counts.
  .replace(/--.*$/gm, "");

/** The `<= N` of `char_length(<column>) <= N` inside `create table <table>`. */
function limitIn(table: string, column: string): number {
  const start = migration.indexOf(`create table if not exists public.${table}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf(");\n", start);
  const ddl = migration.slice(start, end);
  const m = new RegExp(`char_length\\(${column}\\) <= (\\d+)`).exec(ddl);
  expect(m).not.toBeNull();
  return Number(m![1]);
}

describe("limits match the 0037 CHECKs", () => {
  it("uses the same numbers as the DB", () => {
    expect(limitIn("ai_rules", "body")).toBe(AI_RULE_BODY_MAX_CHARS);
    expect(limitIn("ai_memories", "body")).toBe(AI_MEMORY_BODY_MAX_CHARS);
    expect(limitIn("ai_skills", "slug")).toBe(AI_SKILL_SLUG_MAX_CHARS);
    expect(limitIn("ai_skills", "description")).toBe(
      AI_SKILL_DESCRIPTION_MAX_CHARS,
    );
    expect(limitIn("ai_skills", "body")).toBe(AI_SKILL_BODY_MAX_CHARS);
  });

  it("uses the same patterns as the DB", () => {
    expect(migration).toContain("slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'");
    expect(migration).toContain(
      "slug !~ '^(con|prn|aux|nul|com[1-9]|lpt[1-9])$'",
    );
    expect(migration).toContain("body ~ '[^[:space:]]'");
    expect(migration).toContain("description ~ '[^[:space:]]'");
    expect(migration).toContain("description !~ '[\\r\\n]'");
  });
});

describe("countChars", () => {
  it("counts characters the way Postgres char_length does", () => {
    // "😀" is one character for the DB and two UTF-16 units for .length.
    expect("😀".length).toBe(2);
    expect(countChars("😀")).toBe(1);
    expect(countChars("あいう")).toBe(3);
    expect(countChars("")).toBe(0);
  });

  it("lets an emoji body at the limit through", () => {
    const body = "😀".repeat(AI_MEMORY_BODY_MAX_CHARS);
    expect(aiMemoryBodyIssue(body)).toBeNull();
    expect(aiMemoryBodyIssue(`${body}x`)).toBe("tooLong");
  });
});

describe("rule / memory bodies", () => {
  it("allows an empty rule but not one past the limit", () => {
    expect(aiRuleBodyIssue("")).toBeNull();
    expect(aiRuleBodyIssue("a".repeat(AI_RULE_BODY_MAX_CHARS))).toBeNull();
    expect(aiRuleBodyIssue("a".repeat(AI_RULE_BODY_MAX_CHARS + 1))).toBe(
      "tooLong",
    );
  });

  it("refuses a blank memory, including one of only line breaks", () => {
    expect(aiMemoryBodyIssue("")).toBe("empty");
    expect(aiMemoryBodyIssue(" \n\t ")).toBe("empty");
    expect(aiMemoryBodyIssue("1 行目\n2 行目")).toBeNull();
  });
});

describe("skill fields", () => {
  it("accepts kebab-case slugs only", () => {
    for (const ok of ["a", "weekly-review", "step-2-check", "x1"]) {
      expect(aiSkillSlugIssue(ok)).toBeNull();
    }
    for (const bad of [
      "Weekly",
      "weekly_review",
      "-lead",
      "trail-",
      "double--hyphen",
      "with space",
      "日本語",
    ]) {
      expect(aiSkillSlugIssue(bad)).toBe("badSlug");
    }
    // Windows refuses these as folder names, so #2120 could not write them.
    for (const reserved of ["con", "nul", "com1", "lpt9"]) {
      expect(aiSkillSlugIssue(reserved)).toBe("badSlug");
    }
    expect(aiSkillSlugIssue("con-notes")).toBeNull();
    expect(aiSkillSlugIssue("")).toBe("empty");
    expect(aiSkillSlugIssue("a".repeat(AI_SKILL_SLUG_MAX_CHARS + 1))).toBe(
      "tooLong",
    );
  });

  it("wants a one-line, non-blank description", () => {
    expect(aiSkillDescriptionIssue("週次のふり返りをする")).toBeNull();
    expect(aiSkillDescriptionIssue("  ")).toBe("empty");
    expect(aiSkillDescriptionIssue("1 行目\n2 行目")).toBe("multiline");
    expect(aiSkillDescriptionIssue("a\rb")).toBe("multiline");
    expect(
      aiSkillDescriptionIssue("a".repeat(AI_SKILL_DESCRIPTION_MAX_CHARS + 1)),
    ).toBe("tooLong");
  });

  it("checks only the fields present", () => {
    expect(aiSkillIssues({})).toEqual({});
    expect(aiSkillIssues({ body: "" })).toEqual({});
    expect(aiSkillIssues({ slug: "Bad", description: "" })).toEqual({
      slug: "badSlug",
      description: "empty",
    });
  });

  it("throws the first issue as a typed error naming the field", () => {
    expect(() =>
      throwFirstAiIssue({ description: "empty", body: "tooLong" }, "label"),
    ).toThrow(AiCustomizationValidationError);
    try {
      throwFirstAiIssue({ description: "empty", body: "tooLong" }, "label");
    } catch (e) {
      const err = e as AiCustomizationValidationError;
      expect(err.field).toBe("description");
      expect(err.issue).toBe("empty");
      expect(err.message).toBe("label: description is empty");
    }
    expect(() => throwFirstAiIssue({}, "label")).not.toThrow();
  });
});

describe("row mapping", () => {
  const stamps = {
    created_at: "2026-10-10T00:00:00Z",
    updated_at: "2026-10-10T01:00:00Z",
  };

  it("maps each row to its type without the user_id", () => {
    expect(rowToAiRule({ user_id: "u", body: "rule", ...stamps })).toEqual({
      body: "rule",
      createdAt: stamps.created_at,
      updatedAt: stamps.updated_at,
    });
    expect(
      rowToAiMemory({
        id: "aimemory-1",
        user_id: "u",
        body: "memo",
        sort_order: 3,
        ...stamps,
      }),
    ).toEqual({
      id: "aimemory-1",
      body: "memo",
      sortOrder: 3,
      createdAt: stamps.created_at,
      updatedAt: stamps.updated_at,
    });
    expect(
      rowToAiSkill({
        id: "aiskill-1",
        user_id: "u",
        slug: "s",
        description: "d",
        body: "b",
        ...stamps,
      }),
    ).toEqual({
      id: "aiskill-1",
      slug: "s",
      description: "d",
      body: "b",
      createdAt: stamps.created_at,
      updatedAt: stamps.updated_at,
    });
  });

  it("always bumps updated_at and emits only the keys given", () => {
    expect(aiSkillUpdatesToPatch({}, "NOW")).toEqual({ updated_at: "NOW" });
    expect(aiSkillUpdatesToPatch({ body: "" }, "NOW")).toEqual({
      body: "",
      updated_at: "NOW",
    });
  });
});

describe("aiSkillToSkillMarkdown", () => {
  it("writes the frontmatter and the body", () => {
    expect(
      aiSkillToSkillMarkdown({
        slug: "weekly-review",
        description: "週次のふり返りをするときに使う",
        body: "# 手順\n\n1. 予定を見る\n",
      }),
    ).toBe(
      [
        "---",
        'name: "weekly-review"',
        'description: "週次のふり返りをするときに使う"',
        "---",
        "",
        "# 手順",
        "",
        "1. 予定を見る",
        "",
      ].join("\n"),
    );
  });

  it("quotes a description YAML would otherwise misread", () => {
    const md = aiSkillToSkillMarkdown({
      slug: "s",
      description: 'Use when: "deploy" # now',
      body: "",
    });
    expect(md).toBe(
      '---\nname: "s"\ndescription: "Use when: \\"deploy\\" # now"\n---\n\n',
    );
  });

  it("normalises CRLF in the body", () => {
    expect(
      aiSkillToSkillMarkdown({ slug: "s", description: "d", body: "a\r\nb" }),
    ).toBe('---\nname: "s"\ndescription: "d"\n---\n\na\nb\n');
  });

  it("keeps a numeric-looking slug a string", () => {
    // `123`, `true` and `null` pass the kebab-case shape; unquoted, YAML would
    // read them as a number / boolean / null instead of a name.
    for (const slug of ["123", "true", "null"]) {
      expect(
        aiSkillToSkillMarkdown({ slug, description: "d", body: "" }),
      ).toContain(`name: "${slug}"\n`);
    }
  });
});
