// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import { extractBriefing } from "../src/components/briefing/extractBriefing";

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
