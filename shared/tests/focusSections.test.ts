import { describe, it, expect } from "vitest";
import {
  extractFocus,
  mergeFocusSection,
} from "../src/components/briefing/focusSections";

const doc = (...content: unknown[]) => JSON.stringify({ type: "doc", content });
const heading = (text: string, level = 2) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const para = (text: string) => ({
  type: "paragraph",
  content: text === "" ? [] : [{ type: "text", text }],
});

const KEY = "2026-08-18";
const OTHER_KEY = "2026-08-17";

function textsOf(contentJson: string): string[] {
  const parsed = JSON.parse(contentJson) as {
    content: { type: string; content?: { text?: string }[] }[];
  };
  return parsed.content.map((n) => n.content?.[0]?.text ?? "");
}

describe("extractFocus", () => {
  it("returns null for empty / missing / other-day content", () => {
    expect(extractFocus(null, KEY)).toBeNull();
    expect(extractFocus(undefined, KEY)).toBeNull();
    expect(extractFocus("", KEY)).toBeNull();
    expect(
      extractFocus(doc(heading(`フォーカス ${OTHER_KEY}`), para("old")), KEY),
    ).toBeNull();
  });

  it("reads only the keyed day's section", () => {
    const content = doc(
      heading(`フォーカス ${KEY}`),
      para("広げず、深く。"),
      heading(`フォーカス ${OTHER_KEY}`),
      para("昨日の分"),
    );
    expect(extractFocus(content, KEY)).toBe("広げず、深く。");
    expect(extractFocus(content, OTHER_KEY)).toBe("昨日の分");
  });

  it("accepts the English marker, case-insensitively", () => {
    expect(extractFocus(doc(heading(`Focus ${KEY}`), para("deep")), KEY)).toBe(
      "deep",
    );
  });

  it("ignores a bare heading (no key) and headings that merely contain the word", () => {
    expect(
      extractFocus(doc(heading("フォーカス"), para("keyless")), KEY),
    ).toBeNull();
    expect(
      extractFocus(doc(heading(`今日のフォーカス ${KEY}`), para("x")), KEY),
    ).toBeNull();
  });

  it("joins multi-line sections and returns null for an empty one", () => {
    expect(
      extractFocus(
        doc(heading(`フォーカス ${KEY}`), para("A"), para("B")),
        KEY,
      ),
    ).toBe("A\nB");
    expect(
      extractFocus(doc(heading(`フォーカス ${KEY}`), para("  ")), KEY),
    ).toBeNull();
  });
});

describe("mergeFocusSection", () => {
  it("creates the section in an empty body", () => {
    const merged = mergeFocusSection(null, KEY, "広げず、深く。");
    expect(extractFocus(merged, KEY)).toBe("広げず、深く。");
  });

  it("replaces only the keyed day's section, keeping history", () => {
    const content = doc(
      heading(`フォーカス ${KEY}`),
      para("旧"),
      heading(`フォーカス ${OTHER_KEY}`),
      para("昨日の分"),
    );
    const merged = mergeFocusSection(content, KEY, "新");
    expect(extractFocus(merged, KEY)).toBe("新");
    expect(extractFocus(merged, OTHER_KEY)).toBe("昨日の分");
  });

  it("inserts a new day ABOVE existing history, below a preamble", () => {
    const content = doc(
      para("preamble the user wrote in Notes"),
      heading(`フォーカス ${OTHER_KEY}`),
      para("昨日の分"),
    );
    const merged = mergeFocusSection(content, KEY, "今日の分");
    expect(textsOf(merged)).toEqual([
      "preamble the user wrote in Notes",
      `フォーカス ${KEY}`,
      "今日の分",
      `フォーカス ${OTHER_KEY}`,
      "昨日の分",
    ]);
  });

  it("removes the section on empty text and never creates one", () => {
    const content = doc(heading(`フォーカス ${KEY}`), para("旧"));
    const cleared = mergeFocusSection(content, KEY, "  \n ");
    expect(extractFocus(cleared, KEY)).toBeNull();
    // No section and nothing to write → the input comes back by identity,
    // so the host can skip the write (and skip creating the note).
    const noop = mergeFocusSection(content, OTHER_KEY, "");
    expect(noop).toBe(content);
  });

  it("returns the input by identity when nothing changes", () => {
    const content = doc(heading(`フォーカス ${KEY}`), para("同じ"));
    expect(mergeFocusSection(content, KEY, "同じ")).toBe(content);
  });

  it("never touches blocks outside focus sections", () => {
    const content = doc(
      heading("メモ"),
      para("Notes-side text"),
      heading(`フォーカス ${OTHER_KEY}`),
      para("昨日の分"),
    );
    const merged = mergeFocusSection(content, KEY, "今日の分");
    expect(textsOf(merged)).toEqual([
      "メモ",
      "Notes-side text",
      `フォーカス ${KEY}`,
      "今日の分",
      `フォーカス ${OTHER_KEY}`,
      "昨日の分",
    ]);
  });
});
