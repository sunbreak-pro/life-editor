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
 * The Briefing host's EDITING half — 夕刊 body / mood and the 宣言 textarea
 * (#892).
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

/** A DataService whose daily actually remembers what was written to it. */
function makeStore(initial: string | null) {
  const store = { content: initial };
  const ds: DataService = stubDataService({
    getDailyByDateUnified: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          store.content === null ? null : { content: store.content },
        ),
      ),
    upsertDailyByDateUnified: vi
      .fn()
      .mockImplementation((_date: string, content: string) => {
        store.content = content;
        return Promise.resolve({ content });
      }),
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

describe("useDailySections — 宣言 saves (#892)", () => {
  it("waits out the debounce, then writes once", async () => {
    vi.useFakeTimers();
    try {
      const { ds, store } = makeStore(MORNING);
      const { result } = renderSections(ds, MORNING);

      await act(async () => result.current.handleIntentionChange("Ship it"));
      expect(result.current.intentionText).toBe("Ship it");
      await act(async () => {
        vi.advanceTimersByTime(799);
      });
      expect(mockOf(ds, "upsertDailyByDateUnified")).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(mockOf(ds, "upsertDailyByDateUnified")).toHaveBeenCalledTimes(1);
      expect(extractIntentionSection(store.content).text).toBe("Ship it");
    } finally {
      vi.useRealTimers();
    }
  });

  it("collapses a burst of keystrokes into the last value", async () => {
    vi.useFakeTimers();
    try {
      const { ds, store } = makeStore(MORNING);
      const { result } = renderSections(ds, MORNING);

      await act(async () => {
        result.current.handleIntentionChange("S");
        result.current.handleIntentionChange("Sh");
        result.current.handleIntentionChange("Ship it");
      });
      await act(async () => {
        vi.advanceTimersByTime(800);
      });

      expect(mockOf(ds, "upsertDailyByDateUnified")).toHaveBeenCalledTimes(1);
      expect(extractIntentionSection(store.content).text).toBe("Ship it");
    } finally {
      vi.useRealTimers();
    }
  });

  it("flushes on demand, and the cancelled timer writes nothing after", async () => {
    vi.useFakeTimers();
    try {
      const { ds } = makeStore(MORNING);
      const { result } = renderSections(ds, MORNING);

      await act(async () => result.current.handleIntentionChange("Ship it"));
      await act(async () => result.current.flushIntention());
      expect(mockOf(ds, "upsertDailyByDateUnified")).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(800);
      });
      expect(mockOf(ds, "upsertDailyByDateUnified")).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not drop the tail keystrokes on unmount", async () => {
    vi.useFakeTimers();
    try {
      const { ds, store } = makeStore(MORNING);
      const { result, unmount } = renderSections(ds, MORNING);

      await act(async () => result.current.handleIntentionChange("Ship it"));
      await act(async () => {
        unmount();
      });

      // Leaving the tab within the debounce window is exactly when this
      // happens, and the user has no way of knowing the save never ran.
      expect(mockOf(ds, "upsertDailyByDateUnified")).toHaveBeenCalledTimes(1);
      expect(extractIntentionSection(store.content).text).toBe("Ship it");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the draft when the store catches up with our own save", async () => {
    const { ds } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);

    await act(async () => result.current.handleIntentionChange("Ship it"));
    await act(async () => result.current.flushIntention());
    await waitFor(() =>
      expect(mockOf(ds, "upsertDailyByDateUnified")).toHaveBeenCalled(),
    );

    // The echo landing must not eat a trailing newline typed since the save.
    expect(result.current.intentionDraft).toBe("Ship it");
    expect(result.current.intentionText).toBe("Ship it");
    expect(result.current.intentionSaved).toBe(true);
  });

  it("drops the draft when someone else changes the declaration", async () => {
    const { ds } = makeStore(MORNING);
    const { result } = renderSections(ds, MORNING);

    await act(async () => result.current.handleIntentionChange("Ship it"));
    expect(result.current.intentionSaved).toBe(false);

    await act(async () =>
      result.current.setContent(
        doc(heading("宣言"), para("Rest properly today.")),
      ),
    );

    // External wins — the same rule the mood draft follows.
    expect(result.current.intentionDraft).toBeUndefined();
    expect(result.current.intentionText).toBe("Rest properly today.");
  });
});
