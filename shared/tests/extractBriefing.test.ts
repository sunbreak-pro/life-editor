// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  extractBriefing,
  lastBriefingDate,
} from "../src/components/briefing/extractBriefing";

const doc = (content: unknown[]) => JSON.stringify({ type: "doc", content });
const h = (text: string, level = 2) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const p = (text: string) => ({
  type: "paragraph",
  content: text === "" ? [] : [{ type: "text", text }],
});

describe("extractBriefing", () => {
  it("returns null for empty / missing / unparseable content", () => {
    expect(extractBriefing(null)).toBeNull();
    expect(extractBriefing(undefined)).toBeNull();
    expect(extractBriefing("")).toBeNull();
    expect(extractBriefing("not json")).toBeNull();
    expect(extractBriefing(JSON.stringify({ type: "doc" }))).toBeNull();
  });

  it("returns null when there is no Briefing heading", () => {
    expect(
      extractBriefing(doc([h("Memo"), p("just a normal daily")])),
    ).toBeNull();
  });

  it("returns null for a Briefing heading with no body", () => {
    expect(extractBriefing(doc([h("Briefing")]))).toBeNull();
    expect(extractBriefing(doc([h("Briefing"), p("")]))).toBeNull();
  });

  it("extracts every paragraph as AI comment (#1048 — no focus split)", () => {
    const result = extractBriefing(
      doc([
        p("free intro text outside the section"),
        h("Briefing"),
        p("昨日の宣言3件のうち2件完了。"),
        p("今日はDDLを最初に。"),
      ]),
    );
    expect(result).toEqual({
      paragraphs: ["昨日の宣言3件のうち2件完了。", "今日はDDLを最初に。"],
    });
  });

  it("accepts the 朝刊 marker and is case-insensitive", () => {
    expect(extractBriefing(doc([h("朝刊"), p("comment")]))?.paragraphs).toEqual(
      ["comment"],
    );
    expect(
      extractBriefing(doc([h("BRIEFING"), p("comment")]))?.paragraphs,
    ).toEqual(["comment"]);
  });

  it("stops at the next heading", () => {
    const result = extractBriefing(
      doc([h("Briefing"), p("comment"), h("Memo"), p("not part of briefing")]),
    );
    expect(result).toEqual({ paragraphs: ["comment"] });
  });

  it("flattens marks/nested inline content to plain text", () => {
    const rich = {
      type: "paragraph",
      content: [
        { type: "text", text: "今日は" },
        { type: "text", marks: [{ type: "bold" }], text: "DDL" },
        { type: "text", text: "から。" },
      ],
    };
    expect(extractBriefing(doc([h("Briefing"), rich]))?.paragraphs).toEqual([
      "今日はDDLから。",
    ]);
  });
});

/*
 * The Settings card's "last AI activity" line (#1210). What it must NOT do is
 * as important as what it must: a daily the user threw away is not evidence of
 * anything, and neither is a Briefing heading with no paragraphs under it.
 */
describe("lastBriefingDate", () => {
  const daily = (date: string, content: string, isDeleted?: boolean) => ({
    date,
    content,
    isDeleted,
  });
  const withBriefing = doc([h("Briefing"), p("a word on yesterday")]);
  const withoutBriefing = doc([h("Memo"), p("nothing to see")]);

  it("returns null for an empty list", () => {
    expect(lastBriefingDate([])).toBeNull();
  });

  it("returns null when no daily carries a briefing section", () => {
    expect(
      lastBriefingDate([
        daily("2026-08-29", withoutBriefing),
        daily("2026-08-30", ""),
      ]),
    ).toBeNull();
  });

  it("picks the newest date, whatever order the list arrives in", () => {
    expect(
      lastBriefingDate([
        daily("2026-08-28", withBriefing),
        daily("2026-08-30", withBriefing),
        daily("2026-08-29", withBriefing),
      ]),
    ).toBe("2026-08-30");
  });

  it("ignores dailies without a briefing section", () => {
    expect(
      lastBriefingDate([
        daily("2026-08-28", withBriefing),
        daily("2026-08-30", withoutBriefing),
      ]),
    ).toBe("2026-08-28");
  });

  it("ignores soft-deleted dailies", () => {
    expect(
      lastBriefingDate([
        daily("2026-08-28", withBriefing),
        daily("2026-08-30", withBriefing, true),
      ]),
    ).toBe("2026-08-28");
  });

  it("ignores a Briefing heading with no paragraphs under it", () => {
    expect(
      lastBriefingDate([daily("2026-08-30", doc([h("Briefing"), h("Memo")]))]),
    ).toBeNull();
  });
});
