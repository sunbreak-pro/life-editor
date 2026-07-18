import { describe, expect, it } from "vitest";
import {
  extractIntentionSection,
  mergeIntentionSection,
  normalizeIntentionText,
} from "../src/components/briefing/intentionSection";
import { extractBriefing } from "../src/components/briefing/extractBriefing";
import { extractEveningSection } from "../src/components/briefing/eveningSection";

// ── TipTap fixture helpers (same shapes as eveningSection tests) ─────────

interface Node {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: Node[];
}

function heading(text: string, level = 2): Node {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function para(text: string): Node {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function doc(...content: Node[]): string {
  return JSON.stringify({ type: "doc", content });
}

function parse(json: string): { type: string; content: Node[] } {
  return JSON.parse(json);
}

function textsOf(json: string): string[] {
  return parse(json).content.map((n) =>
    (n.content ?? []).map((c) => c.text ?? "").join(""),
  );
}

// ── normalizeIntentionText ───────────────────────────────────────────────

describe("normalizeIntentionText", () => {
  it("trims lines, drops blanks, null for nothing", () => {
    expect(normalizeIntentionText("  A  \n\n B \n")).toBe("A\nB");
    expect(normalizeIntentionText("A\r\nB")).toBe("A\nB");
    expect(normalizeIntentionText("   \n  ")).toBeNull();
    expect(normalizeIntentionText("")).toBeNull();
    expect(normalizeIntentionText(null)).toBeNull();
    expect(normalizeIntentionText(undefined)).toBeNull();
  });
});

// ── extractIntentionSection ──────────────────────────────────────────────

describe("extractIntentionSection", () => {
  it("returns no section for empty / plain-text / unrelated content", () => {
    expect(extractIntentionSection(null)).toEqual({
      text: null,
      hasSection: false,
    });
    expect(extractIntentionSection("")).toEqual({
      text: null,
      hasSection: false,
    });
    expect(extractIntentionSection("ただのメモ\n二行目").hasSection).toBe(
      false,
    );
    expect(
      extractIntentionSection(doc(heading("朝刊"), para("focus"))).hasSection,
    ).toBe(false);
  });

  it("extracts newline-joined lines from the 宣言 section", () => {
    const content = doc(
      heading("朝刊"),
      para("focus"),
      heading("宣言"),
      para("F-6 を仕上げる"),
      para("30 分走る"),
      heading("メモ"),
      para("ここは対象外"),
    );
    expect(extractIntentionSection(content)).toEqual({
      text: "F-6 を仕上げる\n30 分走る",
      hasSection: true,
    });
  });

  it("accepts the English aliases Intention / Intentions (any case)", () => {
    for (const label of ["Intention", "intentions", "INTENTION"]) {
      expect(
        extractIntentionSection(doc(heading(label), para("ship it"))).text,
      ).toBe("ship it");
    }
  });

  it("flattens list items one per line", () => {
    const list: Node = {
      type: "bulletList",
      content: [
        { type: "listItem", content: [para("A")] },
        { type: "listItem", content: [para("B")] },
      ],
    };
    expect(extractIntentionSection(doc(heading("宣言"), list)).text).toBe(
      "A\nB",
    );
  });

  it("an empty section reports hasSection with null text", () => {
    expect(extractIntentionSection(doc(heading("宣言")))).toEqual({
      text: null,
      hasSection: true,
    });
  });
});

// ── mergeIntentionSection ────────────────────────────────────────────────

describe("mergeIntentionSection", () => {
  it("creates the section at the top of an empty daily", () => {
    const merged = mergeIntentionSection("", "今日はこれをやる");
    expect(textsOf(merged)).toEqual(["宣言", "今日はこれをやる"]);
    expect(extractIntentionSection(merged).text).toBe("今日はこれをやる");
  });

  it("inserts right below an existing 朝刊 section", () => {
    const content = doc(
      heading("朝刊"),
      para("focus"),
      para("講評"),
      para("day note"),
      heading("夕刊"),
      para("気分: 3/5"),
    );
    const merged = mergeIntentionSection(content, "宣言A");
    expect(textsOf(merged)).toEqual([
      "朝刊",
      "focus",
      "講評",
      "day note",
      "宣言",
      "宣言A",
      "夕刊",
      "気分: 3/5",
    ]);
  });

  it("goes to the very top when there is no 朝刊 (paper prepends later)", () => {
    const content = doc(para("free note"), heading("夕刊"), para("reflection"));
    const merged = mergeIntentionSection(content, "宣言A");
    expect(textsOf(merged)[0]).toBe("宣言");
    expect(textsOf(merged)[1]).toBe("宣言A");
  });

  it("replaces an existing section in place, one paragraph per line", () => {
    const content = doc(
      heading("宣言"),
      para("old"),
      heading("夕刊"),
      para("keep"),
    );
    const merged = mergeIntentionSection(content, " new1 \n\nnew2 ");
    expect(textsOf(merged)).toEqual(["宣言", "new1", "new2", "夕刊", "keep"]);
  });

  it("clearing removes an existing section and never creates one", () => {
    const content = doc(
      heading("宣言"),
      para("old"),
      heading("夕刊"),
      para("k"),
    );
    expect(textsOf(mergeIntentionSection(content, ""))).toEqual(["夕刊", "k"]);
    const without = doc(heading("朝刊"), para("focus"));
    expect(mergeIntentionSection(without, "")).toBe(without);
    expect(mergeIntentionSection(without, null)).toBe(without);
  });

  it("matches a 宣言 heading at any level and rewrites it at level 2", () => {
    const content = doc(
      heading("宣言", 1),
      para("old"),
      heading("夕刊", 3),
      para("k"),
    );
    const merged = mergeIntentionSection(content, "new");
    expect(textsOf(merged)).toEqual(["宣言", "new", "夕刊", "k"]);
    expect(parse(merged).content[0]!.attrs?.level).toBe(2);
  });

  it("converts a legacy plain-text daily and keeps its lines", () => {
    const merged = mergeIntentionSection("メモ1\nメモ2", "宣言A");
    expect(textsOf(merged)).toEqual(["宣言", "宣言A", "メモ1", "メモ2"]);
  });

  it("round-trips through extract with normalization", () => {
    const merged = mergeIntentionSection("", "  A \n\n B\n");
    expect(extractIntentionSection(merged).text).toBe(
      normalizeIntentionText("  A \n\n B\n"),
    );
  });

  it("never clobbers the 朝刊 / 夕刊 sections (cross-convention)", () => {
    const content = doc(
      heading("朝刊"),
      para("focus line"),
      para("comment"),
      heading("夕刊"),
      para("気分: 4/5"),
      para("振り返り"),
    );
    const merged = mergeIntentionSection(content, "宣言A\n宣言B");
    const briefing = extractBriefing(merged);
    expect(briefing?.focus).toBe("focus line");
    expect(briefing?.paragraphs).toEqual(["comment"]);
    const evening = extractEveningSection(merged);
    expect(evening.mood).toBe(4);
    expect(textsOf(evening.bodyDocJson!)).toEqual(["振り返り"]);
    expect(extractIntentionSection(merged).text).toBe("宣言A\n宣言B");
  });
});
