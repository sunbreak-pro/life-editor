import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  ToastProvider,
  todayDateKey,
  type DataService,
  type NoteNode,
  type SyncDomain,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * #955 — the paper's three write paths used to fail in total silence.
 *
 * Each caught its error into `console.error` and left the draft on screen, so
 * the text looked saved and only disappeared on the next reload. The contract
 * this suite pins is the pair: the user is TOLD, and the draft is STILL THERE
 * to copy or retype. A test that only checked the toast would pass on an
 * implementation that helpfully cleared the field.
 *
 * The failure is injected at the DataService, which is where a real one lives
 * (offline, RLS, a 500) — not by making the hook throw.
 *
 * Neither paper holds a 宣言 field any more (#2106 took the morning one and
 * the free-text goal fields, #2107 the evening one), so the plain-line cases
 * run on the one such field left: the evening paper's 明日の自分へ, which
 * writes the focus note. The goal fields' case went with them (goals are rows
 * now and toast on their own).
 */

const TODAY = todayDateKey();

const syncValue: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

const SAVE_FAILED = new Error("network down");

function makeDS(overrides: Partial<DataService> = {}): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    // #2107: the evening paper's own reads (issue number, goals).
    listDailiesUnified: vi.fn().mockResolvedValue([]),
    fetchGoals: vi.fn().mockResolvedValue([]),
    fetchGoalTodoLinks: vi.fn().mockResolvedValue([]),
    getNoteUnified: vi.fn().mockResolvedValue(null),
    ...overrides,
  });
}

function renderPaper(ds: DataService, tab: "morning" | "evening" = "evening") {
  return render(
    <ToastProvider>
      <SyncContext.Provider value={syncValue}>
        <BriefingScreen
          dataService={ds}
          onNavigate={vi.fn()}
          tab={tab}
          key={TODAY}
        />
      </SyncContext.Provider>
    </ToastProvider>,
  );
}

/** The evening paper's 明日の自分へ field (the focus note, #1048 / #2107). */
function focusField(): HTMLTextAreaElement {
  return screen.getByPlaceholderText(
    "The one thing to move forward tomorrow — one line…",
  ) as HTMLTextAreaElement;
}

/** Type into a plain-line field and blur, which flushes the debounce. */
function typeAndFlush(field: HTMLTextAreaElement, text: string) {
  fireEvent.change(field, { target: { value: text } });
  fireEvent.blur(field);
}

describe("Briefing save failures reach the user (#955)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The console line is part of the contract (it is the developer-facing
    // record) but it must not spam the run.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it("toasts when a 明日の自分へ save fails, and keeps the draft on screen", async () => {
    const ds = makeDS({
      createNoteUnified: vi.fn().mockRejectedValue(SAVE_FAILED),
    });
    renderPaper(ds);
    await waitFor(() => expect(focusField()).toBeTruthy());

    typeAndFlush(focusField(), "Ship the report");

    await waitFor(() =>
      expect(
        screen.getByText(/Could not save your note to tomorrow/),
      ).toBeTruthy(),
    );
    // The draft is the user's only remaining copy — clearing it would turn a
    // failed save into the data loss the toast is warning about.
    expect(focusField().value).toBe("Ship the report");
    expect(consoleError).toHaveBeenCalled();
  });

  it("toasts when a 夕刊 save fails", async () => {
    const ds = makeDS({
      upsertDailyByDateUnified: vi.fn().mockRejectedValue(SAVE_FAILED),
    });
    renderPaper(ds, "evening");
    // The mood row is the evening page's own write and needs no editor.
    const star = await waitFor(() => screen.getByLabelText("Mood 3/5"));

    fireEvent.click(star);

    await waitFor(() =>
      expect(screen.getByText(/Could not save the evening page/)).toBeTruthy(),
    );
  });

  it("says nothing when the save succeeds", async () => {
    const createNoteUnified = vi.fn((node: NoteNode) => Promise.resolve(node));
    const ds = makeDS({ createNoteUnified });
    renderPaper(ds);
    await waitFor(() => expect(focusField()).toBeTruthy());

    typeAndFlush(focusField(), "Ship the report");

    await waitFor(() => expect(createNoteUnified).toHaveBeenCalledTimes(1));
    // Let the save chain run past the write before asserting the silence.
    await act(async () => {
      await createNoteUnified.mock.results[0]?.value;
    });
    expect(focusField().value).toBe("Ship the report");
    expect(screen.queryByText(/Could not save/)).toBeNull();
  });

  it("still logs, and does not crash, with no ToastProvider mounted", async () => {
    // Every existing briefing suite renders without one. An error path that
    // throws because the Provider is missing would be worse than the silence
    // it replaced.
    const ds = makeDS({
      createNoteUnified: vi.fn().mockRejectedValue(SAVE_FAILED),
    });
    render(
      <SyncContext.Provider value={syncValue}>
        <BriefingScreen
          dataService={ds}
          onNavigate={vi.fn()}
          tab="evening"
          key={TODAY}
        />
      </SyncContext.Provider>,
    );
    await waitFor(() => expect(focusField()).toBeTruthy());

    typeAndFlush(focusField(), "Ship the report");

    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(focusField().value).toBe("Ship the report");
    expect(screen.queryByText(/Could not save/)).toBeNull();
  });
});
