import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  extractEveningSection,
  extractIntentionSection,
  type DataService,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { mockOf } from "./helpers/briefingHarness";
import { useDailySections } from "../src/briefing/hooks/useDailySections";

/*
 * The Briefing host's EDITING half — 夕刊 body / mood (#892). The 宣言
 * textarea's saves were removed with the paper's declaration field
 * (D-20261007-briefing-1); an older day's 宣言 section is only read now, and
 * the second test below still pins that an evening save keeps it.
 *
 * Every save here is a read-merge-write against a document three other
 * surfaces also write to (the Daily editor, MCP's write_briefing, another
 * device), so the invariants are about what a save must NOT do: never carry a
 * stale copy of a section it did not touch, never overlap another save's
 * read-merge-write cycle, never lose the keystrokes typed since the debounce
 * started. A break in any of them destroys writing the user has already seen
 * accepted, and does it silently.
 *
 * The DataService stub therefore models a real store — `getDailyByDateUnified`
 * hands back whatever was last upserted — because a stub that always returns
 * the initial content would pass a merge that overwrites the whole document.
 */

const TODAY = "2026-08-15";

interface TipTapNodeLike {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: TipTapNodeLike[];
}

const heading = (text: string): TipTapNodeLike => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const para = (text: string): TipTapNodeLike => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const doc = (...nodes: TipTapNodeLike[]): string =>
  JSON.stringify({ type: "doc", content: nodes });

const MORNING = doc(heading("朝刊"), para("Today is wide open."));

/**
 * A DataService whose daily actually remembers what was written to it — the
 * body, and since #2107 the publish stamp the star keeps in step with it.
 */
function makeStore(initial: string | null) {
  const store: { content: string | null; publishedAt: string | null } = {
    content: initial,
    publishedAt: null,
  };
  const node = () => ({
    id: "daily-" + TODAY,
    content: store.content,
    eveningPublishedAt: store.publishedAt,
  });
  const ds: DataService = stubDataService({
    getDailyByDateUnified: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(store.content === null ? null : node()),
      ),
    upsertDailyByDateUnified: vi
      .fn()
      .mockImplementation((_date: string, content: string) => {
        store.content = content;
        return Promise.resolve(node());
      }),
    updateDailyUnified: vi
      .fn()
      .mockImplementation(
        (_id: string, updates: { eveningPublishedAt?: string | null }) => {
          if (updates.eveningPublishedAt !== undefined)
            store.publishedAt = updates.eveningPublishedAt;
          return Promise.resolve(node());
        },
      ),
  });
  return { ds, store };
}

function renderSections(ds: DataService, initial: string | null) {
  return renderHook(() => {
    const [content, setContent] = useState<string | null>(initial);
    const sections = useDailySections(ds, TODAY, content, setContent);
    return { ...sections, content, setContent };
  });
}

describe("useDailySections — 夕刊 saves (#892)", () => {
  it("replaces only the evening range and keeps everything else", async () => {
    const { ds, store } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);

    await act(async () =>
      result.current.handleEveningUpdate(doc(para("Long day."))),
    );
    await waitFor(() =>
      expect(mockOf(ds, "upsertDailyByDateUnified")).toHaveBeenCalled(),
    );

    // The morning paper is written by MCP and must survive a save made from
    // the evening tab — this is a section merge, not a whole-doc overwrite.
    expect(store.content).toContain("Today is wide open.");
    expect(extractEveningSection(store.content).bodyDocJson).toContain(
      "Long day.",
    );
  });

  it("re-reads the freshest daily instead of trusting its own copy", async () => {
    const { ds, store } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);

    // An edit made on the Daily side (or by MCP) after this hook last saw the
    // document. The save must merge onto THIS, not onto the stale prop.
    store.content = doc(
      heading("朝刊"),
      para("Today is wide open."),
      heading("宣言"),
      para("Ship the migration."),
    );

    await act(async () =>
      result.current.handleEveningUpdate(doc(para("Long day."))),
    );
    await waitFor(() =>
      expect(mockOf(ds, "upsertDailyByDateUnified")).toHaveBeenCalled(),
    );

    expect(extractIntentionSection(store.content).text).toBe(
      "Ship the migration.",
    );
    expect(extractEveningSection(store.content).bodyDocJson).toContain(
      "Long day.",
    );
  });

  it("writes nothing when the merge would change nothing", async () => {
    const { ds } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);

    // An empty editor emission on a daily with no evening section: there is
    // no section to clear and none is created.
    await act(async () => result.current.handleEveningUpdate(doc(para(""))));
    await act(async () => undefined);

    expect(mockOf(ds, "upsertDailyByDateUnified")).not.toHaveBeenCalled();
  });

  it("serializes a body save and a mood tap into one chain", async () => {
    const { ds, store } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);

    await act(async () => {
      result.current.handleEveningUpdate(doc(para("Long day.")));
      result.current.handleSelectMood(4);
    });
    await waitFor(() =>
      expect(mockOf(ds, "upsertDailyByDateUnified")).toHaveBeenCalledTimes(2),
    );

    // Two overlapping read-merge-write cycles on the same section would let
    // the mood tap's read miss the body write and resurrect the empty half.
    const stored = extractEveningSection(store.content);
    expect(stored.mood).toBe(4);
    expect(stored.bodyDocJson).toContain("Long day.");
  });

  it("carries a mood tap alone, and clears it when tapped again", async () => {
    const { ds, store } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);

    await act(async () => result.current.handleSelectMood(4));
    expect(result.current.eveningMood).toBe(4);
    await waitFor(() =>
      expect(extractEveningSection(store.content).mood).toBe(4),
    );

    await act(async () => result.current.handleSelectMood(4));
    expect(result.current.eveningMood).toBeNull();
    await waitFor(() =>
      expect(extractEveningSection(store.content).mood).toBeNull(),
    );
  });

  it("remounts the editor for an outside edit but not for its own echo", async () => {
    const { ds } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);
    const before = result.current.eveningGen;

    // Our own save landing: the stored body is what this editor just emitted,
    // so remounting would take the cursor and the IME state with it.
    const own = doc(para("Long day."));
    await act(async () => result.current.handleEveningUpdate(own));
    await act(async () =>
      result.current.setContent(doc(heading("夕刊"), para("Long day."))),
    );
    expect(result.current.eveningGen).toBe(before);
    expect(result.current.eveningSaved).toBe(true);

    // A Daily-side edit of the same section is a different document — the
    // editor has to pick it up.
    await act(async () =>
      result.current.setContent(doc(heading("夕刊"), para("Someone else."))),
    );
    expect(result.current.eveningGen).toBe(before + 1);
  });
});

/*
 * #2107 — the star publishes the day's paper. The issue NUMBER is counted off
 * the mood line, so the publish stamp has to follow that line both ways or
 * the two disagree about whether today's paper exists.
 */
describe("useDailySections — the star publishes (#2107)", () => {
  const ID = "daily-" + TODAY;

  it("stamps evening_published_at once, after the mood line is written", async () => {
    const { ds, store } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);

    await act(async () => result.current.handleSelectMood(4));
    await waitFor(() =>
      expect(mockOf(ds, "updateDailyUnified")).toHaveBeenCalledTimes(1),
    );
    const [id, patch] = mockOf(ds, "updateDailyUnified").mock.calls[0]!;
    expect(id).toBe(ID);
    expect(typeof patch.eveningPublishedAt).toBe("string");
    expect(extractEveningSection(store.content).mood).toBe(4);
  });

  it("keeps the first stamp when the mood is changed", async () => {
    const { ds, store } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);

    await act(async () => result.current.handleSelectMood(4));
    await waitFor(() => expect(store.publishedAt).not.toBeNull());
    const first = store.publishedAt;
    await act(async () => result.current.handleSelectMood(2));
    await waitFor(() =>
      expect(extractEveningSection(store.content).mood).toBe(2),
    );
    expect(mockOf(ds, "updateDailyUnified")).toHaveBeenCalledTimes(1);
    expect(store.publishedAt).toBe(first);
  });

  it("unpublishes (null) when the same star is tapped off", async () => {
    const { ds, store } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);

    await act(async () => result.current.handleSelectMood(4));
    await waitFor(() => expect(store.publishedAt).not.toBeNull());
    await act(async () => result.current.handleSelectMood(4));
    await waitFor(() => expect(store.publishedAt).toBeNull());
    expect(mockOf(ds, "updateDailyUnified")).toHaveBeenLastCalledWith(ID, {
      eveningPublishedAt: null,
    });
  });

  it("never touches the stamp from a body save", async () => {
    const { ds } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);

    await act(async () =>
      result.current.handleEveningUpdate(doc(para("Long day."))),
    );
    await waitFor(() =>
      expect(mockOf(ds, "upsertDailyByDateUnified")).toHaveBeenCalled(),
    );
    expect(mockOf(ds, "updateDailyUnified")).not.toHaveBeenCalled();
  });
});

/*
 * #2107 — the reflection field edits the day's ONE text: an old Daily body is
 * part of it, and the first save moves it under the 夕刊 heading. Moved, never
 * dropped.
 */
describe("useDailySections — the one text (#2107)", () => {
  const LEGACY = doc(
    heading("朝刊"),
    para("Today is wide open."),
    heading("メモ"),
    para("Lunch with Aki."),
  );

  it("shows an old body in the field without writing anything", async () => {
    const { ds } = makeStore(LEGACY);
    const { result } = renderSections(ds, LEGACY);
    expect(result.current.eveningStored.bodyDocJson).toContain(
      "Lunch with Aki.",
    );
    await act(async () => undefined);
    expect(mockOf(ds, "upsertDailyByDateUnified")).not.toHaveBeenCalled();
  });

  it("moves the old body under 夕刊 on the first edit, losing no character", async () => {
    const { ds, store } = makeStore(LEGACY);
    const { result } = renderSections(ds, LEGACY);
    const edited = JSON.parse(result.current.eveningStored.bodyDocJson!);
    edited.content.push(para("Then a walk."));

    await act(async () =>
      result.current.handleEveningUpdate(JSON.stringify(edited)),
    );
    await waitFor(() =>
      expect(mockOf(ds, "upsertDailyByDateUnified")).toHaveBeenCalledTimes(1),
    );
    for (const text of [
      "Today is wide open.",
      "メモ",
      "Lunch with Aki.",
      "Then a walk.",
    ]) {
      expect(store.content).toContain(text);
    }
    // The old body now sits inside the 夕刊 section, after its heading.
    const evening = store.content!.indexOf("夕刊");
    expect(evening).toBeGreaterThan(
      store.content!.indexOf("Today is wide open."),
    );
    expect(store.content!.indexOf("Lunch with Aki.")).toBeGreaterThan(evening);
  });
});
