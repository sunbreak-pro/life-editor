import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  act,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import {
  DailiesUnifiedProvider,
  WikiTagsUnifiedProvider,
  type DataService,
  type DailyNode,
} from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { DailyView } from "../src/daily/DailyView";

/*
 * #2289 — what was left after PR #2301. That fix taught the editor to know its
 * own older saves. These are the other ways the caret still left the Daily body
 * while it was being typed in (the keyboard closes with it on a phone):
 *
 *   - a read that reached the server BEFORE this editor's first save, and comes
 *     back after it. Its body is no emission of ours, so it read as an outside
 *     write. A list read in flight across a gap in the connection (#2329) is
 *     what opens the door: its stale stamp sends the hook back for the body.
 *   - the same read on a brand-new day, which has no row to bring back, so the
 *     optimistic row disappears and the stored body turns "".
 *   - an editor opened before the first list read has landed, over a day whose
 *     row then turns up light: the skeleton takes the editor away.
 *   - a real write from elsewhere (MCP, another device) while the caret is in.
 *
 * The REAL providers over a fake DataService, the same shape as
 * dailyBodyPending.test.tsx, and both layouts: the two branches of DailyView
 * mount the card separately, and the phone's is the one this issue is about.
 */

const editorStub = vi.hoisted(() => ({
  onUpdate: null as ((json: string) => void) | null,
  onDirty: null as (() => void) | null,
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
    useUndoRedoOptional: () => ({ push: () => {} }),
  };
});

/*
 * A focusable element that shows what it was opened with and, like the real
 * editor, ignores later changes to that prop.
 */
vi.mock("../src/notes/RichTextEditor", async () => {
  const { useState } = await import("react");
  return {
    RichTextEditor: ({
      initialContent,
      onUpdate,
      onDirty,
    }: {
      initialContent?: string;
      onUpdate: (json: string) => void;
      onDirty?: () => void;
    }) => {
      const [openedWith] = useState(initialContent);
      editorStub.onUpdate = onUpdate;
      editorStub.onDirty = onDirty ?? null;
      return (
        <div data-testid="editor" tabIndex={0}>
          {openedWith}
        </div>
      );
    },
  };
});

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const TODAY = isoDay(0);
const T0 = `${TODAY}T00:00:00.000Z`;
const T1 = `${TODAY}T01:00:00.000Z`;

const doc = (text: string) =>
  JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });

/** What a jsonb column hands back: the same document, keys reordered. */
const asStored = (json: string): string => {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v as Record<string, unknown>)
              .sort(([a], [b]) => a.length - b.length || (a < b ? -1 : 1))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v;
  return JSON.stringify(sort(JSON.parse(json)));
};

function lightRow(date: string, updatedAt = T0): DailyNode {
  return {
    id: `daily-${date}`,
    date,
    content: "",
    bodyLoaded: false,
    headContent: doc(`head of ${date}`),
    createdAt: T0,
    updatedAt,
  };
}
function fullRow(date: string, content: string, updatedAt = T0): DailyNode {
  return {
    id: `daily-${date}`,
    date,
    content,
    createdAt: T0,
    updatedAt,
  };
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const { sync, wrapper: SyncWrapper } = createBumpableSync();

function makeDS(fns: Record<string, Mock>): DataService {
  return stubDataService({
    fetchDailyBodiesUnified: vi.fn(async () => ({})),
    softDeleteDailyUnified: vi.fn(async () => {}),
    listAllWikiTagsUnified: vi.fn(async () => []),
    listAllTagAssignments: vi.fn(async () => []),
    listAllTagConnections: vi.fn(async () => []),
    fetchScheduleItemsByDate: vi.fn(async () => []),
    fetchTodoTree: vi.fn(async () => []),
    fetchTimerSessions: vi.fn(async () => []),
    fetchGoals: vi.fn(async () => []),
    fetchGoalTodoLinks: vi.fn(async () => []),
    ...fns,
  }) as DataService;
}

function renderDaily(ds: DataService) {
  render(
    <SyncWrapper>
      <WikiTagsUnifiedProvider dataService={ds}>
        <DailiesUnifiedProvider dataService={ds}>
          <DailyView dataService={ds} />
        </DailiesUnifiedProvider>
      </WikiTagsUnifiedProvider>
    </SyncWrapper>,
  );
}

/** Enough real time for the chained reads and the lazy editor to land. */
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

async function focusLoadedEditor(): Promise<HTMLElement> {
  await settle();
  const editor = await screen.findByTestId("editor");
  act(() => editor.focus());
  expect(document.activeElement).toBe(editor);
  return editor;
}

const emit = (json: string) =>
  act(() => {
    editorStub.onUpdate?.(json);
  });

const reread = async () => {
  await act(async () => sync.bump("dailies"));
  await settle();
};

function expectCaretKept(editor: HTMLElement) {
  expect(screen.queryByTestId("daily-body-pending")).toBeNull();
  expect(screen.getByTestId("editor")).toBe(editor);
  expect(document.activeElement).toBe(editor);
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

beforeEach(() => {
  localStorage.clear();
  editorStub.onUpdate = null;
  editorStub.onDirty = null;
});

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe.each([
  ["phone", false],
  ["desktop", true],
])("DailyView — the caret stays in the body (#2289), %s", (_name, wide) => {
  beforeEach(() => setWidth(wide));

  it("keeps it when a read from before the first save comes back", async () => {
    const save = deferred<DailyNode>();
    const get = vi.fn(async (d: string) => fullRow(d, doc("opened with")));
    renderDaily(
      makeDS({
        listDailySummariesUnified: vi.fn(async () => [lightRow(TODAY)]),
        getDailyByDateUnified: get,
        upsertDailyByDateUnified: vi.fn(() => save.promise),
      }),
    );
    const editor = await focusLoadedEditor();
    expect(get).toHaveBeenCalledTimes(1);

    // The save is out. The list read a gap in the connection started has the
    // old stamp, which sends the hook for the body; that read beats the save.
    emit(doc("typed"));
    await reread();
    expect(get).toHaveBeenCalledTimes(2);
    expectCaretKept(editor);

    // It is no outside write, so nothing swaps at the blur either: the text on
    // screen is the newest there is.
    act(() => editor.blur());
    await settle();
    expect(screen.getByTestId("editor")).toBe(editor);
  });

  it("keeps it when that read finds no row for a brand-new day", async () => {
    const save = deferred<DailyNode>();
    renderDaily(
      makeDS({
        listDailySummariesUnified: vi.fn(async () => [] as DailyNode[]),
        getDailyByDateUnified: vi.fn(async () => null),
        upsertDailyByDateUnified: vi.fn(() => save.promise),
      }),
    );
    const editor = await focusLoadedEditor();

    emit(doc("first words"));
    await reread();
    expectCaretKept(editor);

    // Typing on writes the day again rather than opening an empty editor.
    emit(doc("first words and more"));
    await settle();
    expectCaretKept(editor);
  });

  it("opens no editor before the first list read has landed", async () => {
    const list = deferred<DailyNode[]>();
    const upsert = vi.fn(async (d: string, c: string) => fullRow(d, c));
    renderDaily(
      makeDS({
        listDailySummariesUnified: vi.fn(() => list.promise),
        getDailyByDateUnified: vi.fn(async (d: string) =>
          fullRow(d, doc("stored body")),
        ),
        upsertDailyByDateUnified: upsert,
      }),
    );
    await settle();

    // Nothing to put a caret in, and nothing to type over a day not read yet.
    screen.getByTestId("daily-body-pending");
    expect(screen.queryByTestId("editor")).toBeNull();

    await act(async () => list.resolve([lightRow(TODAY)]));
    await settle();
    const editor = await screen.findByTestId("editor");
    expect(editor.textContent).toContain("stored body");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("still opens the editor when the first list read fails", async () => {
    const list = deferred<DailyNode[]>();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    renderDaily(
      makeDS({
        listDailySummariesUnified: vi.fn(() => list.promise),
        getDailyByDateUnified: vi.fn(async () => null),
        upsertDailyByDateUnified: vi.fn(),
      }),
    );
    await settle();
    screen.getByTestId("daily-body-pending");

    await act(async () => list.reject(new Error("offline")));
    await settle();
    await screen.findByTestId("editor");
    consoleError.mockRestore();
  });

  it("does not swap the editor for the same document in another key order", async () => {
    let stored = fullRow(TODAY, doc("opened with"));
    const get = vi.fn(async () => stored);
    renderDaily(
      makeDS({
        listDailySummariesUnified: vi.fn(async () => [
          lightRow(TODAY, stored.updatedAt),
        ]),
        getDailyByDateUnified: get,
        upsertDailyByDateUnified: vi.fn(),
      }),
    );
    await settle();
    const editor = await screen.findByTestId("editor");

    // A pin moved the row's stamp. Not focused: this one is no hold.
    stored = fullRow(TODAY, asStored(doc("opened with")), T1);
    await reread();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await settle();
    expect(screen.getByTestId("editor")).toBe(editor);
  });

  describe("a write from elsewhere", () => {
    function outsideWrite() {
      let stored = fullRow(TODAY, doc("opened with"));
      const upsert = vi.fn(async (d: string, c: string) =>
        fullRow(d, asStored(c), T1),
      );
      renderDaily(
        makeDS({
          listDailySummariesUnified: vi.fn(async () => [
            lightRow(TODAY, stored.updatedAt),
          ]),
          getDailyByDateUnified: vi.fn(async () => stored),
          upsertDailyByDateUnified: upsert,
        }),
      );
      return {
        upsert,
        arrives: async () => {
          stored = fullRow(TODAY, doc("from elsewhere"), T1);
          await reread();
        },
      };
    }

    it("waits for the caret to leave, then opens on it", async () => {
      const { arrives } = outsideWrite();
      const editor = await focusLoadedEditor();

      await arrives();
      expectCaretKept(editor);
      expect(editor.textContent).toContain("opened with");

      act(() => editor.blur());
      await settle();
      const reopened = screen.getByTestId("editor");
      expect(reopened).not.toBe(editor);
      expect(reopened.textContent).toContain("from elsewhere");
    });

    it("lands at once when the caret is not in the body", async () => {
      const { arrives } = outsideWrite();
      await settle();
      const editor = await screen.findByTestId("editor");

      await arrives();
      const reopened = screen.getByTestId("editor");
      expect(reopened).not.toBe(editor);
      expect(reopened.textContent).toContain("from elsewhere");
    });

    it("is written over by typing that goes on, with no swap at the blur", async () => {
      const { arrives, upsert } = outsideWrite();
      const editor = await focusLoadedEditor();

      await arrives();
      emit(doc("kept typing"));
      await settle();
      expectCaretKept(editor);
      expect(upsert).toHaveBeenCalledTimes(1);

      act(() => editor.blur());
      await settle();
      expect(screen.getByTestId("editor")).toBe(editor);
    });

    it("waits past the blur for typing not saved yet", async () => {
      const { arrives, upsert } = outsideWrite();
      const editor = await focusLoadedEditor();

      await arrives();
      // In the debounce window. Swapping now would flush this text over the
      // new body while showing the new body: screen and server would disagree.
      act(() => editorStub.onDirty?.());
      act(() => editor.blur());
      await settle();
      expect(screen.getByTestId("editor")).toBe(editor);

      emit(doc("flushed at the debounce"));
      await settle();
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("editor")).toBe(editor);
    });
  });

  it("clears the editor when the open day is deleted from the kebab", async () => {
    const stored = fullRow(TODAY, doc("about to go"));
    renderDaily(
      makeDS({
        listDailySummariesUnified: vi.fn(async () => [lightRow(TODAY)]),
        getDailyByDateUnified: vi.fn(async () => stored),
        upsertDailyByDateUnified: vi.fn(),
      }),
    );
    const editor = await focusLoadedEditor();

    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.moreActions" }),
    );
    fireEvent.click(
      within(screen.getByRole("menu")).getByText("materials.daily.delete"),
    );
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "materials.daily.deleteConfirmAction",
      }),
    );
    await settle();

    const reopened = screen.getByTestId("editor");
    expect(reopened).not.toBe(editor);
    expect(reopened.textContent).not.toContain("about to go");
  });
});
