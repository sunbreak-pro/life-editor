import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  todayDateKey,
  type DailyNode,
  type SyncDomain,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/* The editor is behind lazy() (#991) — import it at collect time so the
 * waitFor below is not racing a TipTap transform (#1079). */
await import("../src/notes/RichTextEditor");

/*
 * 夕刊「CLOSING THE DAY」says only what it knows (#1822).
 *
 * The caption was an unconditional ternary over `eveningSaved`, and
 * `eveningSaved` was true in two situations that are not "saved":
 *
 *   1. Nothing has ever been written. Every term is vacuously true, so an
 *      untouched day showed「Saved」— a receipt for a write that never
 *      happened. The 宣言 block has answered this since #427 by printing no
 *      caption at all while there is nothing to report.
 *   2. A key has just been pressed. `onUpdate` is debounced by 800ms, so for
 *      that window the last EMITTED body is still the stored one and the
 *      comparison says「Saved」over text that is only on screen.
 *
 * briefingEveningSavedCaption.test.tsx owns the third state (the write is in
 * flight → Saved once it lands) and drives the same real ProseMirror.
 */

const TODAY = todayDateKey();

/** A daily whose 夕刊 section already holds one line of reflection. */
const WITH_REFLECTION = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "夕刊" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "hello" }] },
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

/** A DataService whose daily starts EMPTY — no 夕刊 section at all. */
function makeDS(initial: string | null) {
  let stored = initial;
  const node = (): DailyNode | null =>
    stored === null
      ? null
      : {
          id: `daily-${TODAY}`,
          date: TODAY,
          content: stored,
          createdAt: "2026-09-21T00:00:00.000Z",
          updatedAt: "2026-09-21T00:00:00.000Z",
        };
  return stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn(() => Promise.resolve(node())),
    upsertDailyByDateUnified: vi.fn((_date: string, content: string) => {
      stored = content;
      const written = node();
      if (written === null) throw new Error("unreachable");
      return Promise.resolve(written);
    }),
  });
}

async function renderEvening(initial: string | null) {
  const view = render(
    <SyncContext.Provider value={syncValue}>
      <BriefingScreen
        dataService={makeDS(initial)}
        onNavigate={vi.fn()}
        tab="evening"
      />
    </SyncContext.Provider>,
  );
  await waitFor(() => expect(screen.getByText("CLOSING THE DAY")).toBeTruthy());
  return view;
}

/** Swap the reflection preview for the real editor (#1115) and wait for it. */
async function openEditor(container: HTMLElement) {
  fireEvent.click(
    screen.getByRole("button", { name: /^Write today's reflection/ }),
  );
  await waitFor(() => expect(container.querySelector(".tiptap")).toBeTruthy());
}

/** A real document change: ProseMirror's own Enter keymap splits the block. */
function typeInto(container: HTMLElement) {
  const dom = container.querySelector<HTMLElement>(".tiptap");
  if (!dom) throw new Error("editor did not mount");
  act(() => {
    dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

describe("夕刊 caption honesty (#1822)", () => {
  afterEach(() => vi.useRealTimers());

  it("prints no caption at all on a day with nothing written", async () => {
    await renderEvening(null);
    expect(screen.queryByText("Saved")).toBeNull();
    expect(screen.queryByText("Unsaved")).toBeNull();
  });

  it("says Unsaved from the keystroke, not from the debounce", async () => {
    // A day that HAS a reflection, so the caption is on screen to be wrong:
    // it reads「Saved」until something changes.
    const { container } = await renderEvening(WITH_REFLECTION);
    await openEditor(container);
    expect(screen.getByText("Saved")).toBeTruthy();

    vi.useFakeTimers();
    typeInto(container);
    // The 800ms debounce has NOT fired yet — this is the window the caption
    // used to spend claiming「Saved」over text that was only on screen.
    expect(screen.getByText("Unsaved")).toBeTruthy();
    expect(screen.queryByText("Saved")).toBeNull();

    // Fire the debounce and let the write behind it land: Saved again. (The
    // in-flight state between those two is pinned by
    // briefingEveningSavedCaption.test.tsx, which owns that half.)
    act(() => {
      vi.advanceTimersByTime(800);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
  });
});
