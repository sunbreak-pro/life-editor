// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, expect, it } from "vitest";
import {
  readDailyText,
  writeDailyText,
} from "../src/components/briefing/dailyText";
import {
  BRIEFING_HEADING_RE,
  EVENING_HEADING_RE,
  INTENTION_HEADING_RE,
  findSectionRange,
  parseDailyDoc,
  textOf,
  type TipTapNode,
} from "../src/components/briefing/dailySections";
import { extractBriefing } from "../src/components/briefing/extractBriefing";
import { extractEveningSection } from "../src/components/briefing/eveningSection";
import { extractIntentionSection } from "../src/components/briefing/intentionSection";
import { jsonDocEquals } from "../src/utils/jsonDocEquals";

/*
 * The day's ONE text (#2107, D-20261006-main-1): read = the Daily body minus
 * the 朝刊 section, the 宣言 section, the「夕刊」heading and the mood line;
 * write = that text back under the「夕刊」heading. The Daily rebuild (#2123)
 * reads and writes through the same pair, so what is pinned here is what both
 * screens promise: this write loses no character, read → write → read is the
 * identity, and the 朝刊 / 宣言 sections and the mood line come out exactly as
 * they went in.
 */

const heading = (text: string): TipTapNode => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const para = (text: string): TipTapNode => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const doc = (...content: TipTapNode[]): string =>
  JSON.stringify({ type: "doc", content });

/** Every character of the document, sorted — a multiset to compare. */
const chars = (content: string): string =>
  [...textOf(parseDailyDoc(content))].sort().join("");

/** The nodes of one convention section, [] when the day has none. */
function sectionNodes(content: string, re: RegExp): TipTapNode[] {
  const body = parseDailyDoc(content).content ?? [];
  const range = findSectionRange(body, re);
  return range === null ? [] : body.slice(range.start, range.end);
}

/** The mood line node itself (the paragraph after the 夕刊 heading). */
function moodNode(content: string): TipTapNode | null {
  if (extractEveningSection(content).mood === null) return null;
  const body = parseDailyDoc(content).content ?? [];
  const range = findSectionRange(body, EVENING_HEADING_RE);
  return range === null ? null : (body[range.start + 1] ?? null);
}

const appendLine = (text: string | null, line: string): string => {
  const nodes = text === null ? [] : (JSON.parse(text).content as TipTapNode[]);
  return doc(...nodes, para(line));
};

const DAYS: Array<{ name: string; content: string; text: TipTapNode[] }> = [
  {
    name: "1a. an old plain-text Daily body only",
    content: "朝の散歩\n\n昼は読書",
    text: [para("朝の散歩"), { type: "paragraph" }, para("昼は読書")],
  },
  {
    name: "1b. an old TipTap Daily body only",
    content: doc(para("朝の散歩"), para("昼は読書")),
    text: [para("朝の散歩"), para("昼は読書")],
  },
  {
    name: "2. a 夕刊 only",
    content: doc(heading("夕刊"), para("気分: 4/5"), para("e1"), para("e2")),
    text: [para("e1"), para("e2")],
  },
  {
    name: "3. an old body and a 夕刊",
    content: doc(
      para("p1"),
      para("p2"),
      heading("夕刊"),
      para("気分: 3/5"),
      para("e1"),
    ),
    text: [para("p1"), para("p2"), para("e1")],
  },
  {
    // Body text ABOVE the 朝刊 heading. Text that sits INSIDE a 朝刊 / 宣言
    // range is an open question (A1) and has its own block below, which pins
    // only what holds under either answer.
    name: "4. with 朝刊 and 宣言 sections",
    content: doc(
      para("p_legacy"),
      heading("朝刊"),
      para("b1"),
      heading("宣言"),
      para("i1"),
      heading("夕刊"),
      para("気分: 5/5"),
      para("e1"),
    ),
    text: [para("p_legacy"), para("e1")],
  },
  {
    name: "5. a heading the user typed inside the text",
    content: doc(
      para("p1"),
      heading("夕刊"),
      para("気分: 2/5"),
      para("e1"),
      heading("メモ"),
      para("e2"),
    ),
    text: [para("p1"), para("e1"), heading("メモ"), para("e2")],
  },
];

describe.each(DAYS)("the one text — $name", ({ content, text }) => {
  it("reads the body minus 朝刊 / 宣言 / the 夕刊 heading / the mood line", () => {
    expect(JSON.parse(readDailyText(content) ?? "null")).toEqual({
      type: "doc",
      content: text,
    });
  });

  it("(a) writes back what it read as a no-op, returning the input itself", () => {
    expect(writeDailyText(content, readDailyText(content))).toBe(content);
  });

  describe("after an edit (one line appended)", () => {
    const read = readDailyText(content);
    const written = writeDailyText(content, appendLine(read, "追記"));

    it("(b) reads back exactly the edited text", () => {
      const again = readDailyText(written);
      expect(again).not.toBeNull();
      expect(jsonDocEquals(again!, appendLine(read, "追記"))).toBe(true);
      // …and a second round trip is the identity.
      expect(writeDailyText(written, again)).toBe(written);
    });

    it("(c) loses no character", () => {
      const hadHeading = extractEveningSection(content).hasSection;
      const expected = [
        ...textOf(parseDailyDoc(content)),
        ..."追記",
        ...(hadHeading ? "" : "夕刊"),
      ]
        .sort()
        .join("");
      expect(chars(written)).toBe(expected);
    });

    it("(d) keeps the 朝刊 / 宣言 sections and the mood line as they were", () => {
      expect(sectionNodes(written, BRIEFING_HEADING_RE)).toEqual(
        sectionNodes(content, BRIEFING_HEADING_RE),
      );
      expect(sectionNodes(written, INTENTION_HEADING_RE)).toEqual(
        sectionNodes(content, INTENTION_HEADING_RE),
      );
      expect(moodNode(written)).toEqual(moodNode(content));
      expect(extractBriefing(written)).toEqual(extractBriefing(content));
      expect(extractIntentionSection(written)).toEqual(
        extractIntentionSection(content),
      );
      expect(extractEveningSection(written).mood).toBe(
        extractEveningSection(content).mood,
      );
    });

    it("(e) leaves exactly one 夕刊 heading", () => {
      const headings = (parseDailyDoc(written).content ?? []).filter(
        (n) =>
          n.type === "heading" && EVENING_HEADING_RE.test(textOf(n).trim()),
      );
      expect(headings).toHaveLength(1);
    });
  });
});

/*
 * A1 — a KNOWN LIMIT, not a guarantee; how to treat it is an open decision
 * raised in the #2107 PR (no queue entry). Daily text written below the 朝刊
 * or 宣言 lines without a heading of its own (write_briefing prepends 朝刊
 * above an old body; typing at the end of a Daily that has 宣言) falls inside
 * that section under the plan's "a section runs to the next heading" rule, so
 * the read leaves it out of the one text, while plan l.221 expects it in the
 * reflection field. What is pinned is only what writeDailyText itself does:
 * it leaves that text untouched. A later 宣言 save (mergeIntentionSection)
 * replaces the whole [宣言, next heading) range and does not keep it.
 */
describe("the one text — A1, text inside a 朝刊 / 宣言 range (known limit)", () => {
  const content = doc(
    heading("朝刊"),
    para("b1"),
    para("p_after_briefing"),
    heading("宣言"),
    para("i1"),
    para("p_after_intention"),
    heading("夕刊"),
    para("気分: 5/5"),
    para("e1"),
  );
  const written = writeDailyText(
    content,
    appendLine(readDailyText(content), "追記"),
  );

  it("loses no character on an edit", () => {
    expect(chars(written)).toBe(
      [...textOf(parseDailyDoc(content)), ..."追記"].sort().join(""),
    );
  });

  it("excludes a paragraph after the 宣言 lines from the text, and the write leaves it byte-identical", () => {
    // The real layout: [朝刊, p, 宣言, d, legacy] — the old body sits under
    // 宣言 with no heading of its own.
    const legacy = para("p_legacy");
    const day = doc(
      heading("朝刊"),
      para("b1"),
      heading("宣言"),
      para("d1"),
      legacy,
    );
    expect(readDailyText(day)).toBeNull();

    const edited = writeDailyText(day, doc(para("new")));
    // Everything up to and including the legacy paragraph is the stored
    // bytes; only the 夕刊 heading and the text are appended after it.
    expect(edited.startsWith(`${day.slice(0, -"]}".length)},`)).toBe(true);
    expect(JSON.parse(edited).content.slice(5)).toEqual([
      heading("夕刊"),
      para("new"),
    ]);
    expect(JSON.parse(readDailyText(edited)!).content).toEqual([para("new")]);
  });
});

describe("the one text — edges", () => {
  it("puts the text after the mood line, keeping the 朝刊 section in place", () => {
    const content = doc(heading("朝刊"), para("b1"), para("old"));
    const written = writeDailyText(content, doc(para("new")));
    expect(JSON.parse(written).content).toEqual([
      heading("朝刊"),
      para("b1"),
      para("old"),
      heading("夕刊"),
      para("new"),
    ]);
  });

  it("creates no section for an empty text on a day without one", () => {
    const content = doc(heading("朝刊"), para("b1"));
    expect(writeDailyText(content, null)).toBe(content);
    expect(writeDailyText(content, doc({ type: "paragraph" }))).toBe(content);
    expect(writeDailyText(null, null)).toBe("");
  });

  it("drops the 夕刊 heading when the text is cleared and there is no mood", () => {
    const content = doc(para("p1"), heading("夕刊"), para("e1"));
    expect(JSON.parse(writeDailyText(content, null)).content).toEqual([]);
  });

  it("keeps [夕刊, mood] when the text is cleared on a day with a mood", () => {
    const content = doc(
      para("p1"),
      heading("夕刊"),
      para("気分: 4/5"),
      para("e1"),
    );
    expect(JSON.parse(writeDailyText(content, null)).content).toEqual([
      heading("夕刊"),
      para("気分: 4/5"),
    ]);
  });

  it("treats a key-reordered echo of the stored text as no change", () => {
    const content = doc(heading("夕刊"), para("e1"));
    // jsonb hands object keys back in its own order (#793).
    const echo = JSON.stringify({
      content: [{ content: [{ text: "e1", type: "text" }], type: "paragraph" }],
      type: "doc",
    });
    expect(writeDailyText(content, echo)).toBe(content);
  });

  // Known limit A2: a user heading spelled like a convention heading IS that
  // convention. Typed into the text, it starts a 宣言 section on the next
  // read, and what follows it disappears from the one text (not from the
  // document — the characters are still all there).
  it("A2: a user heading named 宣言 turns into the 宣言 section", () => {
    const written = writeDailyText(
      doc(para("p1")),
      doc(para("p1"), heading("宣言"), para("x")),
    );
    expect(JSON.parse(readDailyText(written)!).content).toEqual([para("p1")]);
    expect(chars(written)).toBe([..."p1宣言x夕刊"].sort().join(""));
  });

  // Known limit A3: on a day with no mood, a text whose first paragraph reads
  // like a mood line lands right under the 夕刊 heading and is read as the
  // mood from then on.
  it("A3: a first paragraph shaped like「気分: n/5」becomes the mood", () => {
    const written = writeDailyText(
      doc(para("p1")),
      doc(para("気分: 3/5"), para("p1")),
    );
    expect(extractEveningSection(written).mood).toBe(3);
    expect(JSON.parse(readDailyText(written)!).content).toEqual([para("p1")]);
  });
});
