import { describe, it, expect } from "vitest";
import { contentJsonToString, contentPlainText } from "../src/utils/content.js";

/*
 * jsonb ↔ TipTap-string normalisation (#360). The unified schema keeps note
 * and daily bodies in `content_json` (jsonb) while the MCP tools still hand
 * callers a TipTap JSON string, so these conversions sit on every read and
 * write path.
 */

const DOC = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "買い物メモ" }],
    },
  ],
};

describe("contentJsonToString", () => {
  it("treats an absent body as empty", () => {
    expect(contentJsonToString(null)).toBe("");
    expect(contentJsonToString(undefined)).toBe("");
  });

  it("serialises a parsed jsonb value", () => {
    expect(contentJsonToString(DOC)).toBe(JSON.stringify(DOC));
  });

  it("passes an already-stringified body through unchanged", () => {
    expect(contentJsonToString('{"type":"doc"}')).toBe('{"type":"doc"}');
  });
});

describe("contentPlainText", () => {
  it("extracts the text nodes of a TipTap document", () => {
    expect(contentPlainText(DOC)).toBe("買い物メモ");
  });

  it("returns empty for an absent body", () => {
    expect(contentPlainText(null)).toBe("");
  });

  it("falls back to the raw value when it is not TipTap JSON", () => {
    expect(contentPlainText("plain text")).toBe("plain text");
  });
});

describe("round trip", () => {
  it("survives the jsonb → string → parse cycle a read path performs", () => {
    expect(JSON.parse(contentJsonToString(DOC))).toEqual(DOC);
  });
});
