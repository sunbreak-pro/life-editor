import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  addDaysKey,
  extractFocus,
  todayDateKey,
  type BriefingTab,
  type DataService,
  type NoteNode,
  type SyncDomain,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * The focus line (#1048): written on the EVENING paper into the reserved
 * focus note (`note-focus`), keyed to TOMORROW; the morning paper prints its
 * own day's section. The daily is no longer involved at all — what is worth
 * asserting here is the wiring the papers own: today's section reaches the
 * morning line, the evening field edits tomorrow's section through the
 * section merge, and the note is created on the FIRST SAVE only.
 */

const TODAY = todayDateKey();
const TOMORROW = addDaysKey(TODAY, 1);

function head(text: string) {
  return {
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text }],
  };
}
function body(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}
function noteDoc(...nodes: unknown[]): string {
  return JSON.stringify({ type: "doc", content: nodes });
}

/** Yesterday evening wrote today's focus; the note carries older days too. */
const STORED = noteDoc(
  head(`フォーカス ${TODAY}`),
  body("広げず、深く。"),
  head(`フォーカス ${addDaysKey(TODAY, -1)}`),
  body("昨日の分"),
);

const syncValue: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

function focusNote(content: string): NoteNode {
  return {
    id: "note-focus",
    type: "note",
    title: "Focus",
    content,
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
  };
}

function makeDS(initial: string | null) {
  let stored = initial;
  const createNoteUnified = vi.fn((node: NoteNode) => {
    stored = node.content;
    return Promise.resolve(node);
  });
  const updateNoteUnified = vi.fn((_id: string, patch: Partial<NoteNode>) => {
    stored = patch.content ?? stored ?? "";
    return Promise.resolve(focusNote(stored));
  });
  const ds = stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    // ONE stub for both reserved notes (`note-goals` reads it too): the
    // focus assertions extract by heading key, which the goals sections
    // never carry, so the shared body cannot cross-contaminate.
    getNoteUnified: vi.fn(async () =>
      stored === null ? null : focusNote(stored),
    ),
    createNoteUnified,
    updateNoteUnified,
    restoreNoteUnified: vi.fn().mockResolvedValue(undefined),
  });
  return { ds, createNoteUnified, updateNoteUnified, read: () => stored };
}

function renderScreen(ds: DataService, tab: BriefingTab) {
  render(
    <SyncContext.Provider value={syncValue}>
      <BriefingScreen
        dataService={ds}
        onNavigate={vi.fn()}
        tab={tab}
        key={TODAY}
      />
    </SyncContext.Provider>,
  );
}

function focusField(): HTMLTextAreaElement {
  return screen.getByPlaceholderText(
    "The one thing to move forward tomorrow — one line…",
  ) as HTMLTextAreaElement;
}

describe("Briefing focus line (#1048)", () => {
  it("prints today's section of the focus note on the morning paper", async () => {
    const { ds } = makeDS(STORED);
    renderScreen(ds, "morning");

    await waitFor(() =>
      expect(screen.getByText("広げず、深く。")).toBeTruthy(),
    );
    // Other days' sections are history, never today's line.
    expect(screen.queryByText("昨日の分")).toBeNull();
  });

  it("shows the empty state when no focus was written last evening", async () => {
    const { ds } = makeDS(null);
    renderScreen(ds, "morning");

    await waitFor(() =>
      expect(
        screen.getByText(
          "No focus for today yet. Write it on the previous evening's paper and it will appear here.",
        ),
      ).toBeTruthy(),
    );
  });

  it("saves the evening field into TOMORROW's section, keeping history", async () => {
    const { ds, updateNoteUnified, read } = makeDS(STORED);
    renderScreen(ds, "evening");
    await waitFor(() => expect(focusField()).toBeTruthy());

    fireEvent.change(focusField(), { target: { value: "DDLを最初に。" } });
    fireEvent.blur(focusField());

    await waitFor(() => expect(updateNoteUnified).toHaveBeenCalled());
    expect(updateNoteUnified.mock.calls[0]?.[0]).toBe("note-focus");
    expect(extractFocus(read(), TOMORROW)).toBe("DDLを最初に。");
    // Today's line (this morning's paper) and older history stay put.
    expect(extractFocus(read(), TODAY)).toBe("広げず、深く。");
    expect(extractFocus(read(), addDaysKey(TODAY, -1))).toBe("昨日の分");
  });

  it("creates the reserved note on the first save only", async () => {
    const { ds, createNoteUnified, read } = makeDS(null);
    renderScreen(ds, "evening");
    await waitFor(() => expect(focusField()).toBeTruthy());

    // A blur with nothing typed must not create the note.
    fireEvent.blur(focusField());
    expect(createNoteUnified).not.toHaveBeenCalled();

    fireEvent.change(focusField(), { target: { value: "明日はこれ" } });
    fireEvent.blur(focusField());

    await waitFor(() => expect(createNoteUnified).toHaveBeenCalledTimes(1));
    expect(createNoteUnified.mock.calls[0]?.[0]?.id).toBe("note-focus");
    expect(extractFocus(read(), TOMORROW)).toBe("明日はこれ");
  });
});
