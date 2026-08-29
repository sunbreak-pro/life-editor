import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  todayDateKey,
  type DailyNode,
  type DataService,
  type SyncDomain,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * #1115 — the 夕刊 reflection must not mount the editor until asked.
 *
 * The editor has been behind lazy() since #991, but a boundary only defers the
 * fetch while nothing renders behind it, and this paper rendered it on arrival:
 * `defaultBriefingTab()` opens the evening tab from 17:00 and Briefing is the
 * default landing section, so the 118 KB gzip TipTap chunk was fetched 1,492 ms
 * into every evening session whether or not anyone meant to write (#994 §8.5).
 *
 * Deliberately NOT importing RichTextEditor at the top of this file, unlike the
 * sibling suite briefingEveningSavedCaption.test.tsx: that one pre-imports to
 * keep TipTap's transform out of its waitFor budget, but here the ABSENCE of
 * the editor is the assertion, so warming it up front would hide the very
 * regression this guards. The one test that does mount it pays the transform.
 */

const TODAY = todayDateKey();

/** A daily whose 夕刊 section already holds two lines of reflection. */
const STORED = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "夕刊" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "shipped the sweep" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "slept badly" }] },
  ],
});

const syncValue: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

function makeDS(content: string | null): DataService {
  const node = (): DailyNode | null =>
    content === null
      ? null
      : {
          id: `daily-${TODAY}`,
          date: TODAY,
          content,
          createdAt: "2026-08-13T00:00:00.000Z",
          updatedAt: "2026-08-13T00:00:00.000Z",
        };
  return stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn(() => Promise.resolve(node())),
    getNoteUnified: vi.fn().mockResolvedValue(null),
    upsertDailyByDateUnified: vi.fn().mockResolvedValue(node()),
  }) as DataService;
}

async function renderEvening(content: string | null) {
  // One DataService for the whole render, so a rerender is a tab change rather
  // than a new backend.
  const ds = makeDS(content);
  const tree = (tab: "morning" | "evening") => (
    <SyncContext.Provider value={syncValue}>
      <BriefingScreen dataService={ds} onNavigate={vi.fn()} tab={tab} />
    </SyncContext.Provider>
  );
  const view = render(tree("evening"));
  await waitFor(() => expect(screen.getByText("CLOSING THE DAY")).toBeTruthy());
  return { ...view, showTab: (tab: "morning" | "evening") => view.rerender(tree(tab)) };
}

/*
 * The accessible name is the action FOLLOWED BY the lines: role=button prunes
 * its children as presentational, so a name of just the action would leave a
 * screen-reader user unable to hear their own reflection without pressing into
 * an editor. Matching on a prefix rather than the whole string is what keeps
 * these queries stable across fixtures.
 */
const EDIT_LABEL = /^Write today's reflection/;

describe("Briefing evening reflection — editor mounts on request (#1115)", () => {
  it("names itself with the reflection, not just the action", async () => {
    // Without this the stored lines are unreachable to a screen reader: the
    // button's children are pruned as presentational, so whatever the name
    // does not say is not announced anywhere on this surface.
    await renderEvening(STORED);

    screen.getByRole("button", {
      name: "Write today's reflection shipped the sweep slept badly",
    });
  });

  it("shows the stored reflection as text, with no editor in the tree", async () => {
    const view = await renderEvening(STORED);

    // The whole point: TipTap has not been rendered, so its chunk has not been
    // asked for. `.tiptap` is ProseMirror's own root class.
    expect(view.container.querySelector(".tiptap")).toBeNull();
    // …and the user can still READ what they wrote, which is what makes the
    // deferral acceptable rather than a feature regression.
    screen.getByText("shipped the sweep");
    screen.getByText("slept badly");
  });

  it("offers the placeholder when nothing has been written yet", async () => {
    const view = await renderEvening(null);

    expect(view.container.querySelector(".tiptap")).toBeNull();
    // The editor's own placeholder, so the empty state does not change wording
    // when the swap happens.
    screen.getByText("How was your day…");
  });

  it("mounts the editor when the reflection is pressed", async () => {
    const view = await renderEvening(STORED);

    fireEvent.click(screen.getByRole("button", { name: EDIT_LABEL }));

    await waitFor(() =>
      expect(view.container.querySelector(".tiptap")).toBeTruthy(),
    );
    // The preview is gone rather than stacked behind the editor.
    expect(screen.queryByRole("button", { name: EDIT_LABEL })).toBeNull();
    // The stored text came across into the editor — the swap is not a reset.
    expect(view.container.querySelector(".tiptap")?.textContent).toContain(
      "shipped the sweep",
    );
  });

  it("puts the caret in the editor it just mounted", async () => {
    // Without this the press reads as dead: the editor looks like the preview
    // it replaced, and the next keystroke goes nowhere.
    const view = await renderEvening(STORED);

    fireEvent.click(screen.getByRole("button", { name: EDIT_LABEL }));

    await waitFor(() => {
      const tiptap = view.container.querySelector(".tiptap");
      expect(tiptap).toBeTruthy();
      expect(tiptap?.contains(document.activeElement)).toBe(true);
    });
  });

  it("goes back to the preview when the paper is left and re-opened", async () => {
    /*
     * The latch is scoped to the tab (and the day), not the session. Leaving
     * the evening paper unmounts the editor either way, so a sticky latch
     * would only mean the paper comes back already in edit mode — and, with
     * the focus rule above, popping the on-screen keyboard on every return.
     * Arriving at the evening paper should look the same every time.
     */
    const view = await renderEvening(STORED);
    fireEvent.click(screen.getByRole("button", { name: EDIT_LABEL }));
    await waitFor(() =>
      expect(view.container.querySelector(".tiptap")).toBeTruthy(),
    );

    view.showTab("morning");
    view.showTab("evening");

    await waitFor(() => expect(screen.getByText("CLOSING THE DAY")).toBeTruthy());
    screen.getByRole("button", { name: EDIT_LABEL });
    expect(view.container.querySelector(".tiptap")).toBeNull();
  });

  it("reaches the editor by keyboard alone", async () => {
    // It is the ONLY way into the editor, so a pointer-only affordance would
    // lock a keyboard user out of writing their evening page entirely.
    const view = await renderEvening(STORED);

    const trigger = screen.getByRole("button", { name: EDIT_LABEL });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(trigger); // what the browser synthesises for Enter on a button

    await waitFor(() =>
      expect(view.container.querySelector(".tiptap")).toBeTruthy(),
    );
  });
});
