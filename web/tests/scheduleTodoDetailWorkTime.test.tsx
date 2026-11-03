import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  MANUAL_SESSION_LABEL,
  type TimerSession,
  type TodoNode,
} from "@life-editor/shared";
import { ScheduleTodoDetail } from "../src/schedule/ScheduleTodoDetail";
import type { ScheduleTodoDetailProps } from "../src/schedule/ScheduleTodoDetail";

/*
 * #2553 — the todo detail takes the event editor's logged-time field and its
 * two columns.
 *
 * What only this host can get wrong: that it reads and writes the log against
 * the TODO (`task_id`, through the todo twins of the event calls), which day an
 * undated todo's row is filed under, and that the status is the two-choice row
 * on Desktop as well. The field's own rules are pinned in the panel's suite.
 *
 * `useTranslation` echoes keys; TagPicker / TagColorControls / the editor are
 * stubbed as in scheduleTodoDetail.test.tsx. No jest-dom in web/.
 */

const fetchSessionsByTodoId = vi.fn(async (): Promise<TimerSession[]> => []);
const saveTodoWorkTotal = vi.fn(async (): Promise<void> => undefined);
const fetchSessionsByEventId = vi.fn(async (): Promise<TimerSession[]> => []);
const pushUndo = vi.fn();
const showToast = vi.fn();

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "ja" } }),
  useGoalLinkSnapshot: () => ({ state: null, writeLinks: async () => {} }),
  // #2553: the logged-time read follows the `sessions` Sync domain; no
  // Provider here, and no write lands from this suite.
  useSyncDomains: () => 0,
  getDataService: () => ({
    fetchSessionsByTodoId,
    saveTodoWorkTotal,
    fetchSessionsByEventId,
  }),
  useUndoRedoOptional: () => ({ push: pushUndo }),
  useToastOptional: () => ({ showToast }),
  todayDateKey: () => "2026-11-03",
}));

vi.mock("../src/notes/LazyRichTextEditor", () => ({
  LazyRichTextEditor: () => <div data-testid="editor" />,
}));
vi.mock("../src/wikitag/TagPicker", () => ({
  TagPicker: ({ itemId }: { itemId: string }) => (
    <div data-testid="tag-picker">{itemId}</div>
  ),
}));
vi.mock("../src/wikitag/TagColorControls", () => ({
  TagColorControls: ({ itemId }: { itemId: string }) => (
    <span data-testid="tag-colors">{itemId}</span>
  ),
}));

const TODO: TodoNode = {
  id: "task-1",
  type: "task",
  title: "資料をまとめる",
  parentId: null,
  order: 0,
  status: "NOT_STARTED",
  createdAt: "2026-08-16T00:00:00.000Z",
};

function workSession(id: number, minutes: number): TimerSession {
  return {
    id,
    todoId: TODO.id,
    eventId: null,
    sessionType: "WORK",
    startedAt: new Date("2026-11-03T01:00:00.000Z"),
    completedAt: new Date("2026-11-03T01:30:00.000Z"),
    duration: minutes * 60,
    completed: true,
    label: null,
  };
}

function renderDetail(over: Partial<ScheduleTodoDetailProps> = {}) {
  const setStatus = vi.fn();
  const updateNode = vi.fn();
  const props: ScheduleTodoDetailProps = {
    todoId: TODO.id,
    todoNodes: [TODO],
    isWide: true,
    onClose: vi.fn(),
    writes: {
      updateNode,
      toggleStatus: vi.fn(),
      setStatus,
      onDelete: vi.fn(),
    },
    onConvertToEvent: vi.fn(),
    linking: {
      loadLinkTargets: vi.fn(),
      handleResolvedLinkInserted: vi.fn(),
      handleBodySaved: vi.fn(),
    } as unknown as ScheduleTodoDetailProps["linking"],
    askConfirm: vi.fn(() => Promise.resolve(true)),
    ...over,
  };
  render(<ScheduleTodoDetail {...props} />);
  return { setStatus, updateNode };
}

const field = () =>
  screen.getByLabelText("scheduleScreen.workTime") as HTMLInputElement;
const ready = () => waitFor(() => expect(field().disabled).toBe(false));
const saveButton = () =>
  screen.getByRole("button", { name: "todoDetail.save" }) as HTMLButtonElement;

beforeEach(() => {
  fetchSessionsByTodoId.mockReset();
  fetchSessionsByTodoId.mockResolvedValue([]);
  saveTodoWorkTotal.mockReset();
  saveTodoWorkTotal.mockResolvedValue(undefined);
  fetchSessionsByEventId.mockReset();
  pushUndo.mockReset();
  showToast.mockReset();
});

describe("ScheduleTodoDetail — logged work time (#2553)", () => {
  it("reads the log for THIS todo, never the event column", async () => {
    fetchSessionsByTodoId.mockResolvedValue([
      workSession(1, 30),
      workSession(2, 20),
    ]);
    renderDetail();
    await ready();
    expect(fetchSessionsByTodoId).toHaveBeenCalledWith(TODO.id);
    expect(fetchSessionsByEventId).not.toHaveBeenCalled();
    expect(field().value).toBe("50");
  });

  it("writes one total to the todo's row, anchored on its day and start", async () => {
    fetchSessionsByTodoId.mockResolvedValue([workSession(1, 30)]);
    renderDetail({
      todoNodes: [
        {
          ...TODO,
          scheduledAt: "2026-11-05T09:30:00",
          scheduledEndAt: "2026-11-05T10:30:00",
        },
      ],
    });
    await ready();
    fireEvent.change(field(), { target: { value: "45" } });
    fireEvent.click(saveButton());
    expect(saveTodoWorkTotal).toHaveBeenCalledExactlyOnceWith({
      todoId: TODO.id,
      anchor: { date: "2026-11-05", startTime: "09:30", isAllDay: false },
      totalMinutes: 45,
    });
    // One undo entry, the same label the event editor's write uses.
    expect(pushUndo).toHaveBeenCalledWith(
      "scheduleItem",
      expect.objectContaining({ label: "saveEventWorkTotal" }),
    );
  });

  it("files an undated todo's time under today", async () => {
    renderDetail();
    await ready();
    fireEvent.change(field(), { target: { value: "25" } });
    fireEvent.click(saveButton());
    expect(saveTodoWorkTotal).toHaveBeenCalledExactlyOnceWith({
      todoId: TODO.id,
      anchor: { date: "2026-11-03", startTime: "", isAllDay: true },
      totalMinutes: 25,
    });
  });

  it("drops the hand-entered row when the field is emptied", async () => {
    fetchSessionsByTodoId.mockResolvedValue([
      workSession(1, 30),
      { ...workSession(2, 15), label: MANUAL_SESSION_LABEL },
    ]);
    renderDetail();
    await waitFor(() => expect(field().value).toBe("45"));
    fireEvent.change(field(), { target: { value: "" } });
    fireEvent.click(saveButton());
    expect(saveTodoWorkTotal.mock.calls[0]).toEqual([
      expect.objectContaining({ totalMinutes: null }),
    ]);
  });

  it("says so when the write fails", async () => {
    saveTodoWorkTotal.mockRejectedValue(new Error("boom"));
    renderDetail();
    await ready();
    fireEvent.change(field(), { target: { value: "10" } });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        "danger",
        "scheduleScreen.workTimeSaveFailed",
      ),
    );
  });
});

describe("ScheduleTodoDetail — the event editor's layout (#2553)", () => {
  it("lays Desktop out in two columns, the sheet in one", () => {
    renderDetail({ isWide: true });
    expect(
      document.querySelector('[data-editor-column="identity"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-editor-column="attachments"]'),
    ).not.toBeNull();
  });

  it("keeps the sheet in one column", () => {
    renderDetail({ isWide: false });
    expect(document.querySelector("[data-editor-column]")).toBeNull();
  });

  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("offers the two-choice status on %s", (_name, isWide) => {
    const { setStatus } = renderDetail({ isWide });
    const group = screen.getByRole("group", {
      name: "materials.todos.statusGroupLabel",
    });
    expect(group).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "todoDetail.statusDone" }),
    );
    expect(setStatus).toHaveBeenCalledWith(TODO.id, "DONE");
  });

  it("puts 予定に変換 above the footer, under both columns", () => {
    renderDetail({ isWide: true });
    const convert = screen.getByRole("button", { name: "itemConvert.toEvent" });
    expect(convert.closest("[data-editor-column]")).toBeNull();
    expect(
      convert.compareDocumentPosition(saveButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
