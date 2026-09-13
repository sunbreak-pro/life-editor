import { describe, it, expect } from "vitest";
import {
  buildBriefingSectionNodes,
  upsertBriefingSection,
  hasBriefingSection,
  parseDoc,
  textOf,
  type TipTapNode,
} from "../src/utils/briefingSection.js";
// Cross-package TEST-ONLY import: the read half of the briefing convention
// lives in shared. The round-trip below is the machine check for the DoD
// "extractBriefing can render what write_briefing wrote".
import { extractBriefing } from "../../shared/src/components/briefing/extractBriefing.js";
// Same TEST-ONLY link, for the other half of #1592: parseDoc and
// parseDailyDoc must accept the same bodies, and this is the only place the
// two packages can be compared.
import { parseDailyDoc } from "../../shared/src/components/briefing/dailySections.js";
import {
  localToday,
  addDays,
  localDayUtcRange,
  assertDateKey,
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
  it("builds heading + comment paragraphs (no focus paragraph — #1097)", () => {
    const nodes = buildBriefingSectionNodes([
      "昨日は宣言どおり進んだ。",
      "午後は会議が続くので朝が勝負。",
    ]);
    expect(nodes).toHaveLength(3);
    expect(nodes[0].type).toBe("heading");
    expect(nodes[0].content?.[0].text).toBe("朝刊");
    expect(nodes[1].content?.[0].text).toBe("昨日は宣言どおり進んだ。");
  });

  it("drops empty paragraphs and rejects an all-empty list", () => {
    const nodes = buildBriefingSectionNodes(["", "  ", "本文"]);
    expect(nodes).toHaveLength(2);
    // A heading-only section is invisible to extractBriefing — the builder
    // refuses it so the handler skips the daily write instead.
    expect(() => buildBriefingSectionNodes(["", "  "])).toThrow(/paragraphs/);
  });
});

describe("upsertBriefingSection", () => {
  it("creates a fresh doc from empty content", () => {
    for (const empty of [null, undefined, ""]) {
      const out = JSON.parse(upsertBriefingSection(empty, ["本文"]));
      expect(out.type).toBe("doc");
      expect(out.content[0].type).toBe("heading");
    }
  });

  it("prepends the section when the daily has other content", () => {
    const existing = doc(heading("夕刊"), para("今日の振り返り"));
    const out = JSON.parse(upsertBriefingSection(existing, ["コメント"]));
    // briefing on top, 夕刊 section untouched below
    expect(out.content.map((n: { type: string }) => n.type)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "paragraph",
    ]);
    expect(out.content[2].content[0].text).toBe("夕刊");
    expect(out.content[3].content[0].text).toBe("今日の振り返り");
  });

  it("replaces an existing briefing section in place, preserving neighbours", () => {
    const existing = doc(
      para("プリアンブル"),
      heading("朝刊"),
      para("旧コメント 1"),
      para("旧コメント 2"),
      heading("夕刊"),
      para("夜のメモ"),
    );
    const out = JSON.parse(upsertBriefingSection(existing, ["新コメント"]));
    const texts = out.content.map((n: unknown) =>
      JSON.stringify(n),
    ) as string[];
    expect(texts.some((t) => t.includes("旧コメント"))).toBe(false);
    expect(texts.some((t) => t.includes("新コメント"))).toBe(true);
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
    const out = JSON.parse(upsertBriefingSection(existing, ["new"]));
    const headings = out.content.filter(
      (n: { type: string }) => n.type === "heading",
    );
    expect(headings).toHaveLength(1);
  });

  it("keeps every line of a legacy plain-text daily (#1592)", () => {
    // The shape of the one plain-text row live in dailies_payload: a jsonb
    // STRING column, which contentJsonToString hands over as its raw text.
    const out = JSON.parse(upsertBriefingSection("ハロー\n二行目", ["講評"]));
    const texts = out.content.map((n: TipTapNode) => textOf(n));
    // briefing section on top, the old body preserved below it verbatim
    expect(texts).toEqual(["朝刊", "講評", "ハロー", "二行目"]);
  });

  it("reads a non-document JSON body as text rather than losing it", () => {
    // `"just a string"` parses, but a scalar is not a document. Losing it
    // would be the clobber the old throw was there to prevent (#1592).
    const out = JSON.parse(upsertBriefingSection('"just a string"', ["p"]));
    const texts = out.content.map((n: TipTapNode) => textOf(n));
    expect(texts).toEqual(["朝刊", "p", '"just a string"']);
  });

  it("is idempotent: writing twice keeps a single section", () => {
    const once = upsertBriefingSection(null, ["p1"]);
    const twice = upsertBriefingSection(once, ["p2"]);
    expect(hasBriefingSection(twice)).toBe(true);
    const out = JSON.parse(twice);
    expect(
      out.content.filter((n: { type: string }) => n.type === "heading"),
    ).toHaveLength(1);
  });
});

describe("round-trip with shared extractBriefing (DoD)", () => {
  it("extractBriefing renders exactly what write_briefing wrote", () => {
    // #1097: the section carries ONLY comment paragraphs — the focus line
    // lives in the focus note (see focusSection.test.ts's round-trip).
    const content = upsertBriefingSection(null, [
      "講評パラグラフ 1",
      "講評パラグラフ 2",
    ]);
    const extracted = extractBriefing(content);
    expect(extracted).not.toBeNull();
    expect(extracted?.paragraphs).toEqual([
      "講評パラグラフ 1",
      "講評パラグラフ 2",
    ]);
  });

  it("survives an upsert into a daily that already has 夕刊 content", () => {
    const existing = doc(heading("夕刊"), para("昨夜のメモ"));
    const content = upsertBriefingSection(existing, ["講評"]);
    const extracted = extractBriefing(content);
    expect(extracted?.paragraphs).toEqual(["講評"]);
  });
});

describe("parseDoc agrees with shared parseDailyDoc (#1592)", () => {
  // Every body shape that has ever reached these two parsers. The screen
  // reads a daily with parseDailyDoc and MCP writes it through parseDoc, so
  // a body one accepts and the other rejects is a daily you can read but
  // cannot write — which is exactly what #1592 measured on daily-2026-05-24.
  const bodies: Array<[string, string | null | undefined]> = [
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["a TipTap doc", doc(heading("朝刊"), para("講評"))],
    ["a legacy plain line", "ハロー"],
    ["a legacy plain body with line breaks", "ハロー\n二行目\n"],
    ["a CRLF plain body", "一行目\r\n二行目"],
    ["unparseable JSON", "not json {"],
    ["a JSON string scalar", '"just a string"'],
    ["a JSON array", "[1, 2]"],
    ["a JSON object that is not a doc", '{"foo":1}'],
    ["a doc without a content array", '{"type":"doc"}'],
  ];

  for (const [label, body] of bodies) {
    it(`reads ${label} the same way`, () => {
      expect(parseDoc(body)).toEqual(parseDailyDoc(body));
    });
  }

  it("never throws on a body the screen can render", () => {
    for (const [, body] of bodies) expect(() => parseDoc(body)).not.toThrow();
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

  it("assertDateKey accepts YYYY-MM-DD and rejects everything else", () => {
    expect(assertDateKey("2026-07-18")).toBe("2026-07-18");
    for (const bad of ["garbage", "2026-7-18", "2026-07-18T00:00", ""]) {
      expect(() => assertDateKey(bad)).toThrow(/Invalid date/);
    }
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
