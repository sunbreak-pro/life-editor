// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  adoptBareGoalHeadings,
  extractGoals,
  goalPeriodKeys,
  goalPeriodRanges,
  mergeGoalSection,
  type GoalPeriod,
  type GoalPeriodKeys,
} from "../src/components";

/*
 * The goals note's heading sections (#872, period-keyed in #957).
 *
 * Two invariants carry everything here.
 *
 * 1. A save touches ONLY its own [heading, next heading) range. Three periods
 *    live side by side and, since #957, every period a goal was ever written
 *    for stays in the note as history — so a week save that ate the month goal,
 *    last week's goal, or a Notes-side paragraph would be silent data loss
 *    with no undo.
 * 2. The paper reads and writes the CURRENT key only. That single rule IS the
 *    rollover: when the week turns over there is no section under the new key,
 *    so the field is empty and the old one is untouched.
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

/** The week of 2026-08-13 (a Thursday) with a Monday start. */
const KEYS: GoalPeriodKeys = {
  week: "2026-08-10",
  month: "2026-08",
  year: "2026",
};
/** The period before each of the above — what history is filed under. */
const PREV: GoalPeriodKeys = {
  week: "2026-08-03",
  month: "2026-07",
  year: "2025",
};

const FULL = doc(
  heading("週目標 2026-08-10"),
  para("Ship the goals block"),
  heading("月目標 2026-08"),
  para("Finish the migration"),
  heading("年目標 2026"),
  para("Live by the paper"),
);

/** How a note written before #957 looks: the heading word, no key. */
const LEGACY = doc(
  heading("週目標"),
  para("Ship the goals block"),
  heading("年目標"),
  para("Live by the paper"),
);

describe("extractGoals", () => {
  it("reads all three of the current period's sections", () => {
    expect(extractGoals(FULL, KEYS)).toEqual({
      week: "Ship the goals block",
      month: "Finish the migration",
      year: "Live by the paper",
    });
  });

  it("joins multi-line and list bodies one line per block", () => {
    const body = doc(heading("週目標 2026-08-10"), para("Line one"), {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "text", text: "Line two" }] },
      ],
    } as unknown as Node);
    expect(extractGoals(body, KEYS).week).toBe("Line one\nLine two");
  });

  it("accepts the English and long-form headings", () => {
    const body = doc(
      heading("Weekly goals 2026-08-10"),
      para("W"),
      heading("今月の目標 2026-08"),
      para("M"),
      heading("ANNUAL GOAL 2026"),
      para("Y"),
    );
    expect(extractGoals(body, KEYS)).toEqual({
      week: "W",
      month: "M",
      year: "Y",
    });
  });

  it("returns nulls for a missing note, an empty body and plain text", () => {
    const nulls = { week: null, month: null, year: null };
    expect(extractGoals(null, KEYS)).toEqual(nulls);
    expect(extractGoals("", KEYS)).toEqual(nulls);
    expect(extractGoals("just some legacy plain text", KEYS)).toEqual(nulls);
    expect(extractGoals(doc(heading("週目標 2026-08-10")), KEYS)).toEqual(
      nulls,
    );
  });
});

/*
 * #957 — the rollover itself. Nothing runs on a schedule and nothing is moved;
 * the key in the heading is the whole mechanism.
 */
describe("period rollover (#957)", () => {
  const WITH_HISTORY = doc(
    heading("週目標 2026-08-10"),
    para("This week"),
    heading("週目標 2026-08-03"),
    para("Last week"),
  );

  it("shows only the current period and never the history beside it", () => {
    expect(extractGoals(WITH_HISTORY, KEYS).week).toBe("This week");
  });

  it("empties the field when the period turns over, keeping the old text", () => {
    const nextWeek: GoalPeriodKeys = { ...KEYS, week: "2026-08-17" };
    expect(extractGoals(WITH_HISTORY, nextWeek).week).toBeNull();
    // Untouched: both sections are still in the note.
    expect(blocks(WITH_HISTORY)).toContain("週目標 2026-08-03");
  });

  it("rolls each period independently", () => {
    const nextMonth: GoalPeriodKeys = { ...KEYS, month: "2026-09" };
    const rolled = extractGoals(FULL, nextMonth);
    expect(rolled.month).toBeNull();
    expect(rolled.week).toBe("Ship the goals block");
    expect(rolled.year).toBe("Live by the paper");
  });

  it("writes the new period beside the old one, not over it", () => {
    const nextWeek: GoalPeriodKeys = { ...KEYS, week: "2026-08-17" };
    const merged = mergeGoalSection(
      WITH_HISTORY,
      "week",
      nextWeek.week,
      "Next week",
    );
    expect(extractGoals(merged, nextWeek).week).toBe("Next week");
    expect(extractGoals(merged, KEYS).week).toBe("This week");
    expect(extractGoals(merged, PREV).week).toBe("Last week");
  });

  it("puts the new period's section above the history", () => {
    const nextWeek: GoalPeriodKeys = { ...KEYS, week: "2026-08-17" };
    const merged = mergeGoalSection(
      WITH_HISTORY,
      "week",
      nextWeek.week,
      "Next week",
    );
    expect(blocks(merged)).toEqual([
      "週目標 2026-08-17",
      "Next week",
      "週目標 2026-08-10",
      "This week",
      "週目標 2026-08-03",
      "Last week",
    ]);
  });

  it("clearing the current period leaves the history alone", () => {
    const merged = mergeGoalSection(WITH_HISTORY, "week", KEYS.week, "  ");
    expect(extractGoals(merged, KEYS).week).toBeNull();
    expect(extractGoals(merged, PREV).week).toBe("Last week");
  });

  it("keeps a bare heading and a keyed one apart (anchored REs)", () => {
    // The migration detector rests on this: loosen either anchor and a merge
    // would be handed the wrong section, overwriting history with no undo.
    const mixed = doc(
      heading("週目標 2026-08-03"),
      para("Last week"),
      heading("週目標"),
      para("Legacy"),
    );
    // The keyed section for THIS week does not exist, so the bare one is
    // adopted — not the differently-keyed one sitting above it.
    expect(extractGoals(mixed, KEYS).week).toBe("Legacy");
  });
});

/*
 * #957 — sections written before period keys existed. They must keep reading
 * (the goals must not blink out on the morning the change ships) and must stop
 * being bare, or an untouched one would re-adopt itself every week forever.
 */
describe("migration off the pre-#957 shape", () => {
  it("adopts a bare section as the current period on read", () => {
    expect(extractGoals(LEGACY, KEYS)).toEqual({
      week: "Ship the goals block",
      month: null,
      year: "Live by the paper",
    });
  });

  it("prefers a keyed section over a bare one", () => {
    const both = doc(
      heading("週目標 2026-08-10"),
      para("Keyed"),
      heading("週目標"),
      para("Bare"),
    );
    expect(extractGoals(both, KEYS).week).toBe("Keyed");
  });

  it("rewrites bare headings to the current key, text untouched", () => {
    const adopted = adoptBareGoalHeadings(LEGACY, KEYS);
    expect(blocks(adopted)).toEqual([
      "週目標 2026-08-10",
      "Ship the goals block",
      "年目標 2026",
      "Live by the paper",
    ]);
  });

  it("returns its input by identity when there is nothing to migrate", () => {
    expect(adoptBareGoalHeadings(FULL, KEYS)).toBe(FULL);
    expect(adoptBareGoalHeadings(null, KEYS)).toBe("");
    expect(adoptBareGoalHeadings("", KEYS)).toBe("");
    // Second run: the first one keyed everything.
    const once = adoptBareGoalHeadings(LEGACY, KEYS);
    expect(adoptBareGoalHeadings(once, KEYS)).toBe(once);
  });

  it("leaves an empty bare heading alone rather than seeding history", () => {
    const empty = doc(heading("週目標"));
    expect(adoptBareGoalHeadings(empty, KEYS)).toBe(empty);
  });

  it("never adopts over a period that already has a keyed section", () => {
    const both = doc(
      heading("週目標 2026-08-10"),
      para("Keyed"),
      heading("週目標"),
      para("Bare"),
    );
    expect(adoptBareGoalHeadings(both, KEYS)).toBe(both);
  });

  it("migrates a bare section in place on the first save", () => {
    const merged = mergeGoalSection(LEGACY, "week", KEYS.week, "Rewritten");
    expect(blocks(merged)).toEqual([
      "週目標 2026-08-10",
      "Rewritten",
      "年目標",
      "Live by the paper",
    ]);
  });
});

describe("mergeGoalSection", () => {
  it("creates the sections in week → month → year order", () => {
    let body = mergeGoalSection(null, "year", KEYS.year, "Y");
    body = mergeGoalSection(body, "week", KEYS.week, "W");
    body = mergeGoalSection(body, "month", KEYS.month, "M");
    expect(blocks(body)).toEqual([
      "週目標 2026-08-10",
      "W",
      "月目標 2026-08",
      "M",
      "年目標 2026",
      "Y",
    ]);
  });

  it("replaces only its own section", () => {
    const merged = mergeGoalSection(
      FULL,
      "month",
      KEYS.month,
      "Something else",
    );
    expect(extractGoals(merged, KEYS)).toEqual({
      week: "Ship the goals block",
      month: "Something else",
      year: "Live by the paper",
    });
  });

  it("leaves non-goal blocks written from the Notes side untouched", () => {
    const withNotes = doc(
      para("A note-side preamble"),
      heading("週目標 2026-08-10"),
      para("W"),
      heading("メモ"),
      para("Notes-side section"),
    );
    const merged = mergeGoalSection(withNotes, "week", KEYS.week, "W2");
    expect(blocks(merged)).toEqual([
      "A note-side preamble",
      "週目標 2026-08-10",
      "W2",
      "メモ",
      "Notes-side section",
    ]);
  });

  it("never inserts above a Notes-side preamble", () => {
    const withPreamble = doc(para("A note-side preamble"));
    const merged = mergeGoalSection(withPreamble, "week", KEYS.week, "W");
    expect(blocks(merged)[0]).toBe("A note-side preamble");
  });

  it("writes one paragraph per line and trims blank ones", () => {
    const merged = mergeGoalSection(
      null,
      "week",
      KEYS.week,
      "  one  \n\n two \n",
    );
    expect(blocks(merged)).toEqual(["週目標 2026-08-10", "one", "two"]);
  });

  it("removes the section when the text normalizes to empty", () => {
    const merged = mergeGoalSection(FULL, "week", KEYS.week, "   \n  ");
    expect(extractGoals(merged, KEYS).week).toBeNull();
    expect(blocks(merged)).toEqual([
      "月目標 2026-08",
      "Finish the migration",
      "年目標 2026",
      "Live by the paper",
    ]);
  });

  it("returns the input unchanged when there is nothing to do", () => {
    // The no-op is what keeps opening the paper from creating the note.
    expect(mergeGoalSection(null, "week", KEYS.week, "")).toBe("");
    expect(mergeGoalSection("", "week", KEYS.week, null)).toBe("");
    expect(
      mergeGoalSection(FULL, "week", KEYS.week, "Ship the goals block"),
    ).toBe(FULL);
  });
});

describe("goalPeriodKeys", () => {
  it("keys the week by its start date, honouring the week-start pref", () => {
    // 2026-08-13 is a Thursday.
    expect(goalPeriodKeys("2026-08-13", 0).week).toBe("2026-08-09");
    expect(goalPeriodKeys("2026-08-13", 1).week).toBe("2026-08-10");
  });

  it("keys the month and the year by prefix", () => {
    const keys = goalPeriodKeys("2026-08-13", 1);
    expect(keys.month).toBe("2026-08");
    expect(keys.year).toBe("2026");
  });

  it("agrees with the label the reader sees beside the field", () => {
    // Key and label are two faces of one period — if they ever disagreed, a
    // goal would be filed under a week the page does not name.
    const keys = goalPeriodKeys("2026-08-13", 1);
    const ranges = goalPeriodRanges("2026-08-13", 1, "en-US");
    expect(ranges.week.startsWith("8/10")).toBe(true);
    expect(keys.week).toBe("2026-08-10");
  });

  it("keeps a week that crosses a month boundary on one key", () => {
    expect(goalPeriodKeys("2026-09-01", 1).week).toBe("2026-08-31");
    expect(goalPeriodKeys("2026-09-06", 1).week).toBe("2026-08-31");
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
