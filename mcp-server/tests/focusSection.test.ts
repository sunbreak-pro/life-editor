import { describe, it, expect } from "vitest";
import {
  FOCUS_NOTE_ID,
  mergeFocusSection,
  normalizeFocusText,
} from "../src/utils/focusSection.js";
// Cross-package TEST-ONLY import (the briefingSection round-trip's precedent):
// the read half of the focus convention lives in shared. The round-trip below
// is the machine check for the #1097 DoD — "the focus write_briefing wrote is
// what the morning paper's parser reads back".
import {
  FOCUS_NOTE_ID as SHARED_FOCUS_NOTE_ID,
  extractFocus,
} from "../../shared/src/components/briefing/focusSections.js";

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

describe("normalizeFocusText", () => {
  it("trims lines, drops blanks, nulls an all-empty text", () => {
    expect(normalizeFocusText(" 一点集中 \n\n  ")).toBe("一点集中");
    expect(normalizeFocusText("a\r\n b ")).toBe("a\nb");
    expect(normalizeFocusText("   \n  ")).toBeNull();
    expect(normalizeFocusText(null)).toBeNull();
  });
});

describe("mergeFocusSection", () => {
  it("creates the day's section in an empty body", () => {
    const out = JSON.parse(mergeFocusSection(null, "2026-08-19", "一点集中"));
    expect(out.type).toBe("doc");
    expect(out.content[0].type).toBe("heading");
    expect(out.content[0].content[0].text).toBe("フォーカス 2026-08-19");
    expect(out.content[1].content[0].text).toBe("一点集中");
  });

  it("replaces only the day's own section, keeping other days' history", () => {
    const existing = doc(
      heading("フォーカス 2026-08-19"),
      para("旧フォーカス"),
      heading("フォーカス 2026-08-18"),
      para("昨日のフォーカス"),
    );
    const out = mergeFocusSection(existing, "2026-08-19", "新フォーカス");
    expect(extractFocus(out, "2026-08-19")).toBe("新フォーカス");
    expect(extractFocus(out, "2026-08-18")).toBe("昨日のフォーカス");
    expect(out.includes("旧フォーカス")).toBe(false);
  });

  it("inserts a new day above the first focus section, below a preamble", () => {
    const existing = doc(
      para("メモ書き"),
      heading("フォーカス 2026-08-18"),
      para("昨日のフォーカス"),
    );
    const out = JSON.parse(mergeFocusSection(existing, "2026-08-19", "今日"));
    expect(out.content[0].content[0].text).toBe("メモ書き");
    expect(out.content[1].content[0].text).toBe("フォーカス 2026-08-19");
    expect(out.content[3].content[0].text).toBe("フォーカス 2026-08-18");
  });

  it("never treats a heading that merely contains the word as a section", () => {
    const existing = doc(heading("フォーカスの話"), para("エッセイ"));
    const out = mergeFocusSection(existing, "2026-08-19", "今日");
    expect(out.includes("エッセイ")).toBe(true);
    expect(extractFocus(out, "2026-08-19")).toBe("今日");
  });

  it("rejects an empty focus instead of deleting anything", () => {
    expect(() => mergeFocusSection(null, "2026-08-19", "  \n ")).toThrow(
      /focus/,
    );
  });

  it("refuses to clobber unparseable existing content", () => {
    expect(() => mergeFocusSection("not json {", "2026-08-19", "f")).toThrow(
      /refusing/,
    );
  });

  it("returns the input unchanged (===) on a byte-identical merge", () => {
    const once = mergeFocusSection(null, "2026-08-19", "一点集中");
    expect(mergeFocusSection(once, "2026-08-19", "一点集中")).toBe(once);
  });
});

describe("round-trip with shared extractFocus (DoD)", () => {
  it("targets the same reserved note id as the shared reader", () => {
    expect(FOCUS_NOTE_ID).toBe(SHARED_FOCUS_NOTE_ID);
  });

  it("extractFocus reads back exactly what write_briefing wrote", () => {
    const content = mergeFocusSection(null, "2026-08-19", "PR #1097 を閉じる");
    expect(extractFocus(content, "2026-08-19")).toBe("PR #1097 を閉じる");
    // Another day's paper never sees it.
    expect(extractFocus(content, "2026-08-18")).toBeNull();
  });

  it("a multi-line focus survives the round trip line by line", () => {
    const content = mergeFocusSection(null, "2026-08-19", " 一行目 \n\n二行目");
    expect(extractFocus(content, "2026-08-19")).toBe("一行目\n二行目");
  });
});
