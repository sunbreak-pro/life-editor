import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ItemCreateNoteDraft, ItemCreateSlot } from "@life-editor/shared";
import { useScheduleCreateFlow } from "../src/schedule/useScheduleCreateFlow";

/*
 * #889 — the creation panel's flow, now that it is a hook.
 *
 * None of this was reachable from a test while it lived in CalendarTab: that
 * screen needs the whole Provider chain plus real layout to render
 * (rules/frontend.md §テスト環境の制約, D-20260812-refactor-2), so every
 * decision made in here — which day a submit lands on, whether the calendar
 * lens is cleared, whether the note waits for the real id — was invisible to
 * every gate we can afford to run.
 *
 * As a hook whose dependencies are all plain functions it renders under
 * `renderHook` with no Provider, no i18n mock and no `matchMedia` stub
 * (`isWide` is an argument). Zero DOM queries, zero coordinates.
 */

const PANEL = { date: "2026-08-20", start: "09:00", end: "10:00" };

const slot = (over: Partial<ItemCreateSlot> = {}): ItemCreateSlot =>
  ({
    date: "2026-08-20",
    start: "09:00",
    end: "10:00",
    isAllDay: false,
    ...over,
  }) as ItemCreateSlot;

const NOTE: ItemCreateNoteDraft = {
  kind: "new",
  title: "notes",
} as unknown as ItemCreateNoteDraft;

function setup(over?: {
  createPanel?: typeof PANEL | null;
  anchorDate?: string;
  isWide?: boolean;
}) {
  /** Lets a case settle the optimistic save by hand. */
  const captured: {
    onSaved?: (saved: { id: string } | null) => void;
  } = {};
  const handleCreate = vi.fn(
    (_slot: unknown, _title: string, onSaved?: (saved: never) => void) => {
      captured.onSaved = onSaved as never;
      return "evt-new";
    },
  );
  const spies = {
    setCreatePanel: vi.fn(),
    setPopover: vi.fn(),
    setSelectedId: vi.fn(),
    setOverlayOpen: vi.fn(),
    addNode: vi.fn(),
    updateNode: vi.fn(),
    attachNote: vi.fn(),
    onAttachError: vi.fn(),
    clearCalendarLens: vi.fn(),
  };
  const view = renderHook(() =>
    useScheduleCreateFlow({
      createPanel: over?.createPanel === undefined ? PANEL : over.createPanel,
      anchorDate: over?.anchorDate ?? "2026-08-20",
      isWide: over?.isWide ?? true,
      handleCreate: handleCreate as never,
      ...spies,
    }),
  );
  return { view, handleCreate, captured, ...spies };
}

const api = (h: ReturnType<typeof setup>) => h.view.result.current;

describe("useScheduleCreateFlow — opening the panel", () => {
  it("prefills an empty-slot click with the default duration", () => {
    const h = setup();
    act(() => api(h).handleGridCreateAt("2026-08-20", 570));
    expect(h.setCreatePanel).toHaveBeenCalledTimes(1);
    // 570 minutes = 09:30, + CREATE_DURATION_MIN (60) = 10:30. The constant
    // travelled with the handler, which is the half of the move that could
    // silently regress to a different default.
    expect(h.setCreatePanel).toHaveBeenCalledWith({
      date: "2026-08-20",
      start: "09:30",
      end: "10:30",
    });
  });

  it("seeds the toolbar press from the ANCHOR day", () => {
    const h = setup({ anchorDate: "2026-09-02" });
    act(() => api(h).handleToolbarAdd());
    expect(h.setCreatePanel).toHaveBeenCalledWith({
      date: "2026-09-02",
      start: "09:00",
      end: "10:00",
    });
  });

  it("seeds a month-cell press from that cell's day", () => {
    const h = setup();
    act(() => api(h).handleMonthCreate("2026-09-11"));
    expect(h.setCreatePanel).toHaveBeenCalledWith({
      date: "2026-09-11",
      start: "09:00",
      end: "10:00",
    });
  });

  it.each([
    ["toolbar", (h: ReturnType<typeof setup>) => api(h).handleToolbarAdd()],
    [
      "grid",
      (h: ReturnType<typeof setup>) =>
        api(h).handleGridCreateAt("2026-08-20", 540),
    ],
    [
      "month",
      (h: ReturnType<typeof setup>) => api(h).handleMonthCreate("2026-08-21"),
    ],
  ])(
    "dismisses an open bubble before the %s opener shows the panel",
    (_name, open) => {
      const h = setup();
      act(() => open(h));
      expect(h.setPopover).toHaveBeenCalledWith(null);
      expect(h.setPopover.mock.invocationCallOrder[0]).toBeLessThan(
        h.setCreatePanel.mock.invocationCallOrder[0],
      );
    },
  );
});

describe("useScheduleCreateFlow — a submit with the panel closed", () => {
  it("writes nothing at all", () => {
    const h = setup({ createPanel: null });
    act(() => {
      api(h).handleCreateSubmit("Dentist", slot(), null);
      api(h).handleCreateSubmitAndOpen("Dentist", slot(), null);
      api(h).handleCreateTodoSubmit("Report", slot(), null);
      api(h).handlePlaceTodoSubmit("task-7", slot(), null);
    });
    expect(h.handleCreate).not.toHaveBeenCalled();
    expect(h.addNode).not.toHaveBeenCalled();
    expect(h.updateNode).not.toHaveBeenCalled();
    expect(h.attachNote).not.toHaveBeenCalled();
    expect(h.setCreatePanel).not.toHaveBeenCalled();
  });
});

describe("useScheduleCreateFlow — the note waits for the row", () => {
  it("attaches against the SAVED id, not the optimistic one", () => {
    // wiki_tag_connections carries an FK to items_meta, and the id
    // handleCreate returns is optimistic — attaching against it would write a
    // link to a row that does not exist yet.
    const h = setup();
    act(() => api(h).handleCreateSubmit("Dentist", slot(), NOTE));
    expect(h.attachNote).not.toHaveBeenCalled();

    act(() => h.captured.onSaved?.({ id: "evt-saved" }));
    expect(h.attachNote).toHaveBeenCalledWith("evt-saved", NOTE);
  });

  it("reports a note that could not be attached", () => {
    const h = setup();
    act(() => api(h).handleCreateSubmit("Dentist", slot(), NOTE));
    act(() => h.captured.onSaved?.(null));
    expect(h.onAttachError).toHaveBeenCalledTimes(1);
    expect(h.attachNote).not.toHaveBeenCalled();
  });

  it("stays quiet when there was no note to lose", () => {
    const h = setup();
    act(() => api(h).handleCreateSubmit("Dentist", slot(), null));
    act(() => h.captured.onSaved?.(null));
    expect(h.onAttachError).not.toHaveBeenCalled();
  });
});

describe("useScheduleCreateFlow — every submit closes the panel and the lens", () => {
  it.each([
    [
      "create",
      (h: ReturnType<typeof setup>) =>
        api(h).handleCreateSubmit("Dentist", slot(), null),
    ],
    [
      "create-and-open",
      (h: ReturnType<typeof setup>) =>
        api(h).handleCreateSubmitAndOpen("Dentist", slot(), null),
    ],
    [
      "create todo",
      (h: ReturnType<typeof setup>) =>
        api(h).handleCreateTodoSubmit("Report", slot(), null),
    ],
    [
      "place todo",
      (h: ReturnType<typeof setup>) =>
        api(h).handlePlaceTodoSubmit("task-7", slot(), null),
    ],
  ])("%s", (_name, submit) => {
    // #468: a brand-new row carries no tag, so while a calendar lens is on it
    // is filtered out the instant it exists — the add button reads as broken.
    const h = setup();
    act(() => submit(h));
    expect(h.setCreatePanel).toHaveBeenCalledWith(null);
    expect(h.clearCalendarLens).toHaveBeenCalledTimes(1);
  });
});

describe("useScheduleCreateFlow — which layout selects what", () => {
  it("selects the new row on Desktop and opens nothing", () => {
    const h = setup({ isWide: true });
    act(() => api(h).handleCreateSubmit("Dentist", slot(), null));
    expect(h.setSelectedId).toHaveBeenCalledWith("evt-new");
    expect(h.setOverlayOpen).not.toHaveBeenCalled();
  });

  it("selects nothing on narrow, where selection IS the sheet", () => {
    // Selecting there would silently turn the plain create into the other
    // button.
    const h = setup({ isWide: false });
    act(() => api(h).handleCreateSubmit("Dentist", slot(), null));
    expect(h.setSelectedId).not.toHaveBeenCalled();
    expect(h.setOverlayOpen).not.toHaveBeenCalled();
  });

  it.each([
    ["Desktop", true],
    ["narrow", false],
  ])("create-and-open selects on %s", (_name, isWide) => {
    const h = setup({ isWide });
    act(() => api(h).handleCreateSubmitAndOpen("Dentist", slot(), null));
    expect(h.setSelectedId).toHaveBeenCalledWith("evt-new");
    // Only Desktop has an overlay to raise; narrow's sheet follows the
    // selection on its own.
    expect(h.setOverlayOpen).toHaveBeenCalledTimes(isWide ? 1 : 0);
  });
});

describe("useScheduleCreateFlow — the todo paths read the SLOT's day", () => {
  it("places a new todo on the day the panel's field says (#940)", () => {
    // The panel's own `date` is only the seed; what the user last typed into
    // the field is what the submit carries.
    const h = setup();
    act(() =>
      api(h).handleCreateTodoSubmit(
        "Report",
        slot({ date: "2026-08-25", start: "13:00", end: "14:00" }),
        null,
      ),
    );
    expect(h.addNode).toHaveBeenCalledTimes(1);
    const [type, parentId, title, options] = h.addNode.mock.calls[0] as [
      string,
      string | null,
      string,
      { scheduledAt: string; scheduledEndAt: string; isAllDay: boolean },
    ];
    expect([type, parentId, title]).toEqual(["task", null, "Report"]);
    // Compared by prefix rather than as a literal, so the case does not pin
    // the runner's timezone offset.
    expect(options.scheduledAt.startsWith("2026-08-25")).toBe(true);
    expect(options.scheduledEndAt.startsWith("2026-08-25")).toBe(true);
    expect(options.isAllDay).toBe(false);
  });

  it("makes an undoable placement only when no note rides along (#569)", () => {
    // A note attaches a separate link row this panel has no un-write for, so
    // an undo would move the todo back and leave the note on it — a half
    // reversal the toast claims was whole.
    const bare = setup();
    act(() => api(bare).handlePlaceTodoSubmit("task-7", slot(), null));
    expect(bare.updateNode.mock.calls[0][2]).toEqual({
      undoLabel: "todoChipPlace",
    });

    const withNote = setup();
    act(() => api(withNote).handlePlaceTodoSubmit("task-7", slot(), NOTE));
    expect(withNote.updateNode.mock.calls[0][2]).toBeUndefined();
  });

  it("attaches a placed todo's note without waiting", () => {
    // Unlike the create paths: this todo came out of a pool read from the DB,
    // so its items_meta row is already there and the link's FK is satisfied.
    const h = setup();
    act(() => api(h).handlePlaceTodoSubmit("task-7", slot(), NOTE));
    expect(h.attachNote).toHaveBeenCalledWith("task-7", NOTE);
    expect(h.attachNote.mock.invocationCallOrder[0]).toBeLessThan(
      h.setCreatePanel.mock.invocationCallOrder[0],
    );
  });
});
