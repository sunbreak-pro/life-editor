import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import {
  DailiesUnifiedProvider,
  WikiTagsUnifiedProvider,
  mergeEveningSection,
  type DataService,
  type DailyNode,
} from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { DailyView } from "../src/daily/DailyView";

/*
 * #2325 — the Daily screen while the open day's body is on its way.
 *
 * The list rows are light now (`bodyLoaded: false`, `content: ""`), and the
 * open day's body arrives by its own read. Until it lands, nothing on the
 * screen may write the day: an editor mounted over the light row's "" would
 * save that emptiness over the body, and a star tap merges its mood line
 * into the stored body, which is not here yet. So the card draws a skeleton
 * instead of the editor, and the stars do nothing.
 *
 * Same harness shape as dailyScreenActions.test.tsx: the REAL providers over
 * a fake DataService. No jest-dom in web/ — presence comes from getBy*
 * throwing, absence from queryBy* being null.
 */

/*
 * The global undo stack, reduced to the commands the screen pushes — the
 * same seam dailyView.test.tsx uses (`useUndoRedoOptional`). Running a
 * captured command's `undo` is exactly what the manager does on Ctrl+Z.
 */
const undoStack = vi.hoisted(() => ({
  commands: [] as Array<{ label: string; undo: () => Promise<void> }>,
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
      i18n: { language: "en" },
    }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
    useRightSidebarOptional: () => null,
    useUndoRedoOptional: () => ({
      push: (
        _domain: string,
        command: { label: string; undo: () => Promise<void> },
      ) => {
        undoStack.commands.push(command);
      },
    }),
  };
});

/* The editor, reduced to the content it was opened with. */
vi.mock("../src/notes/RichTextEditor", () => ({
  RichTextEditor: ({ initialContent }: { initialContent?: string }) => (
    <div data-testid="editor">{initialContent}</div>
  ),
}));

const WRITE_METHODS = [
  "upsertDailyByDateUnified",
  "updateDailyUnified",
  "softDeleteDailyUnified",
  "restoreDailyUnified",
  "permanentDeleteDailyUnified",
  "createItemLink",
  "deleteItemLink",
] as const;

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TODAY = isoDay(0);
const YESTERDAY = isoDay(-1);

const doc = (text: string) =>
  JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });

/** A row as the light list read returns it. */
function lightRow(date: string): DailyNode {
  return {
    id: `daily-${date}`,
    date,
    content: "",
    bodyLoaded: false,
    headContent: doc(`head of ${date}`),
    isPinned: false,
    isDeleted: false,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

function fullRow(date: string): DailyNode {
  const row: DailyNode = {
    ...lightRow(date),
    content: doc(`full body of ${date}`),
  };
  delete row.bodyLoaded;
  delete row.headContent;
  return row;
}

interface Harness {
  ds: DataService;
  fns: Record<string, Mock>;
  /** Lets the open day's body read answer. */
  releaseBody: () => Promise<void>;
}

function makeHarness(): Harness {
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  const fns: Record<string, Mock> = {
    listDailySummariesUnified: vi.fn(async () => [
      lightRow(TODAY),
      lightRow(YESTERDAY),
    ]),
    fetchDailyBodiesUnified: vi.fn(async () => ({})),
    getDailyByDateUnified: vi.fn(async (date: string) => {
      await held;
      return fullRow(date);
    }),
    listAllWikiTagsUnified: vi.fn(async () => []),
    listAllTagAssignments: vi.fn(async () => []),
    listAllTagConnections: vi.fn(async () => []),
    fetchScheduleItemsByDate: vi.fn(async () => []),
    fetchTodoTree: vi.fn(async () => []),
    fetchTimerSessions: vi.fn(async () => []),
    fetchGoals: vi.fn(async () => []),
    fetchGoalTodoLinks: vi.fn(async () => []),
  };
  for (const method of WRITE_METHODS) {
    fns[method] = vi.fn(async () => fullRow(TODAY));
  }
  return {
    ds: stubDataService(fns) as DataService,
    fns,
    releaseBody: async () => {
      await act(async () => {
        release();
      });
    },
  };
}

const { sync, wrapper: SyncWrapper } = createBumpableSync();

function renderDaily(harness: Harness) {
  render(
    <SyncWrapper>
      <WikiTagsUnifiedProvider dataService={harness.ds}>
        <DailiesUnifiedProvider dataService={harness.ds}>
          <DailyView dataService={harness.ds} />
        </DailiesUnifiedProvider>
      </WikiTagsUnifiedProvider>
    </SyncWrapper>,
  );
}

const star = (n: number) =>
  screen.getByRole("button", { name: `briefing.evening.moodStar|${n}` });

/** Clicks a day's row in the entry panel (found by its excerpt). */
function openEntry(excerpt: string) {
  const entry = screen
    .getAllByRole("button")
    .find((b) => b.textContent?.includes(excerpt));
  if (!entry) throw new Error(`no entry row reading "${excerpt}"`);
  fireEvent.click(entry);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  undoStack.commands.length = 0;
});

describe("DailyView — the open day's body is still loading (#2325)", () => {
  it("draws a skeleton instead of the editor until the body lands", async () => {
    const harness = makeHarness();
    renderDaily(harness);

    await screen.findByTestId("daily-body-pending");
    await waitFor(() =>
      expect(harness.fns.getDailyByDateUnified).toHaveBeenCalledWith(TODAY),
    );
    expect(screen.queryByTestId("editor")).toBeNull();

    await harness.releaseBody();
    const editor = await screen.findByTestId("editor");
    expect(screen.queryByTestId("daily-body-pending")).toBeNull();
    // The editor opened on the fetched body, not on the light row's "".
    expect(editor.textContent).toContain(`full body of ${TODAY}`);
  });

  it("writes nothing when a star is tapped before the body lands", async () => {
    const harness = makeHarness();
    renderDaily(harness);
    await screen.findByTestId("daily-body-pending");

    fireEvent.click(star(4));
    await act(async () => {});
    for (const method of WRITE_METHODS) {
      expect(harness.fns[method]).not.toHaveBeenCalled();
    }

    // Control: once the body is here, the same tap writes the open day.
    await harness.releaseBody();
    await screen.findByTestId("editor");
    fireEvent.click(star(4));
    await waitFor(() =>
      expect(harness.fns.upsertDailyByDateUnified).toHaveBeenCalledTimes(1),
    );
    const [date, body] = harness.fns.upsertDailyByDateUnified.mock.calls[0];
    expect(date).toBe(TODAY);
    // The mood line went into the FETCHED body, which is kept.
    expect(body).toContain(`full body of ${TODAY}`);
  });

  it("reads a light row's list excerpt off its head blocks", async () => {
    const harness = makeHarness();
    renderDaily(harness);

    // Yesterday is never opened, so its body is never fetched.
    await screen.findByText(`head of ${YESTERDAY}`);
    expect(harness.fns.getDailyByDateUnified).not.toHaveBeenCalledWith(
      YESTERDAY,
    );
  });

  it("undoes a star on a day gone light by reading its body first", async () => {
    const harness = makeHarness();
    renderDaily(harness);
    await harness.releaseBody();
    await screen.findByTestId("editor");

    // A star on the open day, with its body loaded: one undo entry.
    fireEvent.click(star(4));
    await waitFor(() =>
      expect(harness.fns.upsertDailyByDateUnified).toHaveBeenCalledTimes(1),
    );
    expect(undoStack.commands).toHaveLength(1);

    // Leave the day, then its save's echo moves its row: not open any more,
    // so the list read puts it back to light.
    openEntry(`head of ${YESTERDAY}`);
    await screen.findByText(`full body of ${YESTERDAY}`);
    harness.fns.listDailySummariesUnified.mockImplementation(async () => [
      { ...lightRow(TODAY), updatedAt: `${TODAY}T09:00:00.000Z` },
      lightRow(YESTERDAY),
    ]);
    act(() => sync.bump("dailies"));
    await screen.findByText(`head of ${TODAY}`);

    // The server's body has moved on since (edited elsewhere, mood 4 kept).
    const serverBody = mergeEveningSection(doc("edited elsewhere"), {
      mood: 4,
    });
    harness.fns.getDailyByDateUnified.mockImplementation(
      async (date: string) => ({ ...fullRow(date), content: serverBody }),
    );
    harness.fns.getDailyByDateUnified.mockClear();
    harness.fns.upsertDailyByDateUnified.mockClear();

    await act(async () => {
      await undoStack.commands[0].undo();
    });

    // The body is read first, and only the mood line changes on it.
    expect(harness.fns.getDailyByDateUnified).toHaveBeenCalledWith(TODAY);
    expect(harness.fns.upsertDailyByDateUnified.mock.calls).toEqual([
      [TODAY, mergeEveningSection(serverBody, { mood: null })],
    ]);

    // The written text is the day's whole body now (the excerpt reads it).
    // Back to today, which clears the session's stored selection.
    openEntry("edited elsewhere");
  });
});
