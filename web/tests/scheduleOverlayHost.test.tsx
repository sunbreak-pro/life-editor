import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { todoChipId } from "@life-editor/shared";
import type {
  EventEditorItem,
  ItemCreatePanelLabels,
  ScheduleItem,
  TodoCalendarChip,
} from "@life-editor/shared";
import { ScheduleOverlayHost } from "../src/schedule/ScheduleOverlayHost";
import type { ScheduleOverlayHostProps } from "../src/schedule/ScheduleOverlayHost";
import type { ScheduleEventEditorProps } from "../src/schedule/ScheduleEventEditor";

/*
 * #889 / #1000 — the Calendar's overlay layer, assembled once for both layouts.
 *
 * The host builds three things out of values it is handed, and all three are
 * the kind of wiring that survives a mutation with the whole suite green:
 *
 *   - what "closed" MEANS differs by layout. Desktop drops the overlay flag;
 *     narrow drops the SELECTION, because on narrow the selection IS the sheet
 *     (there is no flag to clear — nothing sets one). The two live in one
 *     ternary inside one `onClose`, so swapping them compiles, keeps Desktop
 *     working, and leaves narrow's every exit inert: the back arrow, Escape and
 *     the backdrop all stop closing the sheet while the flag they now clear was
 *     never true. Hence a case per exit per width, each requiring the OTHER
 *     callback to stay silent — that is what tells a swap from a dropped prop.
 *   - the same ternary decides whether the frame is OPEN, and it is not
 *     symmetric either: Desktop needs the flag AND an item, narrow the item
 *     alone. Give narrow Desktop's rule and a tapped row opens nothing; give
 *     Desktop narrow's and the overlay pops up on every single click.
 *   - `findTodoChip` is the only reason the lookup is drilled in at all (#564).
 *     Answer null and a todo chip's bubble stops being a todo chip's bubble:
 *     the branch falls through to `popover.selected`, which holds the last
 *     selected EVENT and can never carry a chip id. The case below runs that
 *     mutation through the injected lookup rather than describing it.
 *
 * #1000 also moved useEditorCloseGuard in here, so the flag has exactly one
 * writer (the host is typed out of passing `onDirtyChange`). The hook's own
 * asymmetry is pinned in useEditorCloseGuard.test.tsx; what only this file can
 * see is which exit got which variant — the close CLEARS the flag, the convert
 * keeps it (#998) — and those two are three lines apart in the same component.
 *
 * <ScheduleOverlays> is deliberately NOT stubbed: the chip lookup is only
 * observable through the action set the bubble draws. The two BODIES are
 * stubbed — they have their own suites (scheduleEventEditor / scheduleTodoDetail)
 * and both reach for contexts this host neither owns nor exercises. The editor
 * stub is a driver as well as a marker: it echoes the item it was given and
 * offers the two presses the host wires around it.
 *
 * `useTranslation` is stubbed to echo its key, so each query reads as the key
 * that produced it (same as scheduleOverlays.test.tsx).
 *
 * No jest-dom in web/: presence comes from getBy* throwing, absence from
 * queryBy* being null. Nothing here reads a coordinate — the bubble's position
 * is a value handed in, never one the page measured.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

/*
 * The calendars modal renders <CalendarView>, which reads CalendarContext. It
 * is closed in every case here, so the body never mounts — but the module is
 * still imported, and stubbing keeps that import from dragging a Provider
 * requirement into a suite about wiring.
 */
vi.mock("../src/schedule/CalendarView", () => ({
  CalendarView: () => <div data-testid="calendar-view" />,
}));

vi.mock("../src/schedule/ScheduleTodoDetail", () => ({
  ScheduleTodoDetail: ({
    todoId,
    isWide,
  }: {
    todoId: string | null;
    isWide: boolean;
  }) => (
    <div
      data-testid="todo-detail"
      data-todo-id={todoId ?? "none"}
      data-wide={String(isWide)}
    />
  ),
}));

/*
 * The pane, as a driver. `handlers.onDirtyChange` is the guard's only writer
 * (the host is typed out of supplying one), and `onConvertToTodo` is the entry
 * the host wraps in the keep-the-flag variant — so the two presses below stand
 * in for "the user typed something" and "the user pressed 予定→Todo".
 */
vi.mock("../src/schedule/ScheduleEventEditor", () => ({
  ScheduleEventEditor: ({
    item,
    handlers,
    onConvertToTodo,
    isWide,
    routineId,
    statusLabels,
    options,
    repeat,
  }: ScheduleEventEditorProps) => (
    <div>
      <span>{`pane:${item ? item.id : "none"}`}</span>
      {/*
       * Everything the host hands the pane, echoed. Five of these forwards
       * used to be invisible to this suite, so rewriting any of them left all
       * 845 tests green — and `isWide` is the sharpest, because it is what
       * decides whether the pane draws itself as a sheet body or an overlay
       * body (#995 hangs its sticky footer off exactly that).
       */}
      <span data-testid="pane-forwards">
        {JSON.stringify({ isWide, routineId, statusLabels, options, repeat })}
      </span>
      <button type="button" onClick={() => handlers.onDirtyChange?.(true)}>
        type-into-the-draft
      </button>
      <button type="button" onClick={() => item && onConvertToTodo(item.id)}>
        press-convert
      </button>
    </div>
  ),
}));

const EVENT_ID = "event-1";
const TODO_ID = "task-1";
/** What the grid carries for a todo chip: the prefixed synthetic id (#564). */
const CHIP_ID = todoChipId(TODO_ID);

const ITEM: EventEditorItem = {
  id: EVENT_ID,
  title: "打ち合わせ",
  date: "2026-08-20",
  startTime: "10:00",
  endTime: "11:00",
  isAllDay: false,
  completed: false,
  status: "notStarted",
  memo: "",
  isRoutine: false,
};

/**
 * The row behind `popover.selected`. Deliberately a DIFFERENT id from the chip
 * the bubble is anchored to: that is the real arrangement a chip press lands in
 * — `selected` still holds whatever event was picked last.
 */
const SELECTED_EVENT: ScheduleItem = {
  id: EVENT_ID,
  date: "2026-08-20",
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
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

const CHIP: TodoCalendarChip = {
  id: TODO_ID,
  date: "2026-08-20",
  title: "資料をまとめる",
  startTime: "13:00",
  endTime: "14:00",
  isAllDay: false,
  completed: false,
};

/*
 * Every field echoed as its own name. The creation surface is closed in every
 * case here (its frames render nothing while `panel` is null), so these only
 * have to exist for the panel to be constructible — what the words say is
 * pinned in scheduleOverlays.test.tsx.
 */
const CREATE_LABELS: ItemCreatePanelLabels = {
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

function renderHost(
  over: {
    isWide?: boolean;
    editor?: Partial<ScheduleOverlayHostProps["editor"]>;
    todoDetail?: Partial<ScheduleOverlayHostProps["todoDetail"]>;
    popover?: Partial<ScheduleOverlayHostProps["popover"]>;
    /** What the user answers the discard dialog. */
    answer?: boolean;
  } = {},
) {
  const onCloseOverlay = vi.fn();
  const onClearSelection = vi.fn();
  const onConvertToTodo = vi.fn();
  const askConfirm = vi.fn(() => Promise.resolve(over.answer ?? true));
  /** The real lookup's contract: a chip id finds a chip, anything else null. */
  const findTodoChip = vi.fn((chipId: string) =>
    chipId === CHIP_ID ? CHIP : null,
  );
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

  const props: ScheduleOverlayHostProps = {
    isWide: over.isWide ?? true,
    editor: {
      item: ITEM,
      overlayOpen: true,
      onCloseOverlay,
      onClearSelection,
      askConfirm,
      statusLabels: {
        notStarted: "Not started",
        inProgress: "In progress",
        done: "Done",
      },
      handlers: { onSave: vi.fn(), onToggleComplete: vi.fn() },
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
      onConvertToTodo,
      ...over.editor,
    },
    todoDetail: {
      todoId: null,
      todoNodes: [],
      onClose: vi.fn(),
      writes: {
        updateNode: vi.fn(),
        toggleStatus: vi.fn(),
        onDelete: vi.fn(),
      },
      onConvertToEvent: vi.fn(),
      onOpenTodos: vi.fn(),
      askConfirm,
      ...over.todoDetail,
    },
    popover: {
      state: null,
      selected: null,
      findTodoChip,
      onClose: vi.fn(),
      onOpenDetail: vi.fn(),
      itemActions,
      todoActions,
      ...over.popover,
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
    },
    calendars: { open: false, onClose: vi.fn() },
    scope: { request: null, onChoose: vi.fn(), onClose: vi.fn() },
    confirm: { request: null, onResolve: vi.fn() },
  };

  const utils = render(<ScheduleOverlayHost {...props} />);
  return {
    ...utils,
    onCloseOverlay,
    onClearSelection,
    onConvertToTodo,
    askConfirm,
    findTodoChip,
    itemActions,
    todoActions,
  };
}

/** The editor frame, or null. It is the only dialog this suite ever opens. */
const editorFrame = () => screen.queryByRole("dialog");

function frameOrThrow(): HTMLElement {
  const frame = editorFrame();
  if (!frame) throw new Error("editor frame is not open");
  return frame;
}

const pressEscape = () => fireEvent.keyDown(document, { key: "Escape" });

/*
 * The Desktop overlay's own dismissal. <Modal> puts the handler on the element
 * wrapping the panel, and the panel stops the press from reaching it — so the
 * backdrop has to be pressed as itself, exactly as bottomSheetDismiss.test.tsx
 * does it.
 */
function pressBackdrop() {
  const backdrop = frameOrThrow().parentElement;
  if (!backdrop) throw new Error("overlay backdrop missing");
  fireEvent.mouseDown(backdrop);
}

/*
 * The narrow sheet's own exit — the back arrow <BottomSheet> draws
 * unconditionally (#525). The sheet's backdrop is deliberately not pressed
 * here: `fullScreen` (#874) puts the panel over the whole scrim, so no press
 * can land on it, and a case that reached it in jsdom would be pinning a
 * gesture the phone cannot make.
 */
const pressSheetExit = () =>
  fireEvent.click(screen.getByRole("button", { name: "common.close" }));

/** The two printed members come first — `it.each` fills `%s` in order. */
type CloseCase = [
  layout: string,
  exit: string,
  isWide: boolean,
  press: () => void,
];

const CLOSE_EXITS: CloseCase[] = [
  ["Desktop", "Escape", true, pressEscape],
  ["Desktop", "the backdrop", true, pressBackdrop],
  ["Mobile", "Escape", false, pressEscape],
  ["Mobile", "the sheet's own exit", false, pressSheetExit],
];

describe("ScheduleOverlayHost — what 'closed' means differs by layout (#889)", () => {
  it.each(CLOSE_EXITS)(
    "%s: %s drops the overlay flag on Desktop / the selection on narrow — never both",
    async (_layout, _exit, isWide, press) => {
      const { onCloseOverlay, onClearSelection } = renderHost({ isWide });

      press();

      // The guard runs first even with a clean draft, so the effect lands a
      // microtask later — the surfaces cannot branch on a return value any more
      // (#707).
      const [ran, silent] = isWide
        ? [onCloseOverlay, onClearSelection]
        : [onClearSelection, onCloseOverlay];
      await waitFor(() => expect(ran).toHaveBeenCalledTimes(1));
      expect(silent).not.toHaveBeenCalled();
    },
  );
});

describe("ScheduleOverlayHost — whether the frame is open at all", () => {
  /*
   * The same ternary, read the other way. `overlayOpen` is Desktop's alone:
   * nothing sets it on narrow, so narrow reads the selection instead — and each
   * width applied to the other is a whole layout with no detail surface, or one
   * that opens uninvited on every click.
   */
  it.each([
    ["Desktop with the flag up and a row picked", true, true, ITEM, true],
    [
      "Desktop with a row picked but no flag (a single click)",
      true,
      false,
      ITEM,
      false,
    ],
    ["Desktop with the flag up and nothing picked", true, true, null, false],
    ["narrow with a row picked and no flag at all", false, false, ITEM, true],
    ["narrow with nothing picked", false, true, null, false],
  ] as const)("%s", (_name, isWide, overlayOpen, item, open) => {
    renderHost({ isWide, editor: { overlayOpen, item } });
    expect(editorFrame() !== null).toBe(open);
    // The pane holds the draft, so a frame that is shut must not be mounting
    // one behind it.
    expect(screen.queryByText(`pane:${ITEM.id}`) !== null).toBe(open);
  });

  it("names the frame and marks its kind once, as a glyph (#1044)", () => {
    renderHost();
    screen.getByRole("dialog", { name: "scheduleScreen.detailTitle" });
    // Always "event": a routine OCCURRENCE is still an `items_meta.role =
    // 'event'` row, and Schedule calls that kind 「予定」.
    screen.getByRole("img", { name: "scheduleScreen.originEvent" });
  });

  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("hands the todo detail its own width on %s", (_layout, isWide) => {
    renderHost({ isWide, todoDetail: { todoId: TODO_ID } });
    const detail = screen.getByTestId("todo-detail");
    expect(detail.getAttribute("data-wide")).toBe(String(isWide));
    expect(detail.getAttribute("data-todo-id")).toBe(TODO_ID);
  });
});

describe("ScheduleOverlayHost — the chip behind an open bubble (#564)", () => {
  const AT = { x: 12, y: 34 };

  it("resolves the bubble's own anchor through the injected lookup", () => {
    const { findTodoChip } = renderHost({
      popover: { state: { id: CHIP_ID, ...AT }, selected: SELECTED_EVENT },
    });
    expect(findTodoChip).toHaveBeenCalledWith(CHIP_ID);
  });

  /*
   * The action sets are DIFFERENT sets, not two renderings of one: a todo has
   * no duplicate write and its conversion goes the other way. `selected` is
   * holding an event throughout — that is the row the bubble falls back to —
   * so this is also the case that fails if the chip half stops being reached.
   */
  it("draws the todo action set for a chip, not the selected event's", () => {
    const { todoActions } = renderHost({
      popover: { state: { id: CHIP_ID, ...AT }, selected: SELECTED_EVENT },
    });
    expect(screen.getByText(CHIP.title)).toBeTruthy();
    expect(screen.queryByText("scheduleScreen.duplicate")).toBeNull();

    fireEvent.click(screen.getByText("itemConvert.toEvent"));
    expect(todoActions.onConvertToEvent).toHaveBeenCalledWith(TODO_ID);
  });

  it("lets an event id through to the selected row's set", () => {
    const { findTodoChip, itemActions } = renderHost({
      popover: { state: { id: EVENT_ID, ...AT }, selected: SELECTED_EVENT },
    });
    // Asked all the same — an event simply finds no chip.
    expect(findTodoChip).toHaveBeenCalledWith(EVENT_ID);
    fireEvent.click(screen.getByText("scheduleScreen.duplicate"));
    expect(itemActions.onDuplicate).toHaveBeenCalledWith(EVENT_ID);
  });

  /*
   * The mutation itself, run rather than described: a lookup that always
   * answers null is what a `todoChip: null` constant would leave behind. The
   * bubble then takes the event branch, which requires `selected.id` to equal
   * the anchor — a chip id never can — so the press on a chip produces no
   * bubble at all. Either way the todo's actions are gone, which is the part
   * the user loses.
   */
  it("leaves the bubble with nothing to draw when the lookup answers nothing", () => {
    renderHost({
      popover: {
        state: { id: CHIP_ID, ...AT },
        selected: SELECTED_EVENT,
        findTodoChip: () => null,
      },
    });
    expect(screen.queryByText(CHIP.title)).toBeNull();
    expect(screen.queryByText("itemConvert.toEvent")).toBeNull();
    expect(screen.queryByText("scheduleScreen.duplicate")).toBeNull();
  });

  it("asks nothing while no bubble is anchored", () => {
    const { findTodoChip } = renderHost({ popover: { state: null } });
    expect(findTodoChip).not.toHaveBeenCalled();
  });
});

/** The pane reporting a pending draft — the guard's only writer. */
const makeDirty = () =>
  fireEvent.click(screen.getByText("type-into-the-draft"));

describe("ScheduleOverlayHost — the unsaved-draft guard, wired here since #1000", () => {
  it("asks before an exit throws a draft away, then closes", async () => {
    const { askConfirm, onCloseOverlay } = renderHost();
    makeDirty();

    pressEscape();
    // Waits on close(), NOT on askConfirm. askConfirm is called synchronously
    // while close() and the flag reset are two microtasks behind it, so a
    // waitFor on the question resolves before the answer has been acted on.
    await waitFor(() => expect(onCloseOverlay).toHaveBeenCalledTimes(1));
    expect(askConfirm).toHaveBeenCalledTimes(1);
  });

  it("keeps the surface open when the answer is no", async () => {
    const { askConfirm, onCloseOverlay } = renderHost({ answer: false });
    makeDirty();

    pressEscape();
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(1));
    // Drain the promise chain before a NEGATIVE assertion: asserting straight
    // after the question would pass before the code that could break it ran.
    await act(async () => {});
    expect(onCloseOverlay).not.toHaveBeenCalled();
  });

  it("says nothing while there is no draft to lose", async () => {
    const { askConfirm, onCloseOverlay } = renderHost();
    pressEscape();
    await waitFor(() => expect(onCloseOverlay).toHaveBeenCalledTimes(1));
    expect(askConfirm).not.toHaveBeenCalled();
  });

  /*
   * #998: the convert entry runs the same question, and the host is what puts
   * it in front — the pane is handed the conversion UNGUARDED and asks for
   * nothing itself.
   */
  it("asks before converting the row out from under a draft, then converts", async () => {
    const { askConfirm, onConvertToTodo } = renderHost({
      isWide: false,
      editor: { overlayOpen: false },
    });
    makeDirty();

    fireEvent.click(screen.getByText("press-convert"));
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(1));
    expect(onConvertToTodo).toHaveBeenCalledWith(ITEM.id);
  });

  it("does not convert when the discard is refused", async () => {
    const { askConfirm, onConvertToTodo, onClearSelection } = renderHost({
      isWide: false,
      editor: { overlayOpen: false },
      answer: false,
    });
    makeDirty();

    fireEvent.click(screen.getByText("press-convert"));
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(1));
    expect(onConvertToTodo).not.toHaveBeenCalled();
    // And it is not a close either — the sheet stays where it is.
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  /*
   * The two exits take DIFFERENT variants of the same guard, three lines apart
   * in one component: the close clears the pending flag, the convert keeps it
   * (#998 — the conversion asks its own question next, and a refusal there
   * leaves the draft on screen). Wire the convert to `requestClose` instead and
   * this is the only case that notices: the flag would be gone, and the exit
   * after it would throw the draft away without a word.
   */
  it("leaves the guard armed after an agreed convert-discard (#998)", async () => {
    const { askConfirm, onConvertToTodo } = renderHost({
      isWide: false,
      editor: { overlayOpen: false },
    });
    makeDirty();

    fireEvent.click(screen.getByText("press-convert"));
    // The convert lands two microtasks after the question; pressing Escape
    // before it does would test a guard that has not finished answering yet.
    await waitFor(() => expect(onConvertToTodo).toHaveBeenCalledTimes(1));

    pressEscape();
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(2));
  });

  it("disarms it after an agreed close, which really did take the draft", async () => {
    const { askConfirm, onCloseOverlay } = renderHost();
    makeDirty();

    pressEscape();
    await waitFor(() => expect(onCloseOverlay).toHaveBeenCalledTimes(1));

    pressEscape();
    await waitFor(() => expect(onCloseOverlay).toHaveBeenCalledTimes(2));
    expect(askConfirm).toHaveBeenCalledTimes(1);
  });
});
/*
 * The rest of what the host hands <ScheduleEventEditor>. The two forwards the
 * suite already drives (item, and the pair the guard owns) had cases; these
 * five did not, so rewriting any of them — swapping `isWide`, dropping
 * `routineId`, handing over an empty `repeat` — left every test green.
 *
 * `isWide` is the one that earns its own case. It is what tells the pane to
 * draw itself as a bottom-sheet body rather than an overlay body, and #995's
 * sticky footer hangs off exactly that, so getting it backwards puts the
 * save/delete row out of reach on the phone and a `sticky bottom-0` on a
 * Desktop <Modal> that has no scroller to resolve it against.
 */
describe("ScheduleOverlayHost — what the pane is handed", () => {
  const forwards = () =>
    JSON.parse(screen.getByTestId("pane-forwards").textContent ?? "{}");

  it("tells the pane which layout it is drawing into", () => {
    renderHost({ isWide: true });
    expect(forwards().isWide).toBe(true);
  });

  it("says narrow when the host is narrow", () => {
    renderHost({ isWide: false, editor: { overlayOpen: false } });
    expect(forwards().isWide).toBe(false);
  });

  it("passes the routine link, the status words, the options and the repeat through untouched", () => {
    renderHost({ editor: { routineId: "routine-1" } });

    const got = forwards();
    expect(got.routineId).toBe("routine-1");
    // The occurrence's series is what tags are written against (#468), so a
    // dropped routineId silently re-points the tag surface at the occurrence.
    expect(got.statusLabels).toEqual({
      notStarted: "Not started",
      inProgress: "In progress",
      done: "Done",
    });
    expect(got.options).toEqual({ canEditDate: true, canEditAllDay: true });
    expect(got.repeat.value).toBeNull();
    expect(got.repeat.weekdayLabels).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(got.repeat.labels.frequency).toBe("frequency");
  });

  it("leaves routineId undefined for an occurrence that has no series", () => {
    renderHost();
    expect(forwards().routineId).toBeUndefined();
  });
});
