import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  MANUAL_SESSION_LABEL,
  type EventEditorItem,
  type TimerSession,
} from "@life-editor/shared";
import en from "../../shared/src/i18n/locales/en.json";
import ja from "../../shared/src/i18n/locales/ja.json";
import { ScheduleEventEditor } from "../src/schedule/ScheduleEventEditor";
import type { ScheduleEventEditorProps } from "../src/schedule/ScheduleEventEditor";
import { createBumpableSync } from "./helpers";

/*
 * #889 — the Calendar's event editor, pulled out of CalendarTab where it was
 * the `editorPane` const feeding both detail frames.
 *
 * Four facts live in this wrapper and nowhere else. <EventEditorPane> has its
 * own suite for what the fields do; what is only decidable HERE is:
 *
 *   - it renders NOTHING without an item. The host reads "is the frame open?"
 *     off the same `editorItem`, so a wrapper that returned an empty shell
 *     instead of null would put a frame on screen with nothing in it — and
 *     would mount the tag slot against a stale id on the way (#889 lifted
 *     `!!editorPane` to `!!editorItem` at the call site for exactly this).
 *   - the Event→Todo entry is on BOTH widths (#1405; #998 had it narrow only,
 *     leaving Desktop to the single-click bubble of #625). The Todo panel has
 *     carried its own "to Event" all along, so the Event panel offering nothing
 *     on Desktop read as a one-way street. The wrapper is the only place the
 *     width could silently gate it again.
 *   - the save footer is pinned on BOTH widths (#995 narrow, #1728 Desktop).
 *     A width gate here is what put Save at y=957 on a 900px-tall window once
 *     a Weekdays repeat unfolded its pills, so the absence of one is the fact
 *     worth holding.
 *   - tagging a routine occurrence writes against the SERIES, not the row
 *     (#468). The occurrence rows are regenerated, so a tag put on one of them
 *     disappears the next time the generator materialises the range — silently,
 *     with the lens then unable to find the event at all. Both the id AND the
 *     role have to follow, because the role must match `items_meta.role` of the
 *     row actually being written.
 *
 * `useTranslation` is stubbed to echo its key — these assertions are about
 * wiring, and an echo makes each query read as the key that produced it.
 * <TagPicker> and <TagColorControls> are stubbed because they talk to
 * WikiTagsUnifiedContext, which this component neither owns nor needs to
 * exercise; both echo the id and role they were pointed at, which is the whole
 * fact under test.
 *
 * #1375 adds a fifth: the logged-time field is fed here (the pane holds no copy
 * and no data access), so what a saved total becomes, and how the read's three
 * states reach the field, is only decidable in this file (#2407).
 *
 * No jest-dom in web/: presence comes from getBy* throwing, absence from
 * queryBy* being null (same convention as scheduleSidebar.test.tsx).
 */

const fetchSessionsByEventId = vi.fn(async (): Promise<TimerSession[]> => []);
const saveEventWorkTotal = vi.fn(async (): Promise<void> => undefined);
const pushUndo = vi.fn();
const showToast = vi.fn();

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({
    // Echo the key AND its interpolations — the logged-time row is the one
    // place where the NUMBERS the host computed are the fact under test.
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${Object.values(opts).join(",")}` : key,
  }),
  // The work-time read (#1375). Stubbed rather than left to the real factory,
  // which throws synchronously when the app has no Supabase config — the hook
  // would swallow that and every assertion below would pass for the wrong
  // reason.
  getDataService: () => ({ fetchSessionsByEventId, saveEventWorkTotal }),
  useUndoRedoOptional: () => ({ push: pushUndo }),
  useToastOptional: () => ({ showToast }),
}));

vi.mock("../src/wikitag/TagPicker", () => ({
  TagPicker: ({ itemId, itemRole }: { itemId: string; itemRole: string }) => (
    <span>{`picker:${itemRole}:${itemId}`}</span>
  ),
}));

vi.mock("../src/wikitag/TagColorControls", () => ({
  TagColorControls: ({
    itemId,
    onOpenTag,
  }: {
    itemId: string;
    onOpenTag?: (tagId: string) => void;
  }) => (
    <>
      <span>{`colors:${itemId}`}</span>
      {/* #2407: the link is drawn only when the host hands one down. */}
      {onOpenTag && (
        <button type="button" onClick={() => onOpenTag("tag-health")}>
          {`open-tag:${itemId}`}
        </button>
      )}
    </>
  ),
}));

const ITEM: EventEditorItem = {
  id: "event-1",
  title: "打ち合わせ",
  date: "2026-08-20",
  startTime: "10:00",
  endTime: "11:00",
  isAllDay: false,
  memo: "",
  isRoutine: false,
};

const { wrapper: SyncWrapper } = createBumpableSync();

/** A closed WORK session of `minutes` against ITEM. */
function workSession(id: number, minutes: number): TimerSession {
  return {
    id,
    todoId: null,
    eventId: ITEM.id,
    sessionType: "WORK",
    startedAt: new Date("2026-08-20T10:00:00.000Z"),
    completedAt: new Date("2026-08-20T10:30:00.000Z"),
    duration: minutes * 60,
    completed: true,
    label: null,
  };
}

function renderEditor(
  over: {
    item?: EventEditorItem | null;
    isWide?: boolean;
    routineId?: string | null;
    onConvertToTodo?: ScheduleEventEditorProps["onConvertToTodo"];
    noteAttach?: ScheduleEventEditorProps["noteAttach"];
    onCancel?: ScheduleEventEditorProps["onCancel"];
    onOpenTag?: ScheduleEventEditorProps["onOpenTag"];
  } = {},
) {
  const onConvertToTodo = over.onConvertToTodo ?? vi.fn();
  const props: ScheduleEventEditorProps = {
    item: over.item === undefined ? ITEM : over.item,
    isWide: over.isWide ?? true,
    routineId: over.routineId,
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
    onConvertToTodo,
    noteAttach: over.noteAttach,
    onCancel: over.onCancel,
    onOpenTag: over.onOpenTag,
  };
  const utils = render(<ScheduleEventEditor {...props} />, {
    wrapper: SyncWrapper,
  });
  return {
    ...utils,
    onConvertToTodo,
    props,
    // Typed narrower than RTL's own `rerender` so a case can hand back a
    // modified props bag (#1663 moves the panel to another occurrence).
    rerender: (next: ScheduleEventEditorProps) =>
      utils.rerender(<ScheduleEventEditor {...next} />),
  };
}

describe("ScheduleEventEditor — nothing selected", () => {
  it("renders no node at all, tag slot included", () => {
    const { container } = renderEditor({ item: null });
    expect(container.firstChild).toBeNull();
    // The slot resolves its target from the item, so mounting it here would
    // point the picker at whatever was selected last.
    expect(screen.queryByText(/^picker:/)).toBeNull();
    expect(screen.queryByText(/^colors:/)).toBeNull();
  });
});

describe("ScheduleEventEditor — the Event→Todo entry is on both widths (#998 / #1405)", () => {
  it("offers it on the narrow sheet", () => {
    renderEditor({ isWide: false });
    expect(screen.getByText("itemConvert.toTodo")).toBeTruthy();
  });

  it("offers it on Desktop too, inside the panel (#1405)", () => {
    renderEditor({ isWide: true });
    expect(screen.getByText("itemConvert.toTodo")).toBeTruthy();
  });

  it("hands Desktop's press the same id the narrow one gets", () => {
    const { onConvertToTodo } = renderEditor({ isWide: true });
    fireEvent.click(screen.getByText("itemConvert.toTodo"));
    expect(onConvertToTodo).toHaveBeenCalledWith(ITEM.id);
  });

  /*
   * The id and nothing else: the host owns both questions the press can raise
   * (the unsaved-draft discard and the routine refusal), which is also why the
   * entry is never disabled on a routine occurrence.
   */
  it("hands the conversion this item's id, once", () => {
    const { onConvertToTodo } = renderEditor({ isWide: false });
    fireEvent.click(screen.getByText("itemConvert.toTodo"));
    expect(onConvertToTodo).toHaveBeenCalledTimes(1);
    expect(onConvertToTodo).toHaveBeenCalledWith(ITEM.id);
  });
});

describe("ScheduleEventEditor — the save footer sticks on both widths (#1728)", () => {
  /*
   * Asserted on the class, the way the pane's own suite does it
   * (shared/tests/detailSaveFooterSticky.test.tsx): jsdom has no layout, so
   * nothing here can show the row is actually pinned.
   *
   * #995 pinned the sheet's footer and deliberately left Desktop in flow,
   * because the overlay's <Modal> had no scroller for `sticky` to resolve
   * against. #1728 gave it one (ResponsiveDetailFrame passes `fitViewport`),
   * and the width gate is what has to go with it: at 1440x900 a Weekdays
   * repeat grew the panel to 1179px and put Save at y=957, off screen.
   */
  const footer = () =>
    screen.getByText("scheduleScreen.save").parentElement as HTMLElement;

  it.each([true, false])("pins it at isWide=%s", (isWide) => {
    renderEditor({ isWide });
    expect(footer().className).toContain("sticky");
  });
});

/*
 * #2407 — the prototype's Cancel and 「タグの色を変える →」. Both are the host's
 * presses handed through; this file only sees that the copy and the handler
 * arrive at the pane and at the colour row.
 */
describe("ScheduleEventEditor — Cancel and the tag link (#2407)", () => {
  it("puts 「キャンセル」 just before Save and hands the press up", () => {
    const onCancel = vi.fn();
    renderEditor({ onCancel });
    const cancel = screen.getByRole("button", { name: "common.cancel" });
    expect(cancel.nextElementSibling).toBe(
      screen.getByRole("button", { name: "scheduleScreen.save" }),
    );
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("draws no Cancel when the host passes none", () => {
    renderEditor();
    expect(screen.queryByRole("button", { name: "common.cancel" })).toBeNull();
  });

  it("hands the colour row the tag link, against the row tags are written to", () => {
    const onOpenTag = vi.fn();
    renderEditor({ routineId: "routine-1", onOpenTag });
    fireEvent.click(screen.getByText("open-tag:routine-1"));
    expect(onOpenTag).toHaveBeenCalledWith("tag-health");
  });

  it("gives the colour row no link without onOpenTag", () => {
    renderEditor();
    expect(screen.queryByText(/^open-tag:/)).toBeNull();
  });
});

describe("ScheduleEventEditor — what the tag slot writes against (#468)", () => {
  it("tags a routine occurrence through its SERIES", () => {
    renderEditor({ routineId: "routine-1" });
    // Role follows the id: the row being written is a routine, whatever the
    // UI calls the thing on screen (#185 presents it as an Event).
    expect(screen.getByText("picker:routine:routine-1")).toBeTruthy();
    expect(screen.getByText("colors:routine-1")).toBeTruthy();
  });

  it("tags a manual item through its own row", () => {
    renderEditor({ routineId: null });
    expect(screen.getByText("picker:event:event-1")).toBeTruthy();
    expect(screen.getByText("colors:event-1")).toBeTruthy();
  });
});

/*
 * #1663 — the scope a tag on a REPEAT applies to.
 *
 * The series is still the default (#1632's reasoning is unchanged), but the
 * user can point the write at this one occurrence instead, and the colour
 * resolution prefers the occurrence's own tag over the series' — which is what
 * makes "この回のみ" mean anything.
 *
 * Both the id AND the role have to follow the choice: the role names
 * `items_meta.role` of the row actually written.
 */
describe("ScheduleEventEditor — the tag scope on a repeat (#1663)", () => {
  const chooseThisOne = () =>
    fireEvent.click(screen.getByText("scheduleScreen.tagScopeThis"));

  it("offers the choice only for a repeat", () => {
    renderEditor({ routineId: null });
    expect(screen.queryByText("scheduleScreen.tagScopeThis")).toBeNull();

    renderEditor({ routineId: "routine-1" });
    screen.getByText("scheduleScreen.tagScopeThis");
    screen.getByText("scheduleScreen.tagScopeAll");
  });

  it("points the write at this occurrence once it is chosen", () => {
    renderEditor({ routineId: "routine-1" });
    chooseThisOne();
    expect(screen.getByText("picker:event:event-1")).toBeTruthy();
    expect(screen.getByText("colors:event-1")).toBeTruthy();
  });

  it("starts on the series again when the panel moves to another row", () => {
    const { rerender, props } = renderEditor({ routineId: "routine-1" });
    chooseThisOne();
    expect(screen.getByText("picker:event:event-1")).toBeTruthy();

    rerender({ ...props, item: { ...ITEM, id: "event-2" } });
    // A scope chosen for one occurrence must not decide where the NEXT one's
    // tag lands.
    expect(screen.getByText("picker:routine:routine-1")).toBeTruthy();
  });
});

/*
 * The logged-time field (#1375, typed since #2407). The field holds the total,
 * so what can be wrong here is which number it is seeded with, that a read which
 * has not landed cannot be typed over, and what a save hands the DataService.
 */
describe("ScheduleEventEditor — logged work time (#1375 / #2407)", () => {
  const field = () =>
    screen.getByLabelText("scheduleScreen.workTime") as HTMLInputElement;
  const ready = () => waitFor(() => expect(field().disabled).toBe(false));
  const save = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "scheduleScreen.save" }),
    );

  beforeEach(() => {
    fetchSessionsByEventId.mockReset();
    fetchSessionsByEventId.mockResolvedValue([]);
    saveEventWorkTotal.mockReset();
    saveEventWorkTotal.mockResolvedValue(undefined);
    pushUndo.mockReset();
    showToast.mockReset();
  });

  it("is empty with the example when the timer never ran on this event", async () => {
    renderEditor();
    await ready();
    expect(field().value).toBe("");
    expect(field().placeholder).toBe("scheduleScreen.workTimePlaceholder");
  });

  it("is locked while the read is in flight", () => {
    fetchSessionsByEventId.mockReturnValue(new Promise(() => {}));
    renderEditor();
    expect(field().disabled).toBe(true);
    expect(field().placeholder).toBe("common.loading");
  });

  it("stays locked and says why when the read fails", async () => {
    fetchSessionsByEventId.mockRejectedValue(new Error("boom"));
    renderEditor();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "scheduleScreen.workTimeLoadFailed",
      ),
    );
    expect(field().disabled).toBe(true);
  });

  it("reads the log for THIS event's id", async () => {
    renderEditor();
    await waitFor(() =>
      expect(fetchSessionsByEventId).toHaveBeenCalledWith(ITEM.id),
    );
  });

  it("rounds the seconds a session stores to whole minutes", async () => {
    fetchSessionsByEventId.mockResolvedValue([workSession(1, 44.7)]);
    renderEditor();
    await ready();
    expect(field().value).toBe("45");
  });

  // Two sessions, summed — the number is derived from the log every time, which
  // is the whole reason no total is stored on the event itself.
  it("sums every session logged against the event", async () => {
    fetchSessionsByEventId.mockResolvedValue([
      workSession(1, 50),
      workSession(2, 40),
    ]);
    renderEditor();
    await ready();
    expect(field().value).toBe("90");
  });

  it("saves the total with the event's place, and reads the log back", async () => {
    fetchSessionsByEventId.mockResolvedValue([workSession(1, 30)]);
    renderEditor();
    await ready();
    fetchSessionsByEventId.mockClear();
    fireEvent.change(field(), { target: { value: "45" } });
    save();
    expect(saveEventWorkTotal).toHaveBeenCalledExactlyOnceWith({
      eventId: ITEM.id,
      anchor: { date: ITEM.date, startTime: "10:00", isAllDay: false },
      totalMinutes: 45,
    });
    // Settled in the same press, without waiting for the Realtime echo.
    expect(field().value).toBe("45");
    expect(
      (
        screen.getByRole("button", {
          name: "scheduleScreen.save",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await waitFor(() =>
      expect(fetchSessionsByEventId).toHaveBeenCalledWith(ITEM.id),
    );
  });

  it("saves an emptied field as null, which drops the hand-entered row", async () => {
    fetchSessionsByEventId.mockResolvedValue([
      workSession(1, 30),
      { ...workSession(2, 15), label: MANUAL_SESSION_LABEL },
    ]);
    renderEditor();
    await waitFor(() => expect(field().value).toBe("45"));
    fireEvent.change(field(), { target: { value: "" } });
    save();
    expect(saveEventWorkTotal.mock.calls[0]).toEqual([
      expect.objectContaining({ totalMinutes: null }),
    ]);
    // Back to what the timer measured.
    expect(field().value).toBe("30");
  });

  it("refuses less than the timer measured, naming the number, and writes nothing", async () => {
    fetchSessionsByEventId.mockResolvedValue([workSession(1, 30)]);
    renderEditor();
    await ready();
    fireEvent.change(field(), { target: { value: "29" } });
    expect(screen.getByRole("alert").textContent).toBe(
      "scheduleScreen.workTimeBelowTimer|30",
    );
    save();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(saveEventWorkTotal).not.toHaveBeenCalled();
  });

  it("hands the unsaved draft to the host's dirty guard", async () => {
    const onDirtyChange = vi.fn();
    const { props, rerender } = renderEditor();
    rerender({
      ...props,
      handlers: { ...props.handlers, onDirtyChange },
    });
    await ready();
    fireEvent.change(field(), { target: { value: "45" } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("pushes an undo entry that restores what was there", async () => {
    fetchSessionsByEventId.mockResolvedValue([workSession(1, 30)]);
    renderEditor();
    await ready();
    fireEvent.change(field(), { target: { value: "45" } });
    save();
    expect(pushUndo).toHaveBeenCalledTimes(1);
    const [domain, command] = pushUndo.mock.calls[0];
    expect(domain).toBe("scheduleItem");
    // The label is a key the undo toast looks up, and a missing entry prints the
    // raw key instead of failing.
    const enLabels = en.undoRedo.labels as Record<string, string | undefined>;
    const jaLabels = ja.undoRedo.labels as Record<string, string | undefined>;
    expect(enLabels[command.label]).toBeTruthy();
    expect(jaLabels[command.label]).toBeTruthy();

    saveEventWorkTotal.mockClear();
    await command.undo();
    // Nothing was hand-entered before, so undo removes the row outright.
    expect(saveEventWorkTotal).toHaveBeenLastCalledWith({
      eventId: ITEM.id,
      anchor: { date: ITEM.date, startTime: "10:00", isAllDay: false },
      totalMinutes: null,
    });
    await command.redo();
    expect(saveEventWorkTotal).toHaveBeenLastCalledWith(
      expect.objectContaining({ totalMinutes: 45 }),
    );
  });

  it("says so when the write fails, and puts the read's number back", async () => {
    fetchSessionsByEventId.mockResolvedValue([workSession(1, 30)]);
    saveEventWorkTotal.mockRejectedValue(new Error("boom"));
    renderEditor();
    await ready();
    fireEvent.change(field(), { target: { value: "45" } });
    save();
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        "danger",
        "scheduleScreen.workTimeSaveFailed",
      ),
    );
    await waitFor(() => expect(field().value).toBe("30"));
  });
});

describe("ScheduleEventEditor — 「ノートを添付」 on the tag row (#2219)", () => {
  it("links a picked note to this occurrence", () => {
    const onAttach = vi.fn();
    renderEditor({
      noteAttach: { notes: [{ id: "note-1", title: "Minutes" }], onAttach },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "scheduleScreen.attachNote" }),
    );
    fireEvent.click(
      screen.getByRole("radio", { name: "scheduleScreen.noteSourceExisting" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Minutes" }));
    fireEvent.click(
      screen.getByRole("button", { name: "scheduleScreen.noteAttachConfirm" }),
    );
    expect(onAttach).toHaveBeenCalledWith(ITEM.id, {
      kind: "existing",
      id: "note-1",
    });
  });
});

/*
 * #2479 — on a 390px sheet the picker shared its line with 「ノートを添付」,
 * so a one-tag picker was ~165px wide and its 「＋」 wrapped onto a line of
 * its own. Below the breakpoint the picker now takes the whole first line and
 * the attach button drops to the next one, at the right end. jsdom has no
 * layout, so this pins the structure; the positions are checked in a browser.
 */
describe("ScheduleEventEditor — the tag row on narrow (#2479)", () => {
  const classesOf = (el: Element | null) =>
    (el?.getAttribute("class") ?? "").split(" ");

  function renderRow() {
    const utils = renderEditor({
      isWide: false,
      noteAttach: { notes: [], onAttach: vi.fn() },
    });
    const row = utils.container.querySelector("[data-event-tag-row]");
    const picker = row?.querySelector("[data-event-tag-picker]") ?? null;
    const attach = row?.querySelector("[data-event-note-attach]") ?? null;
    return { row, picker, attach };
  }

  it("keeps the picker and 「ノートを添付」 in the one row", () => {
    const { row, picker, attach } = renderRow();
    expect(row).not.toBeNull();
    // The picker's own 「＋」 lives inside the picker's box.
    expect(picker?.textContent).toContain(`picker:`);
    expect(picker?.textContent).toContain(ITEM.id);
    expect(attach?.querySelector("button")?.textContent).toContain(
      "scheduleScreen.attachNote",
    );
  });

  it("wraps the row and gives the picker the whole first line, on narrow only", () => {
    const { row, picker } = renderRow();
    expect(classesOf(row)).toContain("max-md:flex-wrap");
    expect(classesOf(row)).not.toContain("flex-wrap");
    expect(classesOf(picker)).toContain("max-md:basis-full");
    expect(classesOf(picker)).not.toContain("basis-full");
  });

  it("sends 「ノートを添付」 to the right end of the next line", () => {
    const { attach } = renderRow();
    expect(classesOf(attach)).toContain("max-md:ml-auto");
    expect(classesOf(attach)).not.toContain("ml-auto");
  });
});
