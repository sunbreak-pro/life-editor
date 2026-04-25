import { describe, it, expect } from "vitest";
import {
  extractTextFromTipTap,
  getContentPreview,
  extractFirstHeading,
} from "./tiptapText";

describe("extractTextFromTipTap", () => {
  it("returns text from a single text node", () => {
    expect(extractTextFromTipTap({ type: "text", text: "hello" })).toBe(
      "hello",
    );
  });

  it("joins nested text content with spaces", () => {
    const node = {
      type: "doc",
      content: [
        { type: "text", text: "foo" },
        { type: "text", text: "bar" },
      ],
    };
    expect(extractTextFromTipTap(node)).toBe("foo bar");
  });

  it("returns empty string for null / non-text nodes", () => {
    expect(extractTextFromTipTap(null)).toBe("");
    expect(extractTextFromTipTap({ type: "image" })).toBe("");
  });
});

describe("getContentPreview", () => {
  it("returns up to maxLength characters of plain text", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "abcdef" }] },
      ],
    });
    expect(getContentPreview(json, 4)).toBe("abcd");
  });

  it("returns empty string for empty content", () => {
    expect(getContentPreview("")).toBe("");
  });

  it("falls back to HTML stripping when JSON parse fails", () => {
    expect(getContentPreview("<p>plain</p>")).toBe("plain");
  });

  it("decodes HTML entities in fallback path", () => {
    // DOMParser-based fallback should resolve &amp;/&lt;/&gt; to their chars.
    expect(getContentPreview("<p>foo &amp; bar &lt;baz&gt;</p>")).toBe(
      "foo & bar <baz>",
    );
  });

  it("does not execute embedded scripts in fallback path", () => {
    // The previous innerHTML-based fallback could trigger <img onerror>; the
    // DOMParser path must keep the document inert. Use a marker to detect
    // any accidental side effect during preview extraction.
    type WithMarker = typeof window & { __TIPTAP_PREVIEW_XSS__?: number };
    const w = window as WithMarker;
    delete w.__TIPTAP_PREVIEW_XSS__;
    const malicious =
      '<img src="x" onerror="window.__TIPTAP_PREVIEW_XSS__=1">hello';
    const result = getContentPreview(malicious);
    expect(w.__TIPTAP_PREVIEW_XSS__).toBeUndefined();
    expect(result).toContain("hello");
  });
});

describe("extractFirstHeading", () => {
  function makeDoc(content: unknown[]): string {
    return JSON.stringify({ type: "doc", content });
  }

  it("returns text of the first heading at the top level", () => {
    const json = makeDoc([
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Title" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "body" }],
      },
    ]);
    expect(extractFirstHeading(json)).toBe("Title");
  });

  it("descends into nested content to find the first heading", () => {
    const json = makeDoc([
      {
        type: "blockquote",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Quoted heading" }],
          },
        ],
      },
    ]);
    expect(extractFirstHeading(json)).toBe("Quoted heading");
  });

  it("prefers the first heading in document order over later ones", () => {
    const json = makeDoc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "intro" }],
      },
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "First" }],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Second" }],
      },
    ]);
    expect(extractFirstHeading(json)).toBe("First");
  });

  it("returns null when there is no heading", () => {
    const json = makeDoc([
      { type: "paragraph", content: [{ type: "text", text: "just body" }] },
    ]);
    expect(extractFirstHeading(json)).toBe(null);
  });

  it("returns null for an empty heading (whitespace only)", () => {
    const json = makeDoc([
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "   " }],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "non-empty" }],
      },
    ]);
    // First heading found, but its trimmed text is empty → fall back to null
    // (the caller is responsible for fallback chain to note.title)
    expect(extractFirstHeading(json)).toBe(null);
  });

  it("returns null for empty input", () => {
    expect(extractFirstHeading("")).toBe(null);
  });

  it("returns null for invalid JSON", () => {
    expect(extractFirstHeading("not json")).toBe(null);
  });
});
