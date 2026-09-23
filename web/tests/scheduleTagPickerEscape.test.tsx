import { describe, it, expect, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  ResponsiveDetailFrame,
  ToastProvider,
  WikiTagsUnifiedProvider,
  type DataService,
  type TodoNode,
} from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { TagPicker } from "../src/wikitag/TagPicker";
import {
  ScheduleTodoDetail,
  type ScheduleTodoDetailProps,
} from "../src/schedule/ScheduleTodoDetail";
import {
  ScheduleEventEditor,
  type ScheduleEventEditorProps,
} from "../src/schedule/ScheduleEventEditor";

/*
 * #1952 — which surface one Escape closes when the tag picker is open.
 *
 * The picker's Escape used to live on its search field. With the focus on a
 * candidate row it did nothing, and inside the Schedule detail modal it never
 * ran at all: the modal listens on `document` in the capture phase and closed
 * itself, picker and all.
 *
 * The Schedule suites stub <TagPicker> (it talks to WikiTagsUnifiedContext,
 * which those surfaces neither own nor exercise), so they could not see this.
 * Here the real picker is mounted inside the real frames, under the real
 * Provider, and only the editor and the work-time read are stubbed.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  // The event editor's work-time read (#1375). The real factory throws when
  // the app has no Supabase config.
  getDataService: () => ({ fetchSessionsByEventId: async () => [] }),
}));

vi.mock("../src/notes/LazyRichTextEditor", () => ({
  LazyRichTextEditor: () => <div data-testid="editor" />,
}));

const { wrapper: SyncWrapper } = createBumpableSync();

const TAG = { id: "tag-work", name: "Work", color: "#1e3a8a", icon: null };

function Providers({ children }: { children: React.ReactNode }) {
  const ds = stubDataService({
    listAllWikiTagsUnified: async () => [{ ...TAG }],
    listAllTagConnections: async () => [],
    listAllTagAssignments: async () => [],
  }) as DataService;
  return (
    <SyncWrapper>
      <ToastProvider>
        <WikiTagsUnifiedProvider dataService={ds}>
          {children}
        </WikiTagsUnifiedProvider>
      </ToastProvider>
    </SyncWrapper>
  );
}

const TODO: TodoNode = {
  id: "task-1",
  type: "task",
  title: "資料をまとめる",
  parentId: null,
  order: 0,
  status: "NOT_STARTED",
  createdAt: "2026-08-16T00:00:00.000Z",
};

function renderTodoDetail(onClose: () => void) {
  const props: ScheduleTodoDetailProps = {
    todoId: TODO.id,
    todoNodes: [TODO],
    isWide: true,
    onClose,
    writes: {
      updateNode: vi.fn(),
      toggleStatus: vi.fn(),
      setStatus: vi.fn(),
      onDelete: vi.fn(),
    },
    onConvertToEvent: vi.fn(),
    linking: {
      loadLinkTargets: vi.fn(),
      handleResolvedLinkInserted: vi.fn(),
      handleBodySaved: vi.fn(),
    } as unknown as ScheduleTodoDetailProps["linking"],
    onNavigateToItem: vi.fn(),
    askConfirm: vi.fn(async () => true),
  };
  render(
    <Providers>
      <ScheduleTodoDetail {...props} />
    </Providers>,
  );
}

function renderEventEditor(onClose: () => void) {
  const props: ScheduleEventEditorProps = {
    item: {
      id: "event-1",
      title: "打ち合わせ",
      date: "2026-08-20",
      startTime: "10:00",
      endTime: "11:00",
      isAllDay: false,
      memo: "",
      isRoutine: false,
    },
    isWide: true,
    handlers: { onSave: vi.fn() },
    options: { canEditDate: true, canEditAllDay: true },
    repeat: {
      value: null,
      weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      labels: {
        frequency: "frequency",
        frequencyDaily: "frequencyDaily",
        frequencyWeekdays: "frequencyWeekdays",
        frequencyInterval: "frequencyInterval",
        intervalEvery: "intervalEvery",
        intervalDays: "intervalDays",
        startDate: "startDate",
      },
      onChange: vi.fn(),
    },
    onConvertToTodo: vi.fn(),
  };
  // The pane has no frame of its own. ScheduleOverlayHost wraps it in this
  // one, which is the modal whose capture-phase Escape used to win.
  render(
    <Providers>
      <ResponsiveDetailFrame
        wide
        open
        title="event"
        closeLabel="close"
        onClose={onClose}
      >
        <ScheduleEventEditor {...props} />
      </ResponsiveDetailFrame>
    </Providers>,
  );
}

async function openPicker() {
  const trigger = await screen.findByRole("button", { name: "Add tag" });
  await act(async () => {
    fireEvent.click(trigger);
  });
  return { trigger, field: screen.getByPlaceholderText("Search or create tag…") };
}

const pickerDialog = () => screen.queryByRole("dialog", { name: "Tag picker" });

describe("TagPicker Escape (#1952)", () => {
  it("closes from a candidate row and hands the focus back", async () => {
    render(
      <Providers>
        <TagPicker itemId="event-1" />
      </Providers>,
    );
    const { trigger } = await openPicker();
    const candidate = (await screen.findByText("Work")).closest("button");
    if (!candidate) throw new Error("no candidate row");
    candidate.focus();

    fireEvent.keyDown(candidate, { key: "Escape" });

    await waitFor(() => expect(pickerDialog()).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it.each([
    ["ScheduleTodoDetail", renderTodoDetail],
    ["ScheduleEventEditor", renderEventEditor],
  ])(
    "in %s, the first Escape closes the picker and the second the modal",
    async (_name, renderHost) => {
      const onClose = vi.fn();
      renderHost(onClose);
      await openPicker();
      expect(pickerDialog()).not.toBeNull();

      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });

      await waitFor(() => expect(pickerDialog()).toBeNull());
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    },
  );
});
