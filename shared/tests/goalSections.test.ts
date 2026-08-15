import { describe, it, expect } from "vitest";
import {
  extractGoals,
  goalPeriodRanges,
  mergeGoalSection,
  type GoalPeriod,
} from "../src/components";

/*
 * The goals note's three heading sections (#872).
 *
 * What matters here is the same invariant the 宣言 merge has: a save touches
 * ONLY its own [heading, next heading) range. The goals note holds three of
 * them side by side, so a week save that ate the month goal — or a Notes-side
 * paragraph — would be silent data loss with no undo.
 */

interface Node {
  type: string;
  attrs?: Record<string, unknown>;
  content?: { type: string; text: string }[];
}

function doc(...nodes: Node[]): string {
  return JSON.stringify({ type: "doc", content: nodes });
}

function heading(text: string): Node {
  return {
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text }],
  };
}

function para(text: string): Node {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

/** Top-level block texts of a merged document, headings included. */
function blocks(contentJson: string): string[] {
  const parsed = JSON.parse(contentJson) as { content: Node[] };
  return parsed.content.map(
    (n) => n.content?.map((c) => c.text).join("") ?? "",
  );
}

const FULL = doc(
  heading("週目標"),
  para("Ship the goals block"),
  heading("月目標"),
  para("Finish the migration"),
  heading("年目標"),
  para("Live by the paper"),
);

describe("extractGoals", () => {
  it("reads all three sections", () => {
    expect(extractGoals(FULL)).toEqual({
      week: "Ship the goals block",
      month: "Finish the migration",
      year: "Live by the paper",
    });
  });

  it("joins multi-line and list bodies one line per block", () => {
    const body = doc(heading("週目標"), para("Line one"), {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "text", text: "Line two" }] },
      ],
    } as unknown as Node);
    expect(extractGoals(body).week).toBe("Line one\nLine two");
  });

  it("accepts the English and long-form headings", () => {
    const body = doc(
      heading("Weekly goals"),
      para("W"),
      heading("今月の目標"),
      para("M"),
      heading("ANNUAL GOAL"),
      para("Y"),
    );
    expect(extractGoals(body)).toEqual({ week: "W", month: "M", year: "Y" });
  });

  it("returns nulls for a missing note, an empty body and plain text", () => {
    const nulls = { week: null, month: null, year: null };
    expect(extractGoals(null)).toEqual(nulls);
    expect(extractGoals("")).toEqual(nulls);
    expect(extractGoals("just some legacy plain text")).toEqual(nulls);
    expect(extractGoals(doc(heading("週目標")))).toEqual(nulls);
  });
});

describe("mergeGoalSection", () => {
  it("creates the sections in week → month → year order", () => {
    let body = mergeGoalSection(null, "year", "Y");
    body = mergeGoalSection(body, "week", "W");
    body = mergeGoalSection(body, "month", "M");
    expect(blocks(body)).toEqual(["週目標", "W", "月目標", "M", "年目標", "Y"]);
  });

  it("replaces only its own section", () => {
    const merged = mergeGoalSection(FULL, "month", "Something else");
    expect(extractGoals(merged)).toEqual({
      week: "Ship the goals block",
      month: "Something else",
      year: "Live by the paper",
    });
  });

  it("leaves non-goal blocks written from the Notes side untouched", () => {
    const withNotes = doc(
      para("A note-side preamble"),
      heading("週目標"),
      para("W"),
      heading("メモ"),
      para("Notes-side section"),
    );
    const merged = mergeGoalSection(withNotes, "week", "W2");
    expect(blocks(merged)).toEqual([
      "A note-side preamble",
      "週目標",
      "W2",
      "メモ",
      "Notes-side section",
    ]);
  });

  it("writes one paragraph per line and trims blank ones", () => {
    const merged = mergeGoalSection(null, "week", "  one  \n\n two \n");
    expect(blocks(merged)).toEqual(["週目標", "one", "two"]);
  });

  it("removes the section when the text normalizes to empty", () => {
    const merged = mergeGoalSection(FULL, "week", "   \n  ");
    expect(extractGoals(merged).week).toBeNull();
    expect(blocks(merged)).toEqual([
      "月目標",
      "Finish the migration",
      "年目標",
      "Live by the paper",
    ]);
  });

  it("returns the input unchanged when there is nothing to do", () => {
    // The no-op is what keeps opening the paper from creating the note.
    expect(mergeGoalSection(null, "week", "")).toBe("");
    expect(mergeGoalSection("", "week", null)).toBe("");
    expect(mergeGoalSection(FULL, "week", "Ship the goals block")).toBe(FULL);
  });
});

describe("goalPeriodRanges", () => {
  const periods: GoalPeriod[] = ["week", "month", "year"];

  it("spans the week the day falls in, honouring the week-start pref", () => {
    // 2026-08-13 is a Thursday.
    expect(goalPeriodRanges("2026-08-13", 0, "en-US").week).toBe("8/9 – 8/15");
    expect(goalPeriodRanges("2026-08-13", 1, "en-US").week).toBe("8/10 – 8/16");
  });

  it("keeps a week that crosses a month boundary", () => {
    expect(goalPeriodRanges("2026-09-01", 1, "en-US").week).toBe("8/31 – 9/6");
  });

  it("labels the month and the year of the day", () => {
    const en = goalPeriodRanges("2026-08-13", 0, "en-US");
    expect(en.month).toBe("August");
    expect(en.year).toBe("2026");
    const ja = goalPeriodRanges("2026-08-13", 0, "ja-JP");
    expect(ja.month).toContain("8");
    expect(ja.year).toContain("2026");
  });

  it("fills every period", () => {
    const ranges = goalPeriodRanges("2026-08-13", 0, "en-US");
    for (const period of periods) expect(ranges[period]).not.toBe("");
  });
});
