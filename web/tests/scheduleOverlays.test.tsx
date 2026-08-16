import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ScheduleItem, TodoCalendarChip } from "@life-editor/shared";
import { ScheduleOverlays } from "../src/schedule/ScheduleOverlays";
import type { ScheduleOverlaysProps } from "../src/schedule/ScheduleOverlays";

/*
 * #889 — every body-level overlay the Calendar mounts, in one component.
 *
 * The reason this file exists is a bug the extraction found: the two layout
 * returns each hand-listed their own overlays, and the DESKTOP list was missing
 * the <ConfirmDialog>. `useConfirmDialog().ask()` resolves only when that
 * dialog answers, so on Desktop every confirm hung forever — a dirty editor
 * could not be closed at all, a todo delete with children never ran, and the
 * Event↔Todo conversion stopped dead. Mobile had all three. Nothing failed
 * loudly; the promise simply never settled.
 *
 * So the first two cases below are the regression itself: the SAME set has to
 * be mounted at both widths. The rest pin the rules the group carries — the
 * bubble is Desktop-only, its two variants offer different actions, and the
 * creation surface picks a frame by width while the sheet keeps standing in
 * with the anchor day (it stays mounted while closed).
 *
 * `useTranslation` is stubbed to echo its key — these assertions are about
 * wiring, and an echo makes each query read as the key that produced it.
 *
 * No jest-dom in web/: presence comes from getBy* throwing, absence from
 * queryBy* being null (same convention as scheduleSidebar.test.tsx).
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

/*
 * The calendars modal renders <CalendarView>, which reads CalendarContext. It
 * is closed in every case here, so the body never mounts — but the module is
 * still imported, and stubbing keeps that import from dragging a Provider
 * requirement into a suite about mounting order.
 */
vi.mock("../src/schedule/CalendarView", () => ({
  CalendarView: () => <div data-testid="calendar-view" />,
}));

const ITEM: ScheduleItem = {
  id: "event-1",
  date: "2026-08-16",
  title: "打ち合わせ",
  startTime: "10:00",
  endTime: "11:00",
  completed: false,
  completedAt: null,
  routineId: null,
  templateId: null,
  memo: null,
  noteId: null,
  content: null,
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
};

const CHIP: TodoCalendarChip = {
  id: "task-1",
  date: "2026-08-16",
  title: "資料をまとめる",
  startTime: "13:00",
  endTime: "14:00",
  isAllDay: false,
  completed: false,
};

function renderOverlays(
  overrides: {
    isWide?: boolean;
    popover?: Partial<ScheduleOverlaysProps["popover"]>;
    create?: Partial<ScheduleOverlaysProps["create"]>;
    calendars?: Partial<ScheduleOverlaysProps["calendars"]>;
    scope?: Partial<ScheduleOverlaysProps["scope"]>;
    confirm?: Partial<ScheduleOverlaysProps["confirm"]>;
    frames?: Partial<ScheduleOverlaysProps["frames"]>;
  } = {},
) {
  const itemActions = {
    onRename: vi.fn(),
    onDuplicate: vi.fn(),
    onConvertToTodo: vi.fn(),
    onDelete: vi.fn(),
  };
  const todoActions = {
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onConvertToEvent: vi.fn(),
  };
  const onResolve = vi.fn();
  const props: ScheduleOverlaysProps = {
    isWide: overrides.isWide ?? true,
    frames: {
      editor: <div data-testid="editor-frame" />,
      todoDetail: <div data-testid="todo-detail-frame" />,
      ...overrides.frames,
    },
    popover: {
      state: null,
      selected: null,
      todoChip: null,
      onClose: vi.fn(),
      onOpenDetail: vi.fn(),
      itemActions,
      todoActions,
      ...overrides.popover,
    },
    create: {
      panel: null,
      anchorDate: "2026-08-20",
      onClose: vi.fn(),
      pools: { todos: [], notes: [] },
      handlers: {
        onSubmitEvent: vi.fn(),
        onSubmitEventAndOpen: vi.fn(),
        onCreateTodo: vi.fn(),
        onPlaceTodo: vi.fn(),
      },
      formatDuration: (m: number) => `${m}分`,
      labels: CREATE_LABELS,
      ...overrides.create,
    },
    calendars: { open: false, onClose: vi.fn(), ...overrides.calendars },
    scope: {
      request: null,
      onChoose: vi.fn(),
      onClose: vi.fn(),
      ...overrides.scope,
    },
    confirm: { request: null, onResolve, ...overrides.confirm },
  };
  const utils = render(<ScheduleOverlays {...props} />);
  return { ...utils, props, itemActions, todoActions, onResolve };
}

// Every field echoed as its own name — the panel's own suite covers what the
// words say; here they only have to exist so the panel can mount.
const CREATE_LABELS: ScheduleOverlaysProps["create"]["labels"] = {
  typeLabel: "typeLabel",
  typeEvent: "typeEvent",
  typeTodo: "typeTodo",
  typeNote: "typeNote",
  title: "title",
  eventPlaceholder: "eventPlaceholder",
  todoPlaceholder: "todoPlaceholder",
  date: "date",
  allDay: "allDay",
  startTime: "startTime",
  endTime: "endTime",
  addEvent: "addEvent",
  addEventAndOpen: "addEventAndOpen",
  addTodo: "addTodo",
  placeTodo: "placeTodo",
  sourceLabel: "sourceLabel",
  sourceNew: "sourceNew",
  sourceExisting: "sourceExisting",
  searchTodos: "searchTodos",
  todoPickerEmpty: "todoPickerEmpty",
  todoPickerNoMatch: "todoPickerNoMatch",
  noteTitleLabel: "noteTitleLabel",
  notePlaceholder: "notePlaceholder",
  searchNotes: "searchNotes",
  notePickerEmpty: "notePickerEmpty",
  notePickerNoMatch: "notePickerNoMatch",
  noteLinkHint: "noteLinkHint",
  attachedNote: "attachedNote",
  clearNote: "clearNote",
};

const CONFIRM_REQUEST = {
  message: "common.unsavedCloseConfirm",
  confirmLabel: "common.discard",
  cancelLabel: "common.cancel",
  danger: true,
};

describe("ScheduleOverlays — the confirm dialog is mounted at BOTH widths", () => {
  /*
   * The regression. Before #889 folded the two mount lists into one, this case
   * passed on narrow and failed on wide, and nothing else in the suite noticed:
   * the promise from ask() just never settled, so the calling code sat waiting
   * with no error and no dialog.
   */
  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("renders the pending question on %s", (_layout, isWide) => {
    renderOverlays({ isWide, confirm: { request: CONFIRM_REQUEST } });
    expect(screen.getByText("common.unsavedCloseConfirm")).toBeTruthy();
  });

  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("answers the question on %s", (_layout, isWide) => {
    const { onResolve } = renderOverlays({
      isWide,
      confirm: { request: CONFIRM_REQUEST },
    });
    fireEvent.click(screen.getByText("common.discard"));
    expect(onResolve).toHaveBeenCalledWith(true);

    onResolve.mockClear();
    fireEvent.click(screen.getByText("common.cancel"));
    expect(onResolve).toHaveBeenCalledWith(false);
  });

  it("holds no place in the tree while nothing is being asked", () => {
    renderOverlays({ confirm: { request: null } });
    expect(screen.queryByText("common.unsavedCloseConfirm")).toBeNull();
  });

  // The other members of the set: both layouts place the same element, so the
  // frames the host builds have to arrive on both.
  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("places both detail frames on %s", (_layout, isWide) => {
    renderOverlays({ isWide });
    expect(screen.getByTestId("editor-frame")).toBeTruthy();
    expect(screen.getByTestId("todo-detail-frame")).toBeTruthy();
  });
});

describe("ScheduleOverlays — the single-click bubble", () => {
  const POPOVER = { id: ITEM.id, x: 10, y: 20 };

  it("is Desktop-only (#299)", () => {
    renderOverlays({
      isWide: false,
      popover: { state: POPOVER, selected: ITEM },
    });
    expect(screen.queryByText(ITEM.title)).toBeNull();
  });

  it("offers the item action set and carries the popover's id", () => {
    const { itemActions } = renderOverlays({
      popover: { state: POPOVER, selected: ITEM },
    });
    expect(screen.getByText(ITEM.title)).toBeTruthy();

    fireEvent.click(screen.getByText("scheduleScreen.duplicate"));
    expect(itemActions.onDuplicate).toHaveBeenCalledWith(ITEM.id);

    fireEvent.click(screen.getByText("itemConvert.toTodo"));
    expect(itemActions.onConvertToTodo).toHaveBeenCalledWith(ITEM.id);

    fireEvent.click(screen.getByText("scheduleScreen.delete"));
    expect(itemActions.onDelete).toHaveBeenCalledWith(ITEM.id);
  });

  /*
   * The todo variant is deliberately a different set — a todo has no duplicate
   * write, and its convert goes the other way. Rendering the event actions for
   * a chip would offer a duplicate that writes nothing.
   */
  it("swaps to the todo action set when the bubble belongs to a chip (#564)", () => {
    const { todoActions, itemActions } = renderOverlays({
      popover: { state: { ...POPOVER, id: CHIP.id }, todoChip: CHIP },
    });
    expect(screen.getByText(CHIP.title)).toBeTruthy();
    expect(screen.queryByText("scheduleScreen.duplicate")).toBeNull();

    fireEvent.click(screen.getByText("itemConvert.toEvent"));
    expect(todoActions.onConvertToEvent).toHaveBeenCalledWith(CHIP.id);
    expect(itemActions.onConvertToTodo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("todoDetail.todoDelete"));
    expect(todoActions.onDelete).toHaveBeenCalledWith(CHIP.id);
  });

  /*
   * `selected` is the popover's item, set by the same gesture — but the two can
   * disagree for a frame. Drawing the bubble against a stale item would put one
   * row's title above another row's actions.
   */
  it("draws nothing while the selection and the anchor disagree", () => {
    renderOverlays({
      popover: { state: { ...POPOVER, id: "event-other" }, selected: ITEM },
    });
    expect(screen.queryByText(ITEM.title)).toBeNull();
  });
});

describe("ScheduleOverlays — the creation surface picks a frame by width", () => {
  const PANEL = { date: "2026-08-16", start: "09:00", end: "10:00" };

  it("seeds the panel from the opened slot on either layout", () => {
    const wide = renderOverlays({ isWide: true, create: { panel: PANEL } });
    expect(
      (
        wide.container.ownerDocument.querySelector(
          'input[type="date"]',
        ) as HTMLInputElement | null
      )?.value,
    ).toBe(PANEL.date);
    wide.unmount();

    renderOverlays({ isWide: false, create: { panel: PANEL } });
    expect(
      (document.querySelector('input[type="date"]') as HTMLInputElement | null)
        ?.value,
    ).toBe(PANEL.date);
  });

  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("mounts no creation panel on %s while it is closed", (_layout, isWide) => {
    renderOverlays({ isWide, create: { panel: null } });
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });
});

describe("ScheduleOverlays — the repeat scope dialog (#279)", () => {
  it.each([
    ["edit", "scheduleScreen.editScopeTitle"],
    ["delete", "scheduleScreen.deleteScopeTitle"],
  ] as const)("titles a %s request with its own words", (mode, key) => {
    renderOverlays({ scope: { request: { mode } } });
    expect(screen.getByText(key)).toBeTruthy();
  });

  it("stays closed with no request", () => {
    renderOverlays({ scope: { request: null } });
    expect(screen.queryByText("scheduleScreen.editScopeTitle")).toBeNull();
  });
});
