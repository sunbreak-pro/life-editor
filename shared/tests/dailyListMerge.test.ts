// @vitest-environment node (pure functions — no DOM)
import { describe, it, expect } from "vitest";
import {
  fillDailyBodies,
  mergeDailySummaries,
  rowsWithoutHead,
} from "../src/hooks/dailyListMerge";
import type { DailyNode } from "../src/types/daily";

/*
 * #2325 — the light Daily list laid over what the list already holds.
 *
 * A re-read carries no bodies, so the merge decides which body the client
 * keeps: an unchanged day keeps it, the OPEN day keeps it even when its row
 * moved (and is reported stale so the hook fetches it again), any other day
 * whose row moved goes back to light. Losing the open day's body would
 * unmount the editor mid-sentence; keeping another day's stale body would
 * show (and later save over) text that is no longer the server's.
 */

const T0 = "2026-10-20T00:00:00.000Z";
const T1 = "2026-10-20T01:00:00.000Z";

function loaded(date: string, content: string, updatedAt = T0): DailyNode {
  return {
    id: `daily-${date}`,
    date,
    content,
    createdAt: T0,
    updatedAt,
  };
}

function light(date: string, updatedAt = T0, headContent?: string): DailyNode {
  return {
    id: `daily-${date}`,
    date,
    content: "",
    bodyLoaded: false,
    ...(headContent !== undefined ? { headContent } : {}),
    createdAt: T0,
    updatedAt,
  };
}

describe("mergeDailySummaries (#2325)", () => {
  it("keeps the body of a day whose updatedAt did not move", () => {
    const prev = [loaded("2026-10-19", "old body")];
    const { list, stale } = mergeDailySummaries(
      prev,
      [light("2026-10-19", T0, "head")],
      "2026-10-20",
    );
    expect(list).toHaveLength(1);
    expect(list[0].content).toBe("old body");
    expect(list[0].bodyLoaded).toBe(true);
    expect(stale).toEqual([]);
  });

  it("keeps the OPEN day's body when its updatedAt moved, and reports it stale", () => {
    const prev = [loaded("2026-10-20", "typed so far", T0)];
    const { list, stale } = mergeDailySummaries(
      prev,
      [light("2026-10-20", T1)],
      "2026-10-20",
    );
    expect(list[0].content).toBe("typed so far");
    expect(list[0].bodyLoaded).toBe(true);
    // The row's own fields (the new stamp) come from the server.
    expect(list[0].updatedAt).toBe(T1);
    expect(stale).toEqual(["2026-10-20"]);
  });

  it("drops another day back to light when its updatedAt moved", () => {
    const prev = [loaded("2026-10-19", "stale body", T0)];
    const { list, stale } = mergeDailySummaries(
      prev,
      [light("2026-10-19", T1, "new head")],
      "2026-10-20",
    );
    expect(list[0].content).toBe("");
    expect(list[0].bodyLoaded).toBe(false);
    expect(list[0].headContent).toBe("new head");
    expect(stale).toEqual([]);
  });

  it("takes a filled row's body for a day that moved and is not open", () => {
    const filled = {
      ...loaded("2026-10-18", "filled", T1),
      bodyLoaded: true,
    };
    const prev = [loaded("2026-10-18", "something older")];
    const { list } = mergeDailySummaries(prev, [filled], "2026-10-20");
    expect(list[0]).toBe(filled);
  });

  it("keeps the open day's own text over a filled row from the same read (QA I-4)", () => {
    // The open day's first save is out; a re-read for another reason fills
    // the day from the server, which still has the old (empty) body.
    const filled = { ...loaded("2026-10-20", "", T1), bodyLoaded: true };
    const prev = [loaded("2026-10-20", "typed so far")];
    const { list, stale } = mergeDailySummaries(prev, [filled], "2026-10-20");
    expect(list[0].content).toBe("typed so far");
    expect(stale).toEqual(["2026-10-20"]);
  });

  it("keeps the held body for a filled row at the same updatedAt", () => {
    const filled = { ...loaded("2026-10-18", "server"), bodyLoaded: true };
    const prev = [loaded("2026-10-18", "held")];
    const { list } = mergeDailySummaries(prev, [filled], "2026-10-20");
    expect(list[0].content).toBe("held");
  });

  it("leaves a light row light when the previous row was light too, or absent", () => {
    const prev = [light("2026-10-19")];
    const { list, stale } = mergeDailySummaries(
      prev,
      [light("2026-10-19", T1), light("2026-10-17")],
      "2026-10-19",
    );
    expect(list.map((d) => d.bodyLoaded)).toEqual([false, false]);
    expect(stale).toEqual([]);
  });

  it("follows the server's row set: a day missing from the read is gone", () => {
    const prev = [loaded("2026-10-19", "a"), loaded("2026-10-18", "b")];
    const { list } = mergeDailySummaries(
      prev,
      [light("2026-10-19")],
      "2026-10-20",
    );
    expect(list.map((d) => d.date)).toEqual(["2026-10-19"]);
  });
});

describe("fillDailyBodies / rowsWithoutHead (#2325)", () => {
  const para = (text: string) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  });
  const heading = (text: string) => ({
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text }],
  });
  const headOf = (blocks: unknown[]) =>
    JSON.stringify({ type: "doc", content: blocks });

  it("names a row whose full head is all 朝刊, cut before the day's own text (QA I-2)", () => {
    const allBriefing = headOf([
      heading("朝刊"),
      ...Array.from({ length: 23 }, (_, i) => para(`briefing ${i}`)),
    ]);
    const shortBriefing = headOf([heading("朝刊"), para("briefing")]);
    const withText = headOf([
      para("the day's own line"),
      ...Array.from({ length: 23 }, (_, i) => para(`more ${i}`)),
    ]);
    const rows = [
      light("2026-10-20", T0, allBriefing),
      light("2026-10-19", T0, shortBriefing),
      light("2026-10-18", T0, withText),
    ];
    // Only the cut head needs the whole body; a short head that is all 朝刊
    // IS the whole body, and its excerpt is honestly empty.
    expect(rowsWithoutHead(rows)).toEqual(["daily-2026-10-20"]);
  });

  it("names only the light rows without a head", () => {
    const rows = [
      light("2026-10-20", T0, "head"),
      light("2026-10-19"),
      loaded("2026-10-18", "body"),
    ];
    expect(rowsWithoutHead(rows)).toEqual(["daily-2026-10-19"]);
  });

  it("fills the fetched bodies and marks those rows loaded", () => {
    const rows = [light("2026-10-19"), light("2026-10-18")];
    const out = fillDailyBodies(rows, { "daily-2026-10-19": "plain text" });
    expect(out[0]).toMatchObject({
      content: "plain text",
      bodyLoaded: true,
    });
    // No body came back for this one: it stays light.
    expect(out[1]).toBe(rows[1]);
  });

  it("does not overwrite a row that is already loaded", () => {
    const row = loaded("2026-10-19", "mine");
    const out = fillDailyBodies([row], { "daily-2026-10-19": "theirs" });
    expect(out[0]).toBe(row);
  });
});
