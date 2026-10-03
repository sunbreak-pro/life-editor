import { describe, it, expect } from "vitest";
import {
  blockText,
  docBlocks,
  mergeDocBlocks,
  sameDocContent,
} from "../src/utils/blockMerge";
import { stampsEqual } from "../src/utils/updatedAtStamp";

/*
 * #2057 D-3 — "keep both" and the difference view work block by block, and a
 * block both sides changed is kept twice, mine first.
 */

const p = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const task = (text: string, checked: boolean) => ({
  type: "taskItem",
  attrs: { checked },
  content: [p(text)],
});
const doc = (...blocks: unknown[]) =>
  JSON.stringify({ type: "doc", content: blocks });
const texts = (body: string) => docBlocks(body).map(blockText);

describe("mergeDocBlocks", () => {
  it("takes the other side's change when only it changed a block", () => {
    const base = doc(p("a"), p("b"));
    const theirs = doc(p("a"), p("B"));
    const result = mergeDocBlocks(base, base, theirs);
    expect(texts(result.merged)).toEqual(["a", "B"]);
    expect(result.hasConflict).toBe(false);
    expect(result.hunks.map((h) => h.kind)).toEqual(["same", "theirs"]);
  });

  it("keeps both sides' changes when they touched different blocks", () => {
    const base = doc(p("a"), p("b"), p("c"));
    const mine = doc(p("A"), p("b"), p("c"));
    const theirs = doc(p("a"), p("b"), p("C"));
    const result = mergeDocBlocks(base, mine, theirs);
    expect(texts(result.merged)).toEqual(["A", "b", "C"]);
    expect(result.hasConflict).toBe(false);
  });

  it("pairs in-place edits by position when no unchanged block anchors them", () => {
    // A two-line note: I edit line 1, the other side edits line 2. No block
    // is left unchanged on all three sides to align on.
    const base = doc(p("intro"), p("line"));
    const mine = doc(p("intro mine"), p("line"));
    const theirs = doc(p("intro"), p("line ticked"));
    const result = mergeDocBlocks(base, mine, theirs);
    expect(texts(result.merged)).toEqual(["intro mine", "line ticked"]);
    expect(result.hasConflict).toBe(false);
  });

  it("lists both versions of a block both sides changed, mine first", () => {
    const base = doc(p("intro"), p("same line"));
    const mine = doc(p("intro"), p("my line"));
    const theirs = doc(p("intro"), p("their line"));
    const result = mergeDocBlocks(base, mine, theirs);
    expect(texts(result.merged)).toEqual(["intro", "my line", "their line"]);
    expect(result.hasConflict).toBe(true);
    const conflict = result.hunks.find((h) => h.kind === "conflict");
    expect(conflict && "mine" in conflict ? conflict.mine : []).toHaveLength(1);
  });

  it("does not double a block both sides inserted identically", () => {
    const base = doc(p("a"));
    const mine = doc(p("a"), p("same new"), p("mine only"));
    const theirs = doc(p("a"), p("same new"), p("theirs only"));
    expect(texts(mergeDocBlocks(base, mine, theirs).merged)).toEqual([
      "a",
      "same new",
      "mine only",
      "theirs only",
    ]);
  });

  it("carries the incident's shape: ticks set elsewhere survive my typing", () => {
    // MCP ticked the checklist; I appended a line below it.
    const list = (checked: boolean) => ({
      type: "taskList",
      content: [task("one", checked), task("two", checked)],
    });
    const base = doc(list(false), p("notes"));
    const theirs = doc(list(true), p("notes"));
    const mine = doc(list(false), p("notes"), p("typed after"));
    const merged = mergeDocBlocks(base, mine, theirs).merged;
    expect(texts(merged)).toEqual(["[x] one\n[x] two", "notes", "typed after"]);
  });

  it("ignores key order — the server's jsonb returns keys sorted", () => {
    const base = doc(p("a"));
    const reordered = JSON.stringify({
      content: [{ content: [{ text: "a", type: "text" }], type: "paragraph" }],
      type: "doc",
    });
    expect(mergeDocBlocks(base, base, reordered).hunks).toEqual([
      { kind: "same", blocks: docBlocks(base) },
    ]);
  });
});

describe("sameDocContent", () => {
  it("treats a never-written body and an empty document as the same", () => {
    expect(sameDocContent("", doc({ type: "paragraph" }))).toBe(true);
  });

  it("tells a ticked box from an unticked one", () => {
    expect(sameDocContent(doc(task("x", false)), doc(task("x", true)))).toBe(
      false,
    );
  });
});

describe("stampsEqual", () => {
  it("reads Z and +00:00 as the same instant", () => {
    expect(
      stampsEqual("2026-10-01T09:12:00.123Z", "2026-10-01T09:12:00.123+00:00"),
    ).toBe(true);
  });

  it("keeps microseconds — two server stamps in the same millisecond differ", () => {
    expect(
      stampsEqual(
        "2026-10-01T09:12:00.123456+00:00",
        "2026-10-01T09:12:00.123457+00:00",
      ),
    ).toBe(false);
    expect(
      stampsEqual(
        "2026-10-01T09:12:00.1234+00:00",
        "2026-10-01T09:12:00.123400+00:00",
      ),
    ).toBe(true);
  });

  it("never matches an unknown version", () => {
    expect(stampsEqual(null, "2026-10-01T09:12:00Z")).toBe(false);
  });
});
