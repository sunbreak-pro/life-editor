// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, expect, it } from "vitest";
import { normalizeIntentionText } from "../src/components/briefing/intentionSection";
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

/*
 * The section writer (mergeIntentionSection) and the save caption helper
 * (hasIntentionToReport) were removed with the paper's declaration field
 * (D-20261007-briefing-1), and the reader with #2757: no screen showed what
 * older days carry. What stays pinned is that
 * the 朝刊 / 夕刊 readers do not claim an older day's 宣言 section.
 */
describe("an older day's 宣言 section beside the 朝刊 / 夕刊 readers", () => {
  it("neither reader claims the 宣言 lines", () => {
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
    const evening = extractEveningSection(content);
    expect(evening.mood).toBe(4);
    expect(textsOf(evening.bodyDocJson!)).toEqual(["振り返り"]);
  });
});
