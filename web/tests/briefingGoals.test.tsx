import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  act,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  extractGoals,
  todayDateKey,
  type DataService,
  type NoteNode,
  type SyncDomain,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * 週 / 月 / 年の目標 on the morning paper (#872).
 *
 * The goals live in ONE reserved note (`note-goals`), so what is worth
 * asserting here is the wiring the paper owns: the note's body reaches the
 * three fields, an edit is written back through the section merge, and the
 * note itself is created on the FIRST SAVE — not by opening the paper, which
 * would leave an empty note in Notes for anyone who never wrote a goal.
 *
 * Saves are debounced; blur flushes them, so the tests drive blur rather than
 * waiting out a timer.
 */

const TODAY = todayDateKey();

const STORED = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "週目標" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "Ship the block" }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "年目標" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "Live by it" }] },
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

function goalsNote(content: string, isDeleted = false): NoteNode {
  return {
    id: "note-goals",
    type: "note",
    title: "Goals",
    content,
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
  };
}

interface DSOptions {
  /** The goals note answers only once this resolves (slow read). */
  readGate?: Promise<void>;
  /** The note is in the trash (deleted from Notes). */
  trashed?: boolean;
  /**
   * What the store really ends up holding after our write — the hook believes
   * the response, so this is how "someone else won the race" is expressed.
   */
  onUpdate?: (merged: string) => string;
}

function makeDS(initial: string | null, opts: DSOptions = {}) {
  let stored = initial;
  let trashed = opts.trashed === true;
  const createNoteUnified = vi.fn((node: NoteNode) => {
    stored = node.content;
    return Promise.resolve(node);
  });
  const updateNoteUnified = vi.fn((_id: string, patch: Partial<NoteNode>) => {
    const merged = patch.content ?? stored ?? "";
    stored = opts.onUpdate === undefined ? merged : opts.onUpdate(merged);
    return Promise.resolve(goalsNote(stored, trashed));
  });
  const restoreNoteUnified = vi.fn(() => {
    trashed = false;
    return Promise.resolve();
  });
  const ds = stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    getNoteUnified: vi.fn(async () => {
      await opts.readGate;
      return stored === null ? null : goalsNote(stored, trashed);
    }),
    createNoteUnified,
    updateNoteUnified,
    restoreNoteUnified,
  });
  return {
    ds,
    createNoteUnified,
    updateNoteUnified,
    restoreNoteUnified,
    read: () => stored,
  };
}

function renderScreen(ds: DataService) {
  render(
    <SyncContext.Provider value={syncValue}>
      <BriefingScreen
        dataService={ds}
        onNavigate={vi.fn()}
        tab="morning"
        key={TODAY}
      />
    </SyncContext.Provider>,
  );
}

/** A goal field — matched by its own placeholder, not by position. */
function goalField(period: "week" | "month" | "year"): HTMLTextAreaElement {
  return screen.getByPlaceholderText(
    `What will you get done this ${period}? One line is enough…`,
  ) as HTMLTextAreaElement;
}

function weekField(): HTMLTextAreaElement {
  return goalField("week");
}

/** Type into a goal field and blur it, which flushes the debounced save. */
function typeGoal(period: "week" | "month" | "year", text: string) {
  const field = goalField(period);
  fireEvent.change(field, { target: { value: text } });
  fireEvent.blur(field);
}

describe("Briefing goals block (#872)", () => {
  it("shows the stored goals under the paper's period labels", async () => {
    const { ds } = makeDS(STORED);
    renderScreen(ds);

    await waitFor(() => expect(weekField().value).toBe("Ship the block"));
    expect(goalField("year").value).toBe("Live by it");
    // No 月目標 section stored → an empty field, not a missing one.
    expect(goalField("month").value).toBe("");
    expect(screen.getByText("THIS WEEK")).toBeTruthy();
    expect(screen.getByText("THIS MONTH")).toBeTruthy();
    expect(screen.getByText("THIS YEAR")).toBeTruthy();
  });

  it("writes an edit back through the section merge, leaving the others", async () => {
    const { ds, updateNoteUnified, read } = makeDS(STORED);
    renderScreen(ds);
    await waitFor(() => expect(weekField().value).toBe("Ship the block"));

    fireEvent.change(weekField(), { target: { value: "Ship it twice" } });
    fireEvent.blur(weekField());

    await waitFor(() => expect(updateNoteUnified).toHaveBeenCalled());
    expect(updateNoteUnified.mock.calls[0]?.[0]).toBe("note-goals");
    expect(extractGoals(read())).toEqual({
      week: "Ship it twice",
      month: null,
      year: "Live by it",
    });
  });

  it("creates the reserved note on the first save only", async () => {
    const { ds, createNoteUnified, updateNoteUnified, read } = makeDS(null);
    renderScreen(ds);
    await waitFor(() => expect(weekField()).toBeTruthy());

    // Opening the paper (and a blur with nothing typed) must not create it.
    fireEvent.blur(weekField());
    expect(createNoteUnified).not.toHaveBeenCalled();

    fireEvent.change(weekField(), { target: { value: "First goal" } });
    fireEvent.blur(weekField());

    await waitFor(() => expect(createNoteUnified).toHaveBeenCalledTimes(1));
    expect(createNoteUnified.mock.calls[0]?.[0].id).toBe("note-goals");
    expect(updateNoteUnified).not.toHaveBeenCalled();
    expect(extractGoals(read()).week).toBe("First goal");
  });

  /*
   * The gate the fields must sit behind. Without it the paper renders its
   * skeleton away as soon as the DAILY's batch resolves, leaving three empty
   * goal fields over goals that exist — and a character typed there is not
   * just lost when the note lands, it is written back over the stored goal
   * when the debounce fires (`pendingRef` survives the dropped draft).
   */
  it("keeps the fields out of reach until the goals note answers", async () => {
    let answer!: () => void;
    const readGate = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const { ds, updateNoteUnified } = makeDS(STORED, { readGate });
    renderScreen(ds);

    // Let the paper's OWN batch settle — its data is ready, the note is not.
    // Several flushes, not one: the daily batch is a Promise.allSettled over
    // six stubs, and one microtask turn is not enough to be sure it landed
    // (an under-flushed wait would pass with or without the gate).
    for (let i = 0; i < 8; i++) await act(async () => undefined);
    expect(
      screen.queryByPlaceholderText(
        "What will you get done this week? One line is enough…",
      ),
    ).toBeNull();

    answer();
    await waitFor(() => expect(weekField().value).toBe("Ship the block"));
    expect(updateNoteUnified).not.toHaveBeenCalled();
  });

  it("keeps all three goals when they are written one after another", async () => {
    const { ds, updateNoteUnified, read } = makeDS(null);
    renderScreen(ds);
    await waitFor(() => expect(weekField()).toBeTruthy());

    typeGoal("week", "Week goal");
    typeGoal("month", "Month goal");
    typeGoal("year", "Year goal");

    // Serialized: the note is created once and each later save re-reads the
    // freshest body, so no write can drop the section written before it.
    await waitFor(() => expect(updateNoteUnified).toHaveBeenCalledTimes(2));
    expect(extractGoals(read())).toEqual({
      week: "Week goal",
      month: "Month goal",
      year: "Year goal",
    });
    await waitFor(() => expect(goalField("year").value).toBe("Year goal"));
    expect(weekField().value).toBe("Week goal");
    expect(goalField("month").value).toBe("Month goal");
  });

  it("gives the field to an external change that lands on our own save", async () => {
    // The response says the stored body is NOT what we wrote — someone else
    // (Notes side / another device) got there first. External wins: the draft
    // goes and the field shows what is actually stored.
    const { ds } = makeDS(STORED, {
      onUpdate: () =>
        JSON.stringify({
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "週目標" }],
            },
            { type: "paragraph", content: [{ type: "text", text: "Theirs" }] },
          ],
        }),
    });
    renderScreen(ds);
    await waitFor(() => expect(weekField().value).toBe("Ship the block"));

    typeGoal("week", "Mine");

    await waitFor(() => expect(weekField().value).toBe("Theirs"));
  });

  it("brings the note back from the trash instead of writing into it", async () => {
    const { ds, restoreNoteUnified, updateNoteUnified, read } = makeDS(STORED, {
      trashed: true,
    });
    renderScreen(ds);
    await waitFor(() => expect(weekField().value).toBe("Ship the block"));

    typeGoal("week", "Still mine");

    await waitFor(() => expect(updateNoteUnified).toHaveBeenCalledTimes(1));
    expect(restoreNoteUnified).toHaveBeenCalledWith("note-goals");
    // Restore FIRST — a write into a trashed note is invisible from Notes and
    // dies with the next "empty trash".
    expect(restoreNoteUnified.mock.invocationCallOrder[0]).toBeLessThan(
      updateNoteUnified.mock.invocationCallOrder[0] ?? 0,
    );
    expect(extractGoals(read()).week).toBe("Still mine");
  });
});
