import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
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
 * 夕刊 (CLOSING THE DAY) の Saved / Unsaved キャプション (#793).
 *
 * The caption asks "has what I just typed been stored?", and the hook answers
 * it by comparing the editor's emitted doc JSON with the doc JSON read back
 * out of the daily. That comparison used to be a raw string ===, which is a
 * promise the storage layer does not keep: `dailies_payload.content_json` is
 * `jsonb`, and Postgres jsonb does NOT preserve object key order (it stores
 * keys sorted by length, then bytewise). A TipTap text node goes down as
 * {"type":"text","text":"…"} and comes back as {"text":"…","type":"text"} —
 * same document, different bytes — so the echo never matched and the caption
 * stayed on Unsaved forever (and every save also looked like an EXTERNAL edit,
 * remounting the editor mid-typing).
 *
 * The stub below reproduces that normalization, so these tests fail against a
 * byte-wise comparison and pass against the semantic one (`jsonDocEquals`,
 * already the fix #300 applied to the Daily editor for the same reason).
 */

/** Postgres jsonb key order: by length first, then bytewise. */
function jsonbKeyOrder(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Re-serialize a value the way a jsonb round-trip would hand it back. */
function jsonbRoundTrip(json: string): string {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (typeof value === "object" && value !== null) {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort(
        jsonbKeyOrder,
      )) {
        out[key] = normalize((value as Record<string, unknown>)[key]);
      }
      return out;
    }
    return value;
  };
  return JSON.stringify(normalize(JSON.parse(json)));
}

const TODAY = todayDateKey();

/** A daily whose 夕刊 section already holds one line of reflection. */
const INITIAL = jsonbRoundTrip(
  JSON.stringify({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "夕刊" }],
      },
      { type: "paragraph", content: [{ type: "text", text: "hello" }] },
    ],
  }),
);

const syncValue: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

function makeDS(): { ds: DataService; read: () => string } {
  let stored = INITIAL;
  const node = (): DailyNode => ({
    id: `daily-${TODAY}`,
    date: TODAY,
    content: stored,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
  });
  const ds = stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTaskTree: vi.fn().mockResolvedValue([]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn(() => Promise.resolve(node())),
    // The write goes through jsonb, so the caller gets the NORMALIZED row
    // back — exactly what SupabaseDailiesUnifiedService re-reads after its
    // UPDATE.
    upsertDailyByDateUnified: vi.fn((_date: string, content: string) => {
      stored = jsonbRoundTrip(content);
      return Promise.resolve(node());
    }),
  });
  return { ds, read: () => stored };
}

/** jsdom has no matchMedia; useMediaQuery falls back to wide without it. */
function setWidth(wide: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: wide,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

/** A real document change: ProseMirror's own Enter keymap splits the block. */
function edit(container: HTMLElement) {
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

async function renderEvening(wide: boolean) {
  setWidth(wide);
  const { ds, read } = makeDS();
  const view = render(
    <SyncContext.Provider value={syncValue}>
      <BriefingScreen dataService={ds} onNavigate={vi.fn()} tab="evening" />
    </SyncContext.Provider>,
  );
  await waitFor(() => expect(screen.getByText("CLOSING THE DAY")).toBeTruthy());
  return { ...view, read };
}

describe.each([
  ["narrow (mobile)", false],
  ["wide (desktop)", true],
])("evening reflection caption — %s (#793)", (_label, wide) => {
  beforeEach(() => setWidth(wide));
  afterEach(() => vi.useRealTimers());

  it("returns to Saved once the debounced write lands", async () => {
    const { container } = await renderEvening(wide);
    // Untouched: nothing is pending, so the paper reports Saved.
    expect(screen.getByText("Saved")).toBeTruthy();

    vi.useFakeTimers();
    edit(container);
    // Fire the editor's 800ms debounce but not the write behind it (the sync
    // timer advance leaves the save's promises unflushed) — honestly Unsaved.
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText("Unsaved")).toBeTruthy();
    vi.useRealTimers();

    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
  });

  it("keeps the editor mounted across its own save (no external-edit remount)", async () => {
    const { container } = await renderEvening(wide);
    const before = container.querySelector(".tiptap");

    vi.useFakeTimers();
    edit(container);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    vi.useRealTimers();

    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
    // A remount would swap the DOM node out and take the caret / IME state
    // with it — the echo of our own write must not read as an outside edit.
    expect(container.querySelector(".tiptap")).toBe(before);
  });
});
