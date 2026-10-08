// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, expect, it } from "vitest";
import { readMorningRecord } from "../src/components/briefing/dailyMorning";

/*
 * The day's morning record (D-20261007-briefing-1): Claude's comment and the
 * user's 宣言, read for the blocks that show them outside the Daily body.
 * New days carry the comment in `morning_comment` (0035); older days carry
 * both as heading sections of the body, never rewritten. What is pinned:
 * the column wins, the body is the fallback, and text written after the
 * section lines comes back here rather than nowhere.
 */

const doc = (...content: unknown[]) => JSON.stringify({ type: "doc", content });
const heading = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

// The comment of the design brief §11 (.claude/docs/design/briefs/briefing.md).
const C1 =
  "今週の『企画書を通す』は残り 2 件です。初稿を午前に送れば、明日の見積もりに回せます。";
const C2 =
  "午後は歯科検診で抜けるので、集中が要る作業は午前に寄せるのがよさそうです。";

describe("readMorningRecord — the comment", () => {
  it("reads the column on a new day, whose body has no 朝刊 section", () => {
    expect(
      readMorningRecord({
        content: doc(para("日記")),
        morningComment: [C1, C2],
      }),
    ).toEqual({ comment: [C1, C2], intention: "" });
  });

  it("prefers the column over the body's section when a day has both", () => {
    const record = readMorningRecord({
      content: doc(heading("朝刊"), para("old comment")),
      morningComment: [C1],
    });
    expect(record.comment).toEqual([C1]);
    // Known limit: the section's text reaches no block on such a day.
    expect(record.comment).not.toContain("old comment");
  });

  it.each([
    ["null", null],
    ["an empty array", []],
    ["only blank strings", ["", "   "]],
    ["absent", undefined],
  ])(
    "falls back to the body's 朝刊 section when the column is %s",
    (_l, col) => {
      const record = readMorningRecord({
        content: doc(heading("朝刊"), para(C1), para(C2), heading("夕刊")),
        morningComment: col,
      });
      expect(record.comment).toEqual([C1, C2]);
    },
  );

  it("includes heading-less text after the 朝刊 lines (an old body under a prepended 朝刊)", () => {
    // write_briefing used to put 朝刊 above an old body, so the diary's first
    // lines fall inside the section. They show as comment — shown, not lost.
    const record = readMorningRecord({
      content: doc(heading("朝刊"), para(C1), para("昼にアキとランチ。")),
      morningComment: null,
    });
    expect(record.comment).toEqual([C1, "昼にアキとランチ。"]);
  });

  it("trims the column's paragraphs and drops what is not text", () => {
    const record = readMorningRecord({
      content: "",
      morningComment: [` ${C1} `, 3, C2] as unknown as string[],
    });
    expect(record.comment).toEqual([C1, C2]);
  });
});

describe("readMorningRecord — the 宣言", () => {
  it("reads the 宣言 section's lines up to the next heading", () => {
    const record = readMorningRecord({
      content: doc(
        heading("朝刊"),
        para(C1),
        heading("宣言"),
        para("企画書を午前で出す"),
        para("夜は早く寝る"),
        heading("夕刊"),
        para("気分: 4/5"),
      ),
    });
    expect(record.intention).toBe("企画書を午前で出す\n夜は早く寝る");
  });

  it("keeps an old day's body that was typed after the 宣言 lines", () => {
    const record = readMorningRecord({
      content: doc(heading("宣言"), para("走る"), para("帰りに本屋へ寄った。")),
    });
    expect(record.intention).toBe("走る\n帰りに本屋へ寄った。");
  });

  it("does not read a 宣言 from the comment column", () => {
    expect(readMorningRecord({ content: "", morningComment: [C1] })).toEqual({
      comment: [C1],
      intention: "",
    });
  });
});

describe("readMorningRecord — nothing to read", () => {
  it.each([
    ["no daily", null],
    ["undefined", undefined],
    ["an empty body and no column", { content: "", morningComment: null }],
    ["a null body", { content: null }],
    ["a body without either section", { content: doc(para("日記だけ")) }],
  ])("returns an empty record for %s", (_label, daily) => {
    expect(readMorningRecord(daily)).toEqual({ comment: [], intention: "" });
  });

  it("reads a legacy plain-text body as having neither section", () => {
    // Plain text never carries a heading, so a line that spells 朝刊 / 宣言
    // is just a line of the diary.
    expect(
      readMorningRecord({ content: "朝刊\n昨日はよく眠れた\n宣言\n走る" }),
    ).toEqual({ comment: [], intention: "" });
  });
});
