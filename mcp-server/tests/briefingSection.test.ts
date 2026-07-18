import { describe, it, expect } from "vitest";
import {
  buildBriefingSectionNodes,
  upsertBriefingSection,
  hasBriefingSection,
} from "../src/utils/briefingSection.js";
// Cross-package TEST-ONLY import: the read half of the briefing convention
// lives in shared. The round-trip below is the machine check for the DoD
// "extractBriefing can render what write_briefing wrote".
import { extractBriefing } from "../../shared/src/components/briefing/extractBriefing";
import {
  localToday,
  addDays,
  localDayUtcRange,
} from "../src/utils/localDate.js";

function doc(...content: unknown[]): string {
  return JSON.stringify({ type: "doc", content });
}

function heading(text: string, level = 2) {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function para(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

describe("buildBriefingSectionNodes", () => {
  it("builds heading + focus + comment paragraphs", () => {
    const nodes = buildBriefingSectionNodes("今日はPRを閉じる", [
      "昨日は宣言どおり進んだ。",
      "午後は会議が続くので朝が勝負。",
    ]);
    expect(nodes).toHaveLength(4);
    expect(nodes[0].type).toBe("heading");
    expect(nodes[0].content?.[0].text).toBe("朝刊");
    expect(nodes[1].content?.[0].text).toBe("今日はPRを閉じる");
  });

  it("drops empty paragraphs and rejects an empty focus", () => {
    const nodes = buildBriefingSectionNodes("focus", ["", "  ", "本文"]);
    expect(nodes).toHaveLength(3);
    expect(() => buildBriefingSectionNodes("   ", [])).toThrow(/focus/);
  });
});

describe("upsertBriefingSection", () => {
  it("creates a fresh doc from empty content", () => {
    for (const empty of [null, undefined, ""]) {
      const out = JSON.parse(upsertBriefingSection(empty, "焦点", ["本文"]));
      expect(out.type).toBe("doc");
      expect(out.content[0].type).toBe("heading");
    }
  });

  it("prepends the section when the daily has other content", () => {
    const existing = doc(heading("夕刊"), para("今日の振り返り"));
    const out = JSON.parse(
      upsertBriefingSection(existing, "焦点", ["コメント"]),
    );
    // briefing on top, 夕刊 section untouched below
    expect(out.content.map((n: { type: string }) => n.type)).toEqual([
      "heading",
      "paragraph",
      "paragraph",
      "heading",
      "paragraph",
    ]);
    expect(out.content[3].content[0].text).toBe("夕刊");
    expect(out.content[4].content[0].text).toBe("今日の振り返り");
  });

  it("replaces an existing briefing section in place, preserving neighbours", () => {
    const existing = doc(
      para("プリアンブル"),
      heading("朝刊"),
      para("旧フォーカス"),
      para("旧コメント"),
      heading("夕刊"),
      para("夜のメモ"),
    );
    const out = JSON.parse(
      upsertBriefingSection(existing, "新フォーカス", ["新コメント"]),
    );
    const texts = out.content.map((n: unknown) =>
      JSON.stringify(n),
    ) as string[];
    expect(texts.some((t) => t.includes("旧フォーカス"))).toBe(false);
    expect(texts.some((t) => t.includes("新フォーカス"))).toBe(true);
    expect(out.content[0].content[0].text).toBe("プリアンブル");
    expect(out.content[out.content.length - 1].content[0].text).toBe(
      "夜のメモ",
    );
    // still exactly one briefing heading
    const headings = out.content.filter(
      (n: { type: string }) => n.type === "heading",
    );
    expect(headings).toHaveLength(2);
  });

  it("matches the English 'Briefing' heading case-insensitively", () => {
    const existing = doc(heading("BRIEFING"), para("old"));
    const out = JSON.parse(upsertBriefingSection(existing, "new", []));
    const headings = out.content.filter(
      (n: { type: string }) => n.type === "heading",
    );
    expect(headings).toHaveLength(1);
  });

  it("refuses to clobber unparseable existing content", () => {
    expect(() => upsertBriefingSection("not json {", "f", [])).toThrow(
      /refusing/,
    );
    expect(() => upsertBriefingSection('"just a string"', "f", [])).toThrow(
      /refusing/,
    );
  });

  it("is idempotent: writing twice keeps a single section", () => {
    const once = upsertBriefingSection(null, "f1", ["p1"]);
    const twice = upsertBriefingSection(once, "f2", ["p2"]);
    expect(hasBriefingSection(twice)).toBe(true);
    const out = JSON.parse(twice);
    expect(
      out.content.filter((n: { type: string }) => n.type === "heading"),
    ).toHaveLength(1);
  });
});

describe("round-trip with shared extractBriefing (DoD)", () => {
  it("extractBriefing renders exactly what write_briefing wrote", () => {
    const content = upsertBriefingSection(null, "今日のフォーカス行", [
      "講評パラグラフ 1",
      "講評パラグラフ 2",
    ]);
    const extracted = extractBriefing(content);
    expect(extracted).not.toBeNull();
    expect(extracted?.focus).toBe("今日のフォーカス行");
    expect(extracted?.paragraphs).toEqual([
      "講評パラグラフ 1",
      "講評パラグラフ 2",
    ]);
  });

  it("survives an upsert into a daily that already has 夕刊 content", () => {
    const existing = doc(heading("夕刊"), para("昨夜のメモ"));
    const content = upsertBriefingSection(existing, "フォーカス", ["講評"]);
    const extracted = extractBriefing(content);
    expect(extracted?.focus).toBe("フォーカス");
    expect(extracted?.paragraphs).toEqual(["講評"]);
  });
});

describe("hasBriefingSection", () => {
  it("detects presence and tolerates garbage", () => {
    expect(hasBriefingSection(null)).toBe(false);
    expect(hasBriefingSection(doc(heading("夕刊"), para("x")))).toBe(false);
    expect(hasBriefingSection(doc(heading("朝刊"), para("x")))).toBe(true);
    expect(hasBriefingSection("broken {")).toBe(false);
  });
});

describe("localDate helpers", () => {
  it("localToday returns YYYY-MM-DD", () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("addDays crosses month boundaries in local time", () => {
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("localDayUtcRange spans exactly 24h starting at local midnight", () => {
    const { startIso, endIso } = localDayUtcRange("2026-07-18");
    const span = new Date(endIso).getTime() - new Date(startIso).getTime();
    expect(span).toBe(24 * 3600 * 1000);
    expect(new Date(startIso).getTime()).toBe(
      new Date("2026-07-18T00:00:00").getTime(),
    );
  });
});
