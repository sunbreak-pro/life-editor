import { describe, expect, it } from "vitest";
import {
  defaultBriefingTab,
  extractEveningSection,
  isEmptyDocJson,
  mergeEveningSection,
  moodLineText,
} from "../src/components/briefing/eveningSection";

// ── TipTap fixture helpers (same shapes as mcp-server briefingSection tests) ──

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

function bodyDoc(...content: Node[]): string {
  return JSON.stringify({ type: "doc", content });
}

function parse(json: string): { type: string; content: Node[] } {
  return JSON.parse(json);
}

// ── extractEveningSection ────────────────────────────────────────────────

describe("extractEveningSection", () => {
  it("returns empty result when there is no evening section", () => {
    expect(extractEveningSection(doc(heading("朝刊"), para("focus")))).toEqual({
      mood: null,
      bodyDocJson: null,
      hasSection: false,
    });
    expect(extractEveningSection("")).toEqual({
      mood: null,
      bodyDocJson: null,
      hasSection: false,
    });
    expect(extractEveningSection(null)).toEqual({
      mood: null,
      bodyDocJson: null,
      hasSection: false,
    });
  });

  it("legacy plain text has no headings, hence no section", () => {
    expect(extractEveningSection("ただのメモ\n二行目").hasSection).toBe(false);
  });

  it("extracts mood and body, stripping the mood line from the body", () => {
    const content = doc(
      heading("夕刊"),
      para("気分: 4/5"),
      para("今日の振り返り"),
    );
    const out = extractEveningSection(content);
    expect(out.mood).toBe(4);
    expect(out.hasSection).toBe(true);
    const body = parse(out.bodyDocJson!);
    expect(body.content).toHaveLength(1);
    expect(body.content[0]!.content?.[0]?.text).toBe("今日の振り返り");
  });

  it("accepts a full-width colon in the mood line", () => {
    const content = doc(heading("夕刊"), para("気分： 2/5"));
    expect(extractEveningSection(content).mood).toBe(2);
  });

  it("matches the English 'Evening' heading case-insensitively", () => {
    const content = doc(heading("EVENING"), para("reflection"));
    expect(extractEveningSection(content).hasSection).toBe(true);
  });

  it("yields a null body when the section holds only the mood line", () => {
    const content = doc(heading("夕刊"), para("気分: 5/5"));
    const out = extractEveningSection(content);
    expect(out.mood).toBe(5);
    expect(out.bodyDocJson).toBeNull();
  });

  it("stops at the next heading", () => {
    const content = doc(
      heading("夕刊"),
      para("振り返り"),
      heading("メモ"),
      para("別セクション"),
    );
    const body = parse(extractEveningSection(content).bodyDocJson!);
    expect(body.content).toHaveLength(1);
  });
});

// ── mergeEveningSection ──────────────────────────────────────────────────

describe("mergeEveningSection", () => {
  it("creates the section (heading + mood + body) on empty content", () => {
    const merged = mergeEveningSection("", {
      bodyDocJson: bodyDoc(para("今日は良い日だった")),
      mood: 4,
    });
    const out = parse(merged);
    expect(out.content[0]!.type).toBe("heading");
    expect(out.content[0]!.attrs?.level).toBe(2);
    expect(out.content[0]!.content?.[0]?.text).toBe("夕刊");
    expect(out.content[1]!.content?.[0]?.text).toBe(moodLineText(4));
    expect(out.content[2]!.content?.[0]?.text).toBe("今日は良い日だった");
  });

  it("appends at the END of a daily that has other sections", () => {
    const existing = doc(heading("朝刊"), para("フォーカス"));
    const merged = mergeEveningSection(existing, {
      bodyDocJson: bodyDoc(para("締め")),
      mood: null,
    });
    const out = parse(merged);
    expect(out.content[0]!.content?.[0]?.text).toBe("朝刊");
    expect(out.content[2]!.content?.[0]?.text).toBe("夕刊");
    expect(out.content[3]!.content?.[0]?.text).toBe("締め");
  });

  it("replaces only the evening range, preserving surrounding sections", () => {
    const existing = doc(
      heading("朝刊"),
      para("フォーカス"),
      heading("夕刊"),
      para("気分: 2/5"),
      para("古い振り返り"),
      heading("メモ"),
      para("自由メモ"),
    );
    const merged = mergeEveningSection(existing, {
      bodyDocJson: bodyDoc(para("新しい振り返り")),
      mood: 5,
    });
    const out = parse(merged);
    const texts = out.content.map((n) => n.content?.[0]?.text);
    expect(texts).toEqual([
      "朝刊",
      "フォーカス",
      "夕刊",
      moodLineText(5),
      "新しい振り返り",
      "メモ",
      "自由メモ",
    ]);
  });

  it("keeps the stored value for undefined patch fields", () => {
    const existing = doc(heading("夕刊"), para("気分: 3/5"), para("本文"));
    // mood-only tap: body undefined keeps the stored 本文
    const moodOnly = parse(mergeEveningSection(existing, { mood: 1 }));
    expect(moodOnly.content.map((n) => n.content?.[0]?.text)).toEqual([
      "夕刊",
      moodLineText(1),
      "本文",
    ]);
    // body-only edit: mood undefined keeps the stored 3/5
    const bodyOnly = parse(
      mergeEveningSection(existing, { bodyDocJson: bodyDoc(para("改稿")) }),
    );
    expect(bodyOnly.content.map((n) => n.content?.[0]?.text)).toEqual([
      "夕刊",
      moodLineText(3),
      "改稿",
    ]);
  });

  it("converts a legacy plain-text daily before merging (F-1 rule)", () => {
    const merged = mergeEveningSection("一行目\n二行目", {
      bodyDocJson: bodyDoc(para("夕刊本文")),
      mood: null,
    });
    const out = parse(merged);
    expect(out.content[0]!.content?.[0]?.text).toBe("一行目");
    expect(out.content[1]!.content?.[0]?.text).toBe("二行目");
    expect(out.content[2]!.content?.[0]?.text).toBe("夕刊");
    expect(out.content[3]!.content?.[0]?.text).toBe("夕刊本文");
  });

  it("removes the section when the patch clears mood and body", () => {
    const existing = doc(
      heading("朝刊"),
      para("フォーカス"),
      heading("夕刊"),
      para("気分: 2/5"),
    );
    const merged = mergeEveningSection(existing, {
      bodyDocJson: null,
      mood: null,
    });
    const out = parse(merged);
    expect(out.content.map((n) => n.content?.[0]?.text)).toEqual([
      "朝刊",
      "フォーカス",
    ]);
  });

  it("is a no-op (===) when there is nothing to write", () => {
    const existing = doc(heading("朝刊"), para("フォーカス"));
    expect(
      mergeEveningSection(existing, { bodyDocJson: null, mood: null }),
    ).toBe(existing);
    // an empty editor emission counts as nothing
    expect(
      mergeEveningSection(existing, {
        bodyDocJson: bodyDoc({ type: "paragraph" }),
        mood: null,
      }),
    ).toBe(existing);
  });

  it("round-trips with extractEveningSection", () => {
    const body = bodyDoc(para("今日の振り返り"), para("明日はこうする"));
    const merged = mergeEveningSection(doc(heading("朝刊"), para("focus")), {
      bodyDocJson: body,
      mood: 3,
    });
    const out = extractEveningSection(merged);
    expect(out.mood).toBe(3);
    expect(out.bodyDocJson).toBe(body);
  });
});

// ── isEmptyDocJson ───────────────────────────────────────────────────────

describe("isEmptyDocJson", () => {
  it("treats bare/whitespace paragraphs as empty", () => {
    expect(isEmptyDocJson(bodyDoc({ type: "paragraph" }))).toBe(true);
    expect(isEmptyDocJson(bodyDoc(para("  ")))).toBe(true);
    expect(isEmptyDocJson(bodyDoc(para("text")))).toBe(false);
    expect(isEmptyDocJson("not json")).toBe(true);
  });
});

// ── defaultBriefingTab ───────────────────────────────────────────────────

describe("defaultBriefingTab", () => {
  const at = (hour: number) => new Date(2026, 6, 18, hour, 30);

  it("is morning before 17:00 with the default day start", () => {
    expect(defaultBriefingTab(at(9), 0)).toBe("morning");
    expect(defaultBriefingTab(at(16), 0)).toBe("morning");
  });

  it("is evening from 17:00", () => {
    expect(defaultBriefingTab(at(17), 0)).toBe("evening");
    expect(defaultBriefingTab(at(23), 0)).toBe("evening");
  });

  it("treats the post-midnight tail as evening when the day-start pref shifts", () => {
    expect(defaultBriefingTab(at(2), 4)).toBe("evening");
    expect(defaultBriefingTab(at(4), 4)).toBe("morning");
    // default day start (0): 2 AM is a new day's morning
    expect(defaultBriefingTab(at(2), 0)).toBe("morning");
  });

  it("ignores nonsense day-start prefs (> 12) for the tail rule", () => {
    expect(defaultBriefingTab(at(9), 18)).toBe("morning");
  });
});
