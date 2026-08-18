import { describe, it, expect } from "vitest";
import {
  plainTextToTipTapDoc,
  dailyContentToEditorContent,
  dailyContentExcerpt,
  dailyContentHasRenderedContent,
} from "../src/components/materials/dailyContent";
import { extractBriefing } from "../src/components/briefing/extractBriefing";

const DOC = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "朝刊" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "今日のフォーカス" }],
    },
  ],
});

describe("plainTextToTipTapDoc", () => {
  it("converts each line to a paragraph, empty lines to bare paragraphs", () => {
    expect(plainTextToTipTapDoc("one\n\ntwo")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "one" }] },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "two" }] },
      ],
    });
  });

  it("converts a single line to a single paragraph", () => {
    expect(plainTextToTipTapDoc("hello").content).toHaveLength(1);
  });

  it("strips CRLF line endings (no trailing \\r in paragraph text)", () => {
    expect(plainTextToTipTapDoc("one\r\ntwo")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "one" }] },
        { type: "paragraph", content: [{ type: "text", text: "two" }] },
      ],
    });
  });
});

describe("dailyContentToEditorContent", () => {
  it("returns undefined for empty / absent content", () => {
    expect(dailyContentToEditorContent("")).toBeUndefined();
    expect(dailyContentToEditorContent(undefined)).toBeUndefined();
  });

  it("passes an existing TipTap doc JSON through unchanged", () => {
    expect(dailyContentToEditorContent(DOC)).toBe(DOC);
  });

  it("converts legacy plain text to a doc JSON (lazy — caller only saves on edit)", () => {
    const out = dailyContentToEditorContent("line1\nline2");
    expect(out).toBeDefined();
    expect(JSON.parse(out!)).toEqual(plainTextToTipTapDoc("line1\nline2"));
  });

  it("treats JSON that is not a doc as plain text (never feeds garbage to the editor)", () => {
    // "123" JSON.parses to a number; an object without type:"doc" is not a doc.
    for (const legacy of ["123", '{"foo":1}', '"quoted"']) {
      const out = dailyContentToEditorContent(legacy);
      expect(JSON.parse(out!)).toEqual(plainTextToTipTapDoc(legacy));
    }
  });
});

describe("dailyContentExcerpt", () => {
  it("returns the first non-empty line of plain text", () => {
    expect(dailyContentExcerpt("\n  \nfirst\nsecond")).toBe("first");
  });

  it("returns the first non-empty block text of a TipTap doc", () => {
    expect(dailyContentExcerpt(DOC)).toBe("朝刊");
  });

  it("returns undefined for empty forms", () => {
    expect(dailyContentExcerpt(undefined)).toBeUndefined();
    expect(dailyContentExcerpt("")).toBeUndefined();
    expect(
      dailyContentExcerpt(
        JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
      ),
    ).toBeUndefined();
  });
});

describe("dailyContentHasRenderedContent (#371 follow-up)", () => {
  // A resolved "[[ ]]" link is an inline ATOM: attrs only, no text node. The
  // excerpt-based emptiness check therefore read a link-only body as empty and
  // the day was never saved — losing the link and the row its graph edge waits
  // on.
  const LINK_ONLY = JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "itemLink",
            attrs: { targetId: "note-1", label: "設計メモ", role: "note" },
          },
          { type: "text", text: " " },
        ],
      },
    ],
  });

  it("sees a body that is only a link, where the excerpt does not", () => {
    expect(dailyContentExcerpt(LINK_ONLY)).toBeUndefined();
    expect(dailyContentHasRenderedContent(LINK_ONLY)).toBe(true);
  });

  it("still reports an emptied-out body as empty", () => {
    const blank = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    const whitespace = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "  " }] }],
    });
    expect(dailyContentHasRenderedContent(blank)).toBe(false);
    expect(dailyContentHasRenderedContent(whitespace)).toBe(false);
    expect(dailyContentHasRenderedContent(undefined)).toBe(false);
    expect(dailyContentHasRenderedContent("")).toBe(false);
  });

  it("agrees with the excerpt on ordinary text bodies", () => {
    expect(dailyContentHasRenderedContent(DOC)).toBe(true);
    expect(dailyContentHasRenderedContent("legacy plain text")).toBe(true);
    expect(dailyContentHasRenderedContent("   \n  ")).toBe(false);
  });
});

describe("F-1 round trip with extractBriefing", () => {
  it("a heading+paragraph doc written by the editor is picked up by the briefing parser", () => {
    const briefing = extractBriefing(DOC);
    expect(briefing).not.toBeNull();
    expect(briefing!.paragraphs[0]).toBe("今日のフォーカス");
  });

  it("legacy plain text converted at read time stays paragraph-only (no false briefing)", () => {
    const converted = dailyContentToEditorContent("朝刊\n本文");
    expect(extractBriefing(converted)).toBeNull();
  });
});
