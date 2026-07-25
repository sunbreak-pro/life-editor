import { describe, it, expect } from "vitest";
import { jsonDocEquals } from "../src/utils/jsonDocEquals";

/*
 * #300 — the Daily editor's own-echo check. Postgres jsonb reorders object
 * keys (length-then-bytewise), so the refetched echo of our own save comes
 * back byte-different but document-identical. These tests pin the semantic
 * comparison the DailyView remount guard relies on.
 */

describe("jsonDocEquals (#300)", () => {
  it("treats byte-identical strings as equal without parsing", () => {
    expect(jsonDocEquals('{"a":1}', '{"a":1}')).toBe(true);
    expect(jsonDocEquals("", "")).toBe(true);
  });

  it("ignores object key order at any depth (jsonb canonicalization)", () => {
    // A real TipTap doc as emitted by the editor…
    const written =
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hi"}]}]}';
    // …and as it comes back from a jsonb column ("text" sorts before "type").
    const echoed =
      '{"content":[{"content":[{"text":"hi","type":"text"}],"type":"paragraph"}],"type":"doc"}';
    expect(jsonDocEquals(written, echoed)).toBe(true);
    expect(jsonDocEquals(echoed, written)).toBe(true);
  });

  it("detects a genuine content difference (external edit must remount)", () => {
    const a = '{"type":"doc","content":[{"type":"text","text":"hi"}]}';
    const b = '{"type":"doc","content":[{"type":"text","text":"bye"}]}';
    expect(jsonDocEquals(a, b)).toBe(false);
  });

  it("keeps array order significant (document order is content)", () => {
    expect(jsonDocEquals('["a","b"]', '["b","a"]')).toBe(false);
    expect(jsonDocEquals('["a","b"]', '["a","b"]')).toBe(true);
  });

  it("treats missing / extra keys as different", () => {
    expect(jsonDocEquals('{"a":1}', '{"a":1,"b":2}')).toBe(false);
    expect(jsonDocEquals('{"a":1,"b":2}', '{"a":1}')).toBe(false);
  });

  it("distinguishes null / object / array shapes", () => {
    expect(jsonDocEquals("null", "{}")).toBe(false);
    expect(jsonDocEquals("[]", "{}")).toBe(false);
    expect(jsonDocEquals("null", "null")).toBe(true);
  });

  it("falls back to byte equality for non-JSON (legacy plain-text dailies)", () => {
    expect(jsonDocEquals("plain text", "plain text")).toBe(true);
    expect(jsonDocEquals("plain text", "other text")).toBe(false);
    expect(jsonDocEquals('{"a":1}', "not json")).toBe(false);
  });
});
