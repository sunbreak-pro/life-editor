// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, expect, it } from "vitest";
import {
  extractIntentionSection,
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

/*
 * The section writer (mergeIntentionSection) and the save caption helper
 * (hasIntentionToReport) were removed with the paper's declaration field
 * (D-20261007-briefing-1): nothing writes a 宣言 any more, and older days are
 * only read. What stays pinned is that the three readers each find their own
 * section in one body.
 */
describe("the 宣言 reader beside the 朝刊 / 夕刊 readers", () => {
  it("each reader finds its own section and none claims another's", () => {
    const content = doc(
      heading("朝刊"),
      para("comment"),
      heading("宣言"),
      para("宣言A"),
      para("宣言B"),
      heading("夕刊"),
      para("気分: 4/5"),
      para("振り返り"),
    );
    expect(extractBriefing(content)?.paragraphs).toEqual(["comment"]);
    expect(extractIntentionSection(content).text).toBe("宣言A\n宣言B");
    const evening = extractEveningSection(content);
    expect(evening.mood).toBe(4);
    expect(textsOf(evening.bodyDocJson!)).toEqual(["振り返り"]);
  });
});
