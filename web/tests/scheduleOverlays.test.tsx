import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { ScheduleItem, TodoCalendarChip } from "@life-editor/shared";
import { ScheduleOverlays } from "../src/schedule/ScheduleOverlays";
import { SCHEDULE_ITEM_PANEL_WIDTH } from "../src/schedule/todoChipPanel";
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
  useTranslation: () => ({
    // #2397: interpolation values are appended as JSON, so the bubble's
    // day-and-time line can be read back part by part. No other call in the
    // overlays passes any.
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: "ja" },
  }),
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

/** A closed panel needs a prop bag; the panel itself is covered elsewhere. */
const TAG_FILTER_PANEL: ScheduleOverlaysProps["tagFilter"]["panel"] = {
  tags: [],
  selectedTagIds: [],
  onToggleTag: vi.fn(),
  onClear: vi.fn(),
  groups: [],
  onSaveGroup: vi.fn(),
  onApplyGroup: vi.fn(),
  onReleaseGroup: vi.fn(),
  onUpdateGroupTags: vi.fn(),
  onRenameGroup: vi.fn(),
  onDeleteGroup: vi.fn(),
  labels: {
    tagsLabel: "tags",
    noTags: "no tags",
    tagsLoading: "loading",
    clear: "clear",
    close: "close",
    groupsHeading: "groups",
    groupsEmpty: "no groups",
    saveCurrent: "save current",
    namePlaceholder: "name",
    save: "save",
    saveHint: "hint",
    editTagsSave: "apply",
    cancel: "apply",
    editTagsHint: "apply",
    renameGroup: "rename",
    groupEmpty: "empty",
  },
};

function renderOverlays(
  overrides: {
    isWide?: boolean;
    popover?: Partial<ScheduleOverlaysProps["popover"]>;
    repeatPanel?: Partial<ScheduleOverlaysProps["repeatPanel"]>;
    create?: Partial<ScheduleOverlaysProps["create"]>;
    tagFilter?: Partial<ScheduleOverlaysProps["tagFilter"]>;
    scope?: Partial<ScheduleOverlaysProps["scope"]>;
    confirm?: Partial<ScheduleOverlaysProps["confirm"]>;
    frames?: Partial<ScheduleOverlaysProps["frames"]>;
  } = {},
) {
  const itemActions = {
    onQuickEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onConvertToTodo: vi.fn(),
    onDelete: vi.fn(),
  };
  const repeatPanelActions = {
    onClose: vi.fn(),
    onShowNext: vi.fn(),
    onEditDetail: vi.fn(),
    onDelete: vi.fn(),
  };
  const todoActions = {
    onRename: vi.fn(),
    onRetime: vi.fn(),
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
    repeatPanel: {
      state: null,
      row: null,
      ...repeatPanelActions,
      ...overrides.repeatPanel,
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
    // #1173: the panel is pure presentation, so an empty prop bag is a valid
    // closed modal — nothing here reaches a Context the way <CalendarView> did.
    tagFilter: {
      open: false,
      onClose: vi.fn(),
      panel: TAG_FILTER_PANEL,
      ...overrides.tagFilter,
    },
    scope: {
      request: null,
      onChoose: vi.fn(),
      onClose: vi.fn(),
      ...overrides.scope,
    },
    confirm: { request: null, onResolve, ...overrides.confirm },
  };
  const utils = render(<ScheduleOverlays {...props} />);
  return {
    ...utils,
    props,
    itemActions,
    repeatPanelActions,
    todoActions,
    onResolve,
  };
}

// Every field echoed as its own name — the panel's own suite covers what the
// words say; here they only have to exist so the panel can mount.
const CREATE_LABELS: ScheduleOverlaysProps["create"]["labels"] = {
  typeLabel: "typeLabel",
  typeEvent: "typeEvent",
  typeTodo: "typeTodo",
  attachNote: "attachNote",
  noteSourceLabel: "noteSourceLabel",
  noteSourceNew: "noteSourceNew",
  noteSourceExisting: "noteSourceExisting",
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
  noteDismiss: "noteDismiss",
  noteNewConfirm: "noteNewConfirm",
  notePickerTitle: "notePickerTitle",
  notePickerClose: "notePickerClose",
  notePickerCount: (n: number) => `notePickerCount:${n}`,
  notePickerDone: "notePickerDone",
  noteLocked: "noteLocked",
  removeNote: (title: string) => `removeNote:${title}`,
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

  /*
   * #2005 (D-20260923-sched-4 = C): the tag choice is made at the press. An
   * event carrying tags gets two entries; one with none keeps the single
   * Duplicate, which duplicates without tags as before.
   */
  it("splits Duplicate into with / without tags when the event has tags", () => {
    const { itemActions } = renderOverlays({
      popover: { state: POPOVER, selected: ITEM, selectedTagCount: 2 },
    });
    expect(screen.queryByText("scheduleScreen.duplicate")).toBeNull();

    fireEvent.click(screen.getByText("scheduleScreen.bubbleDuplicateWithTags"));
    expect(itemActions.onDuplicate).toHaveBeenLastCalledWith(ITEM.id, {
      withTags: true,
    });

    fireEvent.click(
      screen.getByText("scheduleScreen.bubbleDuplicateWithoutTags"),
    );
    expect(itemActions.onDuplicate).toHaveBeenLastCalledWith(ITEM.id, {
      withTags: false,
    });
  });

  it("keeps the single Duplicate for an event without tags", () => {
    renderOverlays({
      popover: { state: POPOVER, selected: ITEM, selectedTagCount: 0 },
    });
    expect(screen.getByText("scheduleScreen.duplicate")).toBeTruthy();
    expect(
      screen.queryByText("scheduleScreen.bubbleDuplicateWithTags"),
    ).toBeNull();
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
   * #2222 — the bubble's summary is edited where it is printed. The "Rename"
   * and "Change the time" rows are gone; a double-click (or Enter on the
   * focused summary) turns the title and time into fields.
   *
   * The ROUTE matters as much as the fields (#1664): the save goes through the
   * host's update handler as ONE patch, so a repeat raises the scope dialog
   * once and the write lands on the undo history.
   */
  it("has no Rename or Change-the-time rows any more", () => {
    renderOverlays({ popover: { state: POPOVER, selected: ITEM } });
    expect(screen.queryByText("scheduleScreen.rename")).toBeNull();
    expect(screen.queryByText("scheduleScreen.editTime")).toBeNull();
  });

  it("opens the fields on a double-click and saves title and day as one patch on Enter", () => {
    const { itemActions, props } = renderOverlays({
      popover: { state: POPOVER, selected: ITEM },
    });
    fireEvent.doubleClick(screen.getByText(ITEM.title));

    const title = screen.getByLabelText("scheduleScreen.title");
    fireEvent.change(title, { target: { value: "定例" } });
    fireEvent.change(screen.getByLabelText("scheduleScreen.date"), {
      target: { value: "2026-08-17" },
    });
    fireEvent.keyDown(title, { key: "Enter" });

    expect(itemActions.onQuickEdit).toHaveBeenCalledTimes(1);
    expect(itemActions.onQuickEdit).toHaveBeenCalledWith(ITEM.id, {
      title: "定例",
      date: "2026-08-17",
    });
    expect(props.popover.onClose).toHaveBeenCalled();
  });

  // The time field keeps the span's length when its start moves, so the end
  // comes along — one patch with both halves.
  it("saves a new start from the save button", () => {
    const { itemActions } = renderOverlays({
      popover: { state: POPOVER, selected: ITEM },
    });
    fireEvent.doubleClick(screen.getByText(ITEM.title));
    const start = screen.getByLabelText("scheduleScreen.startTime");
    fireEvent.change(start, { target: { value: "10:30" } });
    fireEvent.blur(start);
    fireEvent.click(screen.getByText("scheduleScreen.save"));

    expect(itemActions.onQuickEdit).toHaveBeenCalledWith(ITEM.id, {
      startTime: "10:30",
      endTime: "11:30",
    });
  });

  it("backs out on Escape without writing", () => {
    const { itemActions, props } = renderOverlays({
      popover: { state: POPOVER, selected: ITEM },
    });
    fireEvent.doubleClick(screen.getByText(ITEM.title));
    const title = screen.getByLabelText("scheduleScreen.title");
    fireEvent.change(title, { target: { value: "捨てる" } });
    fireEvent.keyDown(title, { key: "Escape" });

    expect(screen.queryByLabelText("scheduleScreen.title")).toBeNull();
    expect(screen.getByText(ITEM.title)).toBeTruthy();
    expect(itemActions.onQuickEdit).not.toHaveBeenCalled();
    // Only the form closed — the bubble itself is still up.
    expect(props.popover.onClose).not.toHaveBeenCalled();
  });

  it("does not save on the Enter that confirms a Japanese conversion", () => {
    const { itemActions } = renderOverlays({
      popover: { state: POPOVER, selected: ITEM },
    });
    fireEvent.doubleClick(screen.getByText(ITEM.title));
    const title = screen.getByLabelText("scheduleScreen.title");
    fireEvent.change(title, { target: { value: "定例" } });
    fireEvent.keyDown(title, { key: "Enter", isComposing: true });
    fireEvent.keyDown(title, { key: "Enter", keyCode: 229 });

    expect(itemActions.onQuickEdit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("scheduleScreen.title")).toBeTruthy();
  });

  it("opens the same fields from the keyboard: Enter on the focused summary", () => {
    renderOverlays({ popover: { state: POPOVER, selected: ITEM } });
    const target = screen
      .getByText(ITEM.title)
      .closest("[data-item-quick-edit-target]") as HTMLElement;
    expect(target.tabIndex).toBe(0);
    fireEvent.keyDown(target, { key: "Enter" });
    expect(screen.getByLabelText("scheduleScreen.title")).toBeTruthy();
  });

  it("gives a repeat occurrence no date field", () => {
    renderOverlays({
      popover: {
        state: POPOVER,
        selected: { ...ITEM, routineId: "routine-1" },
      },
    });
    fireEvent.doubleClick(screen.getByText(ITEM.title));
    expect(screen.queryByLabelText("scheduleScreen.date")).toBeNull();
    expect(screen.getByLabelText("scheduleScreen.startTime")).toBeTruthy();
  });

  it("gives an all-day event no time fields", () => {
    renderOverlays({
      popover: { state: POPOVER, selected: { ...ITEM, isAllDay: true } },
    });
    fireEvent.doubleClick(screen.getByText(ITEM.title));
    expect(screen.queryByLabelText("scheduleScreen.startTime")).toBeNull();
    expect(screen.getByLabelText("scheduleScreen.date")).toBeTruthy();
  });

  it("opens no fields on a holiday", () => {
    const HOLIDAY = { ...ITEM, id: "holiday-2026-08-16", title: "山の日" };
    renderOverlays({
      popover: { state: { ...POPOVER, id: HOLIDAY.id }, selected: HOLIDAY },
    });
    fireEvent.doubleClick(screen.getByText(HOLIDAY.title));
    expect(screen.queryByLabelText("scheduleScreen.title")).toBeNull();
    expect(document.querySelector("[data-item-quick-edit-target]")).toBeNull();
  });

  it("lets a timed todo change its start only, keeping its length", () => {
    const { todoActions } = renderOverlays({
      popover: { state: { ...POPOVER, id: CHIP.id }, todoChip: CHIP },
    });
    expect(screen.queryByText("scheduleScreen.rename")).toBeNull();
    fireEvent.doubleClick(screen.getByText(CHIP.title));
    expect(screen.queryByLabelText("scheduleScreen.date")).toBeNull();
    expect(screen.queryByLabelText("scheduleScreen.endTime")).toBeNull();

    fireEvent.change(screen.getByLabelText("scheduleScreen.title"), {
      target: { value: "資料を仕上げる" },
    });
    fireEvent.change(screen.getByLabelText("scheduleScreen.startTime"), {
      target: { value: "15:00" },
    });
    fireEvent.click(screen.getByText("scheduleScreen.save"));

    expect(todoActions.onRename).toHaveBeenCalledWith(
      CHIP.id,
      "資料を仕上げる",
    );
    expect(todoActions.onRetime).toHaveBeenCalledWith(CHIP.id, {
      date: CHIP.date,
      start: "15:00",
      end: "16:00",
    });
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
  /*
   * #1625: both variants open as the two-column panel, at least twice the
   * popover's 248px default. Checked on each variant because they are two
   * separate <ItemActionPopover> call sites that could drift apart.
   */
  it("opens both variants two columns and at least twice as wide (#1625)", () => {
    expect(SCHEDULE_ITEM_PANEL_WIDTH).toBeGreaterThanOrEqual(248 * 2);

    const first = renderOverlays({
      popover: { state: POPOVER, selected: ITEM },
    });
    const eventPanel = screen.getByRole("dialog", {
      name: "scheduleScreen.itemActionsLabel",
    });
    expect(eventPanel.style.width).toBe(`${SCHEDULE_ITEM_PANEL_WIDTH}px`);
    expect(
      eventPanel.querySelector('[data-item-panel-column="actions"]'),
    ).not.toBeNull();
    first.unmount();

    renderOverlays({
      popover: { state: { ...POPOVER, id: CHIP.id }, todoChip: CHIP },
    });
    // #1834: the todo variant names itself after a todo.
    const todoPanel = screen.getByRole("dialog", {
      name: "scheduleScreen.todoActionsLabel",
    });
    expect(todoPanel.style.width).toBe(`${SCHEDULE_ITEM_PANEL_WIDTH}px`);
    expect(
      todoPanel.querySelector('[data-item-panel-column="summary"]'),
    ).not.toBeNull();
  });

  /*
   * #1834: the two variants are two <ItemActionPopover> call sites and they
   * shared one accessible name. A screen reader on a todo chip heard "Event
   * actions" over a panel holding "Convert to event" and "Delete todo".
   */
  it("names each variant after what it is holding (#1834)", () => {
    const first = renderOverlays({
      popover: { state: POPOVER, selected: ITEM },
    });
    expect(
      screen.getByRole("dialog", { name: "scheduleScreen.itemActionsLabel" }),
    ).toBeTruthy();
    first.unmount();

    renderOverlays({
      popover: { state: { ...POPOVER, id: CHIP.id }, todoChip: CHIP },
    });
    expect(
      screen.getByRole("dialog", { name: "scheduleScreen.todoActionsLabel" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("dialog", { name: "scheduleScreen.itemActionsLabel" }),
    ).toBeNull();
  });

  it("draws nothing while the selection and the anchor disagree", () => {
    renderOverlays({
      popover: { state: { ...POPOVER, id: "event-other" }, selected: ITEM },
    });
    expect(screen.queryByText(ITEM.title)).toBeNull();
  });
});

/*
 * #2397 — the event bubble's summary as the Claude Design proposal draws it:
 * the kind badge, the title, the day with its time, the tag chips and the
 * memo's first line. Rows with nothing in them are not drawn at all, so a bare
 * event's bubble closes up. The todo bubble only gains the badge.
 */
describe("ScheduleOverlays — the event bubble's summary (#2397)", () => {
  const POPOVER = { id: ITEM.id, x: 10, y: 20 };
  const TAGS = [
    { id: "t-work", name: "仕事", color: "#3366ff", icon: null },
    { id: "t-health", name: "健康", color: null, icon: "Heart" },
  ];

  const eventPanel = () =>
    screen.getByRole("dialog", { name: "scheduleScreen.itemActionsLabel" });

  /** The interpolation the day-and-time line was built from. */
  function whenParts(): Record<string, string> {
    const line = within(eventPanel()).getByText(
      /^scheduleScreen\.bubbleWhen /,
    );
    return JSON.parse(
      (line.textContent ?? "").slice("scheduleScreen.bubbleWhen ".length),
    ) as Record<string, string>;
  }

  it("leads with the event badge and names the day with the time", () => {
    renderOverlays({ popover: { state: POPOVER, selected: ITEM } });
    expect(within(eventPanel()).getByText("scheduleScreen.typeEvent")).toBeTruthy();
    expect(within(eventPanel()).getByText(ITEM.title)).toBeTruthy();
    // 2026-08-16 is a Sunday. The catalog arranges the parts (ja:
    // 「8月16日（日）・10:00–11:00」 — pinned in scheduleCopy.test.ts).
    expect(whenParts()).toEqual({
      month: "8",
      day: "16",
      monthName: "8月",
      weekday: "日",
      time: "10:00–11:00",
    });
  });

  it("says all-day in place of the time, still with the day", () => {
    renderOverlays({
      popover: { state: POPOVER, selected: { ...ITEM, isAllDay: true } },
    });
    expect(whenParts()).toMatchObject({
      month: "8",
      day: "16",
      time: "scheduleScreen.allDay",
    });
  });

  it("draws every tag as a chip, and the memo as one line", () => {
    renderOverlays({
      popover: {
        state: POPOVER,
        selected: { ...ITEM, memo: "\n  議事録を\n共有する  \n" },
        selectedTags: TAGS,
      },
    });
    const panel = eventPanel();
    const tagRow = panel.querySelector("[data-bubble-tags]") as HTMLElement;
    expect(within(tagRow).getByText("仕事")).toBeTruthy();
    expect(within(tagRow).getByText("健康")).toBeTruthy();
    expect(tagRow.className).toContain("flex-wrap");

    const memo = panel.querySelector("[data-bubble-memo]") as HTMLElement;
    expect(memo.textContent).toBe("議事録を 共有する");
    expect(memo.className).toContain("truncate");
  });

  it("closes up when the event has neither tags nor a memo", () => {
    renderOverlays({
      popover: { state: POPOVER, selected: ITEM, selectedTags: [] },
    });
    const panel = eventPanel();
    expect(panel.querySelector("[data-bubble-tags]")).toBeNull();
    expect(panel.querySelector("[data-bubble-memo]")).toBeNull();
    // Badge, title, day-and-time — and no empty row after them.
    const summary = within(panel).getByText(ITEM.title).parentElement!;
    expect(summary.children).toHaveLength(3);
  });

  it("draws no memo row for a memo of only spaces and line breaks", () => {
    renderOverlays({
      popover: { state: POPOVER, selected: { ...ITEM, memo: " \n\t \n" } },
    });
    expect(eventPanel().querySelector("[data-bubble-memo]")).toBeNull();
  });

  it("gives the todo bubble the Todo badge and nothing else new", () => {
    renderOverlays({
      popover: { state: { ...POPOVER, id: CHIP.id }, todoChip: CHIP },
    });
    const panel = screen.getByRole("dialog", {
      name: "scheduleScreen.todoActionsLabel",
    });
    expect(within(panel).getByText("scheduleScreen.typeTodo")).toBeTruthy();
    expect(within(panel).queryByText("scheduleScreen.typeEvent")).toBeNull();
    expect(within(panel).queryByText(/^scheduleScreen\.bubbleWhen/)).toBeNull();
  });
});

/*
 * #2564 — the bubble's frame as the Claude Design proposal draws it: a filled
 * kind capsule with no icon, an icon at the head of every action row, and
 * the hand-off to the detail as a full-width row under both columns.
 */
describe("ScheduleOverlays — the bubble's frame (#2564)", () => {
  const POPOVER = { id: ITEM.id, x: 10, y: 20 };

  function badge(panel: HTMLElement, kind: string): HTMLElement {
    const el = panel.querySelector(`[data-bubble-kind="${kind}"]`);
    expect(el).not.toBeNull();
    return el as HTMLElement;
  }

  /** Every action row in the panel, each with its leading icon or not. */
  function rowsWithIcons(panel: HTMLElement): Record<string, boolean> {
    return Object.fromEntries(
      within(panel)
        .getAllByRole("menuitem")
        .map((row) => [
          row.textContent ?? "",
          row.querySelector("svg") != null,
        ]),
    );
  }

  it("gives the event bubble a filled event badge with no icon", () => {
    renderOverlays({ popover: { state: POPOVER, selected: ITEM } });
    const panel = screen.getByRole("dialog", {
      name: "scheduleScreen.itemActionsLabel",
    });
    const el = badge(panel, "event");
    expect(el.textContent).toBe("scheduleScreen.typeEvent");
    expect(el.className).toContain("bg-lumen-chip-event-bg");
    expect(el.querySelector("svg")).toBeNull();
  });

  it("gives the todo bubble a filled todo badge with no icon", () => {
    renderOverlays({
      popover: { state: { ...POPOVER, id: CHIP.id }, todoChip: CHIP },
    });
    const panel = screen.getByRole("dialog", {
      name: "scheduleScreen.todoActionsLabel",
    });
    const el = badge(panel, "task");
    expect(el.textContent).toBe("scheduleScreen.typeTodo");
    expect(el.className).toContain("bg-lumen-chip-task-bg");
    expect(el.querySelector("svg")).toBeNull();
  });

  it("leads every event action with an icon, with the proposal's wording", () => {
    renderOverlays({
      popover: { state: POPOVER, selected: ITEM, selectedTagCount: 1 },
    });
    const panel = screen.getByRole("dialog", {
      name: "scheduleScreen.itemActionsLabel",
    });
    expect(rowsWithIcons(panel)).toEqual({
      "scheduleScreen.bubbleDuplicateWithTags": true,
      "scheduleScreen.bubbleDuplicateWithoutTags": true,
      "itemConvert.toTodo": true,
      "scheduleScreen.delete": true,
    });
  });

  it("leads the single Duplicate of a tagless event with an icon too", () => {
    renderOverlays({
      popover: { state: POPOVER, selected: ITEM, selectedTagCount: 0 },
    });
    const row = screen.getByRole("menuitem", {
      name: "scheduleScreen.duplicate",
    });
    expect(row.querySelector("svg")).not.toBeNull();
  });

  it("leads every todo action with an icon", () => {
    renderOverlays({
      popover: { state: { ...POPOVER, id: CHIP.id }, todoChip: CHIP },
    });
    const panel = screen.getByRole("dialog", {
      name: "scheduleScreen.todoActionsLabel",
    });
    expect(rowsWithIcons(panel)).toEqual({
      "itemConvert.toEvent": true,
      "todoDetail.todoDelete": true,
    });
  });

  it("leads the repeat row panel's actions with an icon", () => {
    renderOverlays({
      repeatPanel: {
        state: { id: "r-1", x: 10, y: 20 },
        row: { title: "Morning run", frequencyLabel: "Daily", nextLabel: "x" },
      },
    });
    const panel = screen.getByRole("dialog", {
      name: "scheduleScreen.repeatPanelLabel",
    });
    expect(rowsWithIcons(panel)).toEqual({
      "scheduleScreen.repeatShowNext": true,
      "scheduleScreen.delete": true,
    });
  });

  it("puts 詳細を編集 under both columns, outlined", () => {
    renderOverlays({ popover: { state: POPOVER, selected: ITEM } });
    const panel = screen.getByRole("dialog", {
      name: "scheduleScreen.itemActionsLabel",
    });
    const button = within(panel).getByRole("button", {
      name: "scheduleScreen.editDetail",
    });
    expect(button.closest("[data-item-panel-column]")).toBeNull();
    expect(button.closest("[data-item-panel-edit-detail]")).not.toBeNull();
    expect(button.className).not.toContain("bg-lumen-accent");
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

/*
 * #2396 — the create panel's note picker, per frame. Desktop sets it beside
 * the form and widens the overlay for it (a 20rem panel hung off a 512px
 * dialog runs off a narrow screen); Mobile raises a second sheet over the
 * full-screen create sheet. jsdom has no layout, so the widening is asserted
 * on the width class the Modal chose, and the stacking on DOM order.
 */
describe("ScheduleOverlays — the create panel's note picker (#2396)", () => {
  const PANEL = { date: "2026-08-16", start: "09:00", end: "10:00" };
  const POOLS = {
    todos: [],
    notes: [
      { id: "note-1", title: "議事録" },
      { id: "note-2", title: "給与の話", isLocked: true },
    ],
  };
  const openPicker = () => {
    fireEvent.click(screen.getByText("attachNote"));
    fireEvent.click(screen.getByText("noteSourceExisting"));
  };
  const createDialog = () =>
    screen.getByRole("dialog", { name: "scheduleScreen.addItem" });

  it("widens the Desktop overlay while the side picker is open", () => {
    renderOverlays({ isWide: true, create: { panel: PANEL, pools: POOLS } });
    expect(createDialog().className).toContain("max-w-lg");

    openPicker();
    const picker = screen.getByRole("region", { name: "notePickerTitle" });
    expect(picker.getAttribute("data-note-picker")).toBe("side");
    expect(createDialog().contains(picker)).toBe(true);
    expect(createDialog().className).toContain("max-w-[860px]");
    expect(createDialog().className).not.toContain("max-w-lg");

    fireEvent.click(screen.getByText("notePickerDone"));
    expect(createDialog().className).toContain("max-w-lg");
  });

  it("keeps Tab inside the Desktop overlay while the side picker is open", () => {
    renderOverlays({ isWide: true, create: { panel: PANEL, pools: POOLS } });
    openPicker();
    // The picker's 「できた」 is the last control of the dialog.
    const done = screen.getByText("notePickerDone");
    done.focus();
    fireEvent.keyDown(done, { key: "Tab" });
    const active = document.activeElement as HTMLElement;
    expect(active).not.toBe(done);
    expect(createDialog().contains(active)).toBe(true);
    // And back the other way, from the first control to 「できた」.
    fireEvent.keyDown(active, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(done);
    // Esc is still the picker's: the dialog stays.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "notePickerTitle" })).toBeNull();
    createDialog();
  });

  it("goes back to the narrow overlay when it closes with the picker open", () => {
    const view = renderOverlays({
      isWide: true,
      create: { panel: PANEL, pools: POOLS },
    });
    openPicker();
    view.rerender(
      <ScheduleOverlays
        {...view.props}
        create={{ ...view.props.create, panel: null }}
      />,
    );
    view.rerender(
      <ScheduleOverlays
        {...view.props}
        create={{ ...view.props.create, panel: PANEL }}
      />,
    );
    expect(createDialog().className).toContain("max-w-lg");
    expect(screen.queryByRole("region", { name: "notePickerTitle" })).toBeNull();
  });

  it("raises a second sheet over the Mobile create sheet", () => {
    renderOverlays({ isWide: false, create: { panel: PANEL, pools: POOLS } });
    openPicker();
    const dialogs = screen.getAllByRole("dialog");
    // The create sheet stays, and the picker sheet is portalled after it —
    // which is what puts it on top at the same z-index.
    expect(dialogs.map((d) => d.getAttribute("aria-label"))).toEqual([
      "scheduleScreen.addItem",
      "notePickerTitle",
    ]);
    const picker = dialogs[1];
    // A locked note says so in the list.
    const locked = screen.getByRole("option", { name: /給与の話/ });
    expect(locked.textContent).toContain("noteLocked");

    fireEvent.click(screen.getByRole("option", { name: /議事録/ }));
    fireEvent.click(locked);
    expect(picker.textContent).toContain("notePickerCount:2");
    fireEvent.click(screen.getByText("notePickerDone"));

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    // Both picks are chips on the create sheet now.
    screen.getByLabelText("removeNote:議事録");
    screen.getByLabelText("removeNote:給与の話");
  });

  it("lets Esc close the Mobile picker sheet and leave the create sheet", () => {
    const view = renderOverlays({
      isWide: false,
      create: { panel: PANEL, pools: POOLS },
    });
    openPicker();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "notePickerTitle" }),
    ).toBeNull();
    createDialog();
    expect(view.props.create.onClose).not.toHaveBeenCalled();
  });

  it("starts the next opening with no notes staged", () => {
    const view = renderOverlays({
      isWide: false,
      create: { panel: PANEL, pools: POOLS },
    });
    openPicker();
    fireEvent.click(screen.getByRole("option", { name: /議事録/ }));
    fireEvent.click(screen.getByText("notePickerDone"));
    screen.getByLabelText("removeNote:議事録");

    view.rerender(
      <ScheduleOverlays
        {...view.props}
        create={{ ...view.props.create, panel: null }}
      />,
    );
    view.rerender(
      <ScheduleOverlays
        {...view.props}
        create={{ ...view.props.create, panel: PANEL }}
      />,
    );
    expect(screen.queryByLabelText("removeNote:議事録")).toBeNull();
    expect(screen.queryByText("attachedNote")).toBeNull();
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

/*
 * #1678 — the panel a repeat row opens.
 *
 * The row used to BE the jump to the next occurrence, which made the series
 * unreadable from the list: to see what it was you had to travel to a day it
 * fired on and find the occurrence there. The press opens the grid item's own
 * panel now, and the jump is one action inside it.
 */
describe("ScheduleOverlays — the repeat row's panel (#1678)", () => {
  const ROW = {
    title: "Morning run",
    frequencyLabel: "Daily",
    nextLabel: "July 28 (Tue)",
  };
  const STATE = { id: "r-1", x: 10, y: 20 };

  it("is Desktop-only, like the grid's bubble", () => {
    renderOverlays({
      isWide: false,
      repeatPanel: { state: STATE, row: ROW },
    });
    expect(screen.queryByText("Morning run")).toBeNull();
  });

  it("shows what the row shows, and hands the jump back", () => {
    const { repeatPanelActions } = renderOverlays({
      repeatPanel: { state: STATE, row: ROW },
    });
    expect(screen.getByText("Morning run")).toBeTruthy();
    expect(screen.getByText("Daily")).toBeTruthy();
    expect(screen.getByText("July 28 (Tue)")).toBeTruthy();

    fireEvent.click(screen.getByText("scheduleScreen.repeatShowNext"));
    expect(repeatPanelActions.onShowNext).toHaveBeenCalledWith("r-1");
  });

  it("opens the next occurrence's editor from the panel's primary action", () => {
    const { repeatPanelActions } = renderOverlays({
      repeatPanel: { state: STATE, row: ROW },
    });
    fireEvent.click(screen.getByText("scheduleScreen.editDetail"));
    expect(repeatPanelActions.onEditDetail).toHaveBeenCalledWith("r-1");
  });

  it("opens for a row with no occurrence, with only that action off", () => {
    renderOverlays({
      repeatPanel: { state: STATE, row: { ...ROW, nextLabel: null } },
    });
    // The panel is the place that can SAY there is no occurrence.
    expect(screen.getByText("scheduleScreen.repeatNeverFires")).toBeTruthy();
    expect(
      (
        screen
          .getByText("scheduleScreen.repeatShowNext")
          .closest("button") as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    // Nothing to open either, so the hand-off is not offered at all.
    expect(screen.queryByText("scheduleScreen.editDetail")).toBeNull();
  });

  it("offers the series delete only when the host supplies one", () => {
    const { repeatPanelActions } = renderOverlays({
      repeatPanel: { state: STATE, row: ROW },
    });
    fireEvent.click(screen.getByText("scheduleScreen.delete"));
    expect(repeatPanelActions.onDelete).toHaveBeenCalledWith("r-1");

    renderOverlays({
      repeatPanel: { state: STATE, row: ROW, onDelete: undefined },
    });
    // Two panels are mounted by now (one per render); the second has no
    // delete, so the count stays at the first one's single row.
    expect(screen.getAllByText("scheduleScreen.delete")).toHaveLength(1);
  });
});

/*
 * #2142 — on a phone the filter panel covers most of the screen, so the thin
 * backdrop strip was the only way out (there is no Esc key). The panel now has
 * a corner close button, and is held to the viewport with its body scrolling.
 */
describe("ScheduleOverlays — the tag filter panel's frame (#2142)", () => {
  it("closes from the corner close button", () => {
    const onClose = vi.fn();
    renderOverlays({ isWide: false, tagFilter: { open: true, onClose } });
    const dialog = screen.getByRole("dialog", {
      name: "scheduleScreen.filterTitle",
    });
    const close = screen.getByRole("button", { name: "common.close" });
    expect(dialog.contains(close)).toBe(true);
    // A 44px floor on narrow (#1512).
    expect(close.className).toContain("max-md:size-11");
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("holds the panel to the viewport", () => {
    renderOverlays({ tagFilter: { open: true } });
    const dialog = screen.getByRole("dialog", {
      name: "scheduleScreen.filterTitle",
    });
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]");
  });
});

/*
 * #2566 — the Desktop add dialog has the corner × the other Schedule panels
 * got in #2219, and it closes the dialog. The footer's キャンセル stays.
 */
describe("ScheduleOverlays — the add dialog's corner close (#2566)", () => {
  const PANEL = { date: "2026-08-20", start: "10:00", end: "11:00" };

  it("draws a × on Desktop that closes the dialog", () => {
    const { props } = renderOverlays({ create: { panel: PANEL } });
    const dialog = screen.getByRole("dialog", { name: "scheduleScreen.addItem" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common.close" }),
    );
    expect(props.create.onClose).toHaveBeenCalled();
  });
});
