import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  FrequencyEditorValue,
  ItemCreateMemoTarget,
  ItemCreateNoteDraft,
  ItemCreateSlot,
  ScheduleItem,
  TodoNode,
} from "@life-editor/shared";
import { useScheduleCreateFlow } from "../src/schedule/useScheduleCreateFlow";

/** A companion's reversal, as the note attach and the repeat both resolve. */
interface Reversal {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

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

/** #2396: the panel hands over every staged note — here a new one and a pick. */
const NOTES: readonly ItemCreateNoteDraft[] = [
  { kind: "new", title: "notes" },
  { kind: "existing", id: "note-picked" },
];

function setup(over?: {
  createPanel?: typeof PANEL | null;
  anchorDate?: string;
  isWide?: boolean;
}) {
  /** Lets a case settle the optimistic save by hand. */
  const captured: {
    onSaved?: (saved: { id: string } | null) => void;
    alongside?: (saved: { id: string }) => Promise<unknown>;
  } = {};
  const handleCreate = vi.fn(
    (
      _slot: unknown,
      _title: string,
      onSaved?: (saved: never) => void,
      alongside?: (saved: never) => Promise<unknown>,
    ) => {
      captured.onSaved = onSaved as never;
      captured.alongside = alongside as never;
      return "evt-new";
    },
  );
  const spies = {
    setCreatePanel: vi.fn(),
    setPopover: vi.fn(),
    setSelectedId: vi.fn(),
    setOverlayOpen: vi.fn(),
    // #2406: returns the optimistic node, whose id the "and open" twin reads.
    addNode: vi.fn<(...args: unknown[]) => TodoNode>(
      () => ({ id: "task-new" }) as TodoNode,
    ),
    updateNode: vi.fn(),
    attachNote: vi.fn(),
    attachNoteAlongside: vi.fn<
      (
        itemId: string,
        drafts: readonly ItemCreateNoteDraft[],
      ) => Promise<Reversal | null>
    >(() => Promise.resolve(null)),
    onAttachError: vi.fn(),
    clearTagLens: vi.fn(),
    openTodoDetail: vi.fn(),
    convertToRepeat: vi.fn<
      (
        saved: ScheduleItem,
        repeat: Partial<FrequencyEditorValue>,
      ) => Promise<
        Reversal | null
      >
    >(() => Promise.resolve(null)),
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
      api(h).handleCreateSubmit("Dentist", slot(), []);
      api(h).handleCreateSubmitAndOpen("Dentist", slot(), []);
      api(h).handleCreateTodoSubmit("Report", slot(), []);
      api(h).handlePlaceTodoSubmit("task-7", slot(), []);
      api(h).handleCreateTodoSubmitAndOpen("Report", slot(), []);
      api(h).handlePlaceTodoSubmitAndOpen("task-7", slot(), []);
    });
    expect(h.handleCreate).not.toHaveBeenCalled();
    expect(h.addNode).not.toHaveBeenCalled();
    expect(h.updateNode).not.toHaveBeenCalled();
    expect(h.attachNote).not.toHaveBeenCalled();
    expect(h.setCreatePanel).not.toHaveBeenCalled();
    // #2406: nothing was written, so there is no detail to open either.
    expect(h.openTodoDetail).not.toHaveBeenCalled();
  });
});

describe("useScheduleCreateFlow — the note waits for the row", () => {
  /*
   * #1642 P6 (N-08): the note rides in as the create's companion, which the
   * provider runs once the row exists and folds into the create's one undo.
   */
  it.each([
    ["create", "handleCreateSubmit"],
    ["create-and-open", "handleCreateSubmitAndOpen"],
  ] as const)(
    "%s attaches against the SAVED id, not the optimistic one",
    (_name, submit) => {
      // wiki_tag_connections carries an FK to items_meta, and the id
      // handleCreate returns is optimistic — attaching against it would write
      // a link to a row that does not exist yet.
      const h = setup();
      act(() => api(h)[submit]("Dentist", slot(), NOTES));
      expect(h.attachNoteAlongside).not.toHaveBeenCalled();

      act(() => void h.captured.alongside?.({ id: "evt-saved" }));
      expect(h.attachNoteAlongside).toHaveBeenCalledWith("evt-saved", NOTES);
      // Not as a command of its own: the create records both (N-08).
      expect(h.attachNote).not.toHaveBeenCalled();
    },
  );

  /*
   * N-07: a failed create is reported once, by the mutation layer ("couldn't
   * add this event"). This path used to say the NOTE could not be attached,
   * which named a write that never got the chance to run.
   */
  it("leaves a failed create to the create's own report", () => {
    const h = setup();
    act(() => api(h).handleCreateSubmit("Dentist", slot(), NOTES));
    act(() => h.captured.onSaved?.(null));
    expect(h.onAttachError).not.toHaveBeenCalled();
    expect(h.attachNoteAlongside).not.toHaveBeenCalled();
  });

  it("hands over no companion when there is no note", () => {
    const h = setup();
    act(() => api(h).handleCreateSubmit("Dentist", slot(), []));
    expect(h.captured.alongside).toBeUndefined();
    expect(h.onAttachError).not.toHaveBeenCalled();
  });

  /*
   * #2396: a note that will not attach must not take the event with it. The
   * companion settles either way — the create only rolls back on a throw
   * from its own write — and the note attach owns the one report.
   */
  it.each([
    ["every note failed", () => Promise.resolve(null)],
    ["the attach threw", () => Promise.reject(new Error("offline"))],
  ])("keeps the event when %s", async (_name, outcome) => {
    const h = setup();
    h.attachNoteAlongside.mockImplementationOnce(outcome);
    act(() => api(h).handleCreateSubmit("Dentist", slot(), NOTES));
    let companion: unknown = "unset";
    await act(async () => {
      companion = await h.captured.alongside?.({ id: "evt-saved" });
    });
    expect(companion).toBeNull();
    expect(h.attachNoteAlongside).toHaveBeenCalledWith("evt-saved", NOTES);
  });
});

describe("useScheduleCreateFlow — a new todo's notes (#2396)", () => {
  it("attaches every staged note once the todo's row exists", () => {
    const h = setup();
    act(() => api(h).handleCreateTodoSubmit("Report", slot(), NOTES));
    expect(h.attachNote).not.toHaveBeenCalled();
    const options = h.addNode.mock.calls[0][3] as {
      onSaved: (saved: { id: string } | null) => void;
    };
    act(() => options.onSaved({ id: "task-saved" }));
    expect(h.attachNote).toHaveBeenCalledWith("task-saved", NOTES);
    expect(h.onAttachError).not.toHaveBeenCalled();
  });

  it("reports once when the todo never landed and notes were staged", () => {
    const h = setup();
    act(() => api(h).handleCreateTodoSubmit("Report", slot(), NOTES));
    const options = h.addNode.mock.calls[0][3] as {
      onSaved: (saved: { id: string } | null) => void;
    };
    act(() => options.onSaved(null));
    expect(h.onAttachError).toHaveBeenCalledTimes(1);
    expect(h.attachNote).not.toHaveBeenCalled();
  });

  it("says nothing about notes when none were staged", () => {
    const h = setup();
    act(() => api(h).handleCreateTodoSubmit("Report", slot(), []));
    const options = h.addNode.mock.calls[0][3] as {
      onSaved: (saved: { id: string } | null) => void;
    };
    act(() => options.onSaved(null));
    expect(h.onAttachError).not.toHaveBeenCalled();
  });
});

describe("useScheduleCreateFlow — every submit closes the panel and the lens", () => {
  it.each([
    [
      "create",
      (h: ReturnType<typeof setup>) =>
        api(h).handleCreateSubmit("Dentist", slot(), []),
    ],
    [
      "create-and-open",
      (h: ReturnType<typeof setup>) =>
        api(h).handleCreateSubmitAndOpen("Dentist", slot(), []),
    ],
    [
      "create todo",
      (h: ReturnType<typeof setup>) =>
        api(h).handleCreateTodoSubmit("Report", slot(), []),
    ],
    [
      "place todo",
      (h: ReturnType<typeof setup>) =>
        api(h).handlePlaceTodoSubmit("task-7", slot(), []),
    ],
    [
      "create todo and open",
      (h: ReturnType<typeof setup>) =>
        api(h).handleCreateTodoSubmitAndOpen("Report", slot(), []),
    ],
    [
      "place todo and open",
      (h: ReturnType<typeof setup>) =>
        api(h).handlePlaceTodoSubmitAndOpen("task-7", slot(), []),
    ],
  ])("%s", (_name, submit) => {
    // #468: a brand-new row carries no tag, so while a calendar lens is on it
    // is filtered out the instant it exists — the add button reads as broken.
    const h = setup();
    act(() => submit(h));
    expect(h.setCreatePanel).toHaveBeenCalledWith(null);
    expect(h.clearTagLens).toHaveBeenCalledTimes(1);
  });
});

describe("useScheduleCreateFlow — which layout selects what", () => {
  it("selects the new row on Desktop and opens nothing", () => {
    const h = setup({ isWide: true });
    act(() => api(h).handleCreateSubmit("Dentist", slot(), []));
    expect(h.setSelectedId).toHaveBeenCalledWith("evt-new");
    expect(h.setOverlayOpen).not.toHaveBeenCalled();
  });

  it("selects nothing on narrow, where selection IS the sheet", () => {
    // Selecting there would silently turn the plain create into the other
    // button.
    const h = setup({ isWide: false });
    act(() => api(h).handleCreateSubmit("Dentist", slot(), []));
    expect(h.setSelectedId).not.toHaveBeenCalled();
    expect(h.setOverlayOpen).not.toHaveBeenCalled();
  });

  it.each([
    ["Desktop", true],
    ["narrow", false],
  ])("create-and-open selects on %s", (_name, isWide) => {
    const h = setup({ isWide });
    act(() => api(h).handleCreateSubmitAndOpen("Dentist", slot(), []));
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
        [],
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
    act(() => api(bare).handlePlaceTodoSubmit("task-7", slot(), []));
    expect(bare.updateNode.mock.calls[0][2]).toEqual({
      undoLabel: "todoChipPlace",
    });

    const withNote = setup();
    act(() => api(withNote).handlePlaceTodoSubmit("task-7", slot(), NOTES));
    expect(withNote.updateNode.mock.calls[0][2]).toBeUndefined();
  });

  it("attaches a placed todo's note without waiting", () => {
    // Unlike the create paths: this todo came out of a pool read from the DB,
    // so its items_meta row is already there and the link's FK is satisfied.
    const h = setup();
    act(() => api(h).handlePlaceTodoSubmit("task-7", slot(), NOTES));
    expect(h.attachNote).toHaveBeenCalledWith("task-7", NOTES);
    expect(h.attachNote.mock.invocationCallOrder[0]).toBeLessThan(
      h.setCreatePanel.mock.invocationCallOrder[0],
    );
  });

  /*
   * #2406: the panel's all-day check reaches the todo tab. An all-day todo is
   * the tray's staging shape — the day at 00:00 plus the flag — not a timed
   * window with the flag set beside it.
   */
  it("writes a new all-day todo as the day with no time", () => {
    const h = setup();
    act(() =>
      api(h).handleCreateTodoSubmit(
        "Report",
        slot({ date: "2026-08-25", isAllDay: true }),
        [],
      ),
    );
    const options = h.addNode.mock.calls[0][3] as {
      scheduledAt: string;
      scheduledEndAt?: string;
      isAllDay: boolean;
    };
    expect(options.isAllDay).toBe(true);
    // Read back in local time, so the case does not pin the runner's offset.
    const at = new Date(options.scheduledAt);
    expect([at.getFullYear(), at.getMonth() + 1, at.getDate()]).toEqual([
      2026, 8, 25,
    ]);
    expect([at.getHours(), at.getMinutes()]).toEqual([0, 0]);
    expect(options.scheduledEndAt).toBeUndefined();
  });

  it("places an existing todo all-day when the slot says so", () => {
    const h = setup();
    act(() =>
      api(h).handlePlaceTodoSubmit(
        "task-7",
        slot({ date: "2026-08-25", isAllDay: true }),
        [],
      ),
    );
    const patch = h.updateNode.mock.calls[0][1] as {
      scheduledAt: string;
      isAllDay: boolean;
    };
    expect(patch.isAllDay).toBe(true);
    expect(new Date(patch.scheduledAt).getHours()).toBe(0);
  });
});

/*
 * #2406: "Add and edit" on the todo tab. It used to be the event's alone —
 * the Schedule had no todo editor (#297) until #626 put the todo detail panel
 * in it. The twin writes exactly what the plain button writes, then opens that
 * panel on the todo.
 */
describe("useScheduleCreateFlow — a todo's 'add and edit'", () => {
  it("creates the todo, then opens its detail by the new node's id", () => {
    const h = setup();
    act(() =>
      api(h).handleCreateTodoSubmitAndOpen("Report", slot(), []),
    );
    expect(h.addNode).toHaveBeenCalledTimes(1);
    expect(h.addNode.mock.calls[0][2]).toBe("Report");
    expect(h.openTodoDetail).toHaveBeenCalledWith("task-new");
    // The panel closes first: the detail and the creation surface are never
    // open together (ScheduleOverlays' ordering note).
    expect(h.setCreatePanel.mock.invocationCallOrder[0]).toBeLessThan(
      h.openTodoDetail.mock.invocationCallOrder[0],
    );
    // Nothing is selected on the grid — the todo has its own panel.
    expect(h.setSelectedId).not.toHaveBeenCalled();
  });

  it("places the picked todo, then opens its detail", () => {
    const h = setup();
    act(() =>
      api(h).handlePlaceTodoSubmitAndOpen("task-7", slot(), []),
    );
    expect(h.updateNode).toHaveBeenCalledTimes(1);
    expect(h.updateNode.mock.calls[0][0]).toBe("task-7");
    expect(h.openTodoDetail).toHaveBeenCalledWith("task-7");
  });

  it("leaves the plain todo buttons opening nothing", () => {
    const h = setup();
    act(() => {
      api(h).handleCreateTodoSubmit("Report", slot(), []);
      api(h).handlePlaceTodoSubmit("task-7", slot(), []);
    });
    expect(h.openTodoDetail).not.toHaveBeenCalled();
  });
});

/*
 * #2406: a repeat picked in the panel. It rides the create's companion — the
 * one call the provider makes once the row exists — so the conversion gets
 * the SAVED row, and its reversal joins the create's one undo command.
 */
describe("useScheduleCreateFlow — a repeat picked while creating", () => {
  const DAILY: FrequencyEditorValue = {
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    frequencyEndDate: null,
  };
  const saved = { id: "evt-saved" } as ScheduleItem;

  const reversal = (log: string[], name: string): Reversal => ({
    undo: vi.fn(async () => {
      log.push(`undo ${name}`);
    }),
    redo: vi.fn(async () => {
      log.push(`redo ${name}`);
    }),
  });

  it.each([
    ["create", "handleCreateSubmit"],
    ["create-and-open", "handleCreateSubmitAndOpen"],
  ] as const)(
    "%s converts the SAVED row once it exists",
    async (_name, submit) => {
      const h = setup();
      act(() => api(h)[submit]("Standup", slot({ repeat: DAILY }), []));
      expect(h.convertToRepeat).not.toHaveBeenCalled();
      await act(async () => {
        await h.captured.alongside?.(saved);
      });
      expect(h.convertToRepeat).toHaveBeenCalledWith(saved, DAILY);
    },
  );

  it("hands back the series' reversal as the companion's", async () => {
    const h = setup();
    const log: string[] = [];
    const series = reversal(log, "series");
    h.convertToRepeat.mockResolvedValueOnce(series);
    act(() =>
      api(h).handleCreateSubmit("Standup", slot({ repeat: DAILY }), []),
    );
    let companion: unknown;
    await act(async () => {
      companion = await h.captured.alongside?.(saved);
    });
    expect(companion).toBe(series);
  });

  it("folds the note and the series into one reversal, series off first", async () => {
    const h = setup();
    const log: string[] = [];
    h.attachNoteAlongside.mockResolvedValueOnce(reversal(log, "note"));
    h.convertToRepeat.mockResolvedValueOnce(reversal(log, "series"));
    act(() =>
      api(h).handleCreateSubmit("Standup", slot({ repeat: DAILY }), NOTES),
    );
    const box: { companion?: Reversal } = {};
    await act(async () => {
      box.companion = (await h.captured.alongside?.(saved)) as Reversal;
    });
    await act(async () => {
      await box.companion?.undo();
      await box.companion?.redo();
    });
    // Last on, first off — and back on in the order they went on.
    expect(log).toEqual([
      "undo series",
      "undo note",
      "redo note",
      "redo series",
    ]);
  });

  it("still converts when the note attach threw", async () => {
    const h = setup();
    h.attachNoteAlongside.mockRejectedValueOnce(new Error("offline"));
    act(() =>
      api(h).handleCreateSubmit("Standup", slot({ repeat: DAILY }), NOTES),
    );
    await act(async () => {
      await h.captured.alongside?.(saved);
    });
    expect(h.convertToRepeat).toHaveBeenCalledWith(saved, DAILY);
  });

  it("converts nothing when no repeat was picked", async () => {
    const h = setup();
    act(() => api(h).handleCreateSubmit("Standup", slot(), NOTES));
    await act(async () => {
      await h.captured.alongside?.(saved);
    });
    expect(h.convertToRepeat).not.toHaveBeenCalled();
  });
});

/*
 * #2402 — 新規作成: the form is saved as it stands, then the memo note. The
 * writes and the copy are the host's (useCreatePanelMemoNote), so what these
 * pin is the order and what each path is handed.
 */
describe("useScheduleCreateFlow — 新規作成 (#2402)", () => {
  const ATTACHED = { noteId: "note-memo", ok: true, reversal: null };

  function setupMemo(over?: { createPanel?: typeof PANEL | null }) {
    const order: string[] = [];
    const memoNote = {
      untitled: vi.fn((kind: string) => `untitled:${kind}`),
      attach: vi.fn<
        (...args: unknown[]) => Promise<
          typeof ATTACHED | Record<string, unknown>
        >
      >(async () => {
        order.push("attach");
        return ATTACHED;
      }),
      fold: vi.fn((parts: readonly (Reversal | null)[]) => parts[0] ?? null),
      pushTodoUndo: vi.fn<(...args: unknown[]) => void>(() => {
        order.push("push");
      }),
      land: vi.fn<(...args: unknown[]) => void>(() => {
        order.push("land");
      }),
      fail: vi.fn(),
    };
    const captured: {
      alongside?: (saved: { id: string }) => Promise<unknown>;
      options?: {
        skipUndo?: boolean;
        onSaved?: (saved: { id: string } | null) => void;
      };
    } = {};
    const handleCreate = vi.fn(
      (
        _slot: unknown,
        _title: string,
        _onSaved: unknown,
        alongside?: (saved: never) => Promise<unknown>,
      ) => {
        captured.alongside = alongside as never;
        return "evt-new";
      },
    );
    const spies = {
      setCreatePanel: vi.fn(),
      setPopover: vi.fn(),
      setSelectedId: vi.fn(),
      setOverlayOpen: vi.fn(),
      updateNode: vi.fn(),
      attachNote: vi.fn(),
      attachNoteAlongside: vi.fn(() => Promise.resolve(null)),
      onAttachError: vi.fn(),
      clearTagLens: vi.fn(),
      convertToRepeat: vi.fn(async (): Promise<Reversal | null> => {
        order.push("repeat");
        return null;
      }),
    };
    const addNode = vi.fn(
      (
        _type: unknown,
        _parent: unknown,
        _title: string,
        options?: typeof captured.options,
      ) => {
        captured.options = options;
        return { id: "task-new" } as TodoNode;
      },
    );
    const tags = { take: vi.fn(() => ["tag-work"]), apply: vi.fn() };
    const view = renderHook(() =>
      useScheduleCreateFlow({
        createPanel: over?.createPanel === undefined ? PANEL : over.createPanel,
        anchorDate: "2026-08-20",
        isWide: true,
        handleCreate: handleCreate as never,
        addNode: addNode as never,
        memoNote: memoNote as never,
        tags,
        ...spies,
      }),
    );
    return {
      view,
      memoNote,
      captured,
      handleCreate,
      addNode,
      tags,
      order,
      ...spies,
    };
  }
  const press = (
    h: ReturnType<typeof setupMemo>,
    target: ItemCreateMemoTarget,
    notes: readonly ItemCreateNoteDraft[] = [],
  ) => act(() => h.view.result.current.handleCreateMemoNote?.(target, notes));

  it("offers no handler to a host without memoNote", () => {
    const h = setup();
    expect(api(h).handleCreateMemoNote).toBeUndefined();
  });

  it("does nothing while the panel is closed", () => {
    const h = setupMemo({ createPanel: null });
    press(h, { kind: "event", title: "x", slot: slot() });
    expect(h.handleCreate).not.toHaveBeenCalled();
    expect(h.tags.take).not.toHaveBeenCalled();
  });

  describe("an event", () => {
    it("saves under the title, closes, and writes only once the row exists", async () => {
      const h = setupMemo();
      press(h, { kind: "event", title: "Dentist", slot: slot() }, NOTES);
      expect(h.handleCreate.mock.calls[0].slice(0, 2)).toEqual([
        slot(),
        "Dentist",
      ]);
      expect(h.setCreatePanel).toHaveBeenCalledWith(null);
      expect(h.clearTagLens).toHaveBeenCalledTimes(1);
      expect(h.memoNote.attach).not.toHaveBeenCalled();
      // The screen is about to be left, and on Mobile this raises a sheet.
      expect(h.setSelectedId).not.toHaveBeenCalled();

      await act(async () => {
        await h.captured.alongside?.({ id: "evt-saved" });
      });
      expect(h.memoNote.attach).toHaveBeenCalledExactlyOnceWith(
        "evt-saved",
        "Dentist",
        { notes: NOTES, noteTagIds: ["tag-work"], itemTagIds: ["tag-work"] },
      );
      expect(h.memoNote.land).toHaveBeenCalledExactlyOnceWith(
        "event",
        "Dentist",
        ATTACHED,
      );
      // The applyTags path pushes a history entry per tag.
      expect(h.tags.apply).not.toHaveBeenCalled();
    });

    it("names an empty title", () => {
      const h = setupMemo();
      press(h, { kind: "event", title: "", slot: slot() });
      expect(h.memoNote.untitled).toHaveBeenCalledWith("event");
      expect(h.handleCreate.mock.calls[0][1]).toBe("untitled:event");
    });

    it("hands the reversal back to the create, for its one undo", async () => {
      const h = setupMemo();
      const reversal: Reversal = {
        undo: async () => {},
        redo: async () => {},
      };
      h.memoNote.attach.mockResolvedValueOnce({ ...ATTACHED, reversal });
      press(h, { kind: "event", title: "Dentist", slot: slot() });
      let handed: unknown;
      await act(async () => {
        handed = await h.captured.alongside?.({ id: "evt-saved" });
      });
      expect(handed).toBe(reversal);
      expect(h.memoNote.pushTodoUndo).not.toHaveBeenCalled();
    });

    it("runs a picked repeat before the jump leaves the section", async () => {
      const h = setupMemo();
      const repeat = { frequencyType: "daily" } as FrequencyEditorValue;
      press(h, { kind: "event", title: "Standup", slot: slot({ repeat }) });
      await act(async () => {
        await h.captured.alongside?.({ id: "evt-saved" });
      });
      expect(h.order).toEqual(["attach", "repeat", "land"]);
    });
  });

  describe("a new todo", () => {
    it("is created without the tree's own undo, which dies on the jump", () => {
      const h = setupMemo();
      press(h, { kind: "task", title: "", slot: slot() });
      expect(h.addNode).toHaveBeenCalledTimes(1);
      expect(h.addNode.mock.calls[0][2]).toBe("untitled:task");
      expect(h.captured.options?.skipUndo).toBe(true);
      expect(h.setCreatePanel).toHaveBeenCalledWith(null);
      expect(h.memoNote.attach).not.toHaveBeenCalled();
    });

    it("attaches once saved, then records the one undo, then lands", async () => {
      const h = setupMemo();
      press(h, { kind: "task", title: "Write", slot: slot() }, NOTES);
      await act(async () => {
        h.captured.options?.onSaved?.({ id: "task-saved" });
      });
      // Staged goals ride attachNote, which is given no notes to double up.
      expect(h.attachNote).toHaveBeenCalledExactlyOnceWith("task-saved", []);
      expect(h.memoNote.attach).toHaveBeenCalledExactlyOnceWith(
        "task-saved",
        "Write",
        { notes: NOTES, noteTagIds: ["tag-work"], itemTagIds: ["tag-work"] },
      );
      expect(h.memoNote.pushTodoUndo).toHaveBeenCalledExactlyOnceWith(
        ATTACHED,
        "task-saved",
      );
      expect(h.order).toEqual(["attach", "push", "land"]);
    });

    it("says it failed, once, when the todo's row did not land", () => {
      const h = setupMemo();
      press(h, { kind: "task", title: "Write", slot: slot() });
      act(() => h.captured.options?.onSaved?.(null));
      expect(h.memoNote.fail).toHaveBeenCalledTimes(1);
      expect(h.memoNote.attach).not.toHaveBeenCalled();
    });
  });

  describe("a todo picked under 既存から選ぶ", () => {
    const PICKED = {
      kind: "picked" as const,
      todoId: "task-old",
      title: "Old",
    };

    it("creates and moves nothing, and links the memo to the picked todo", async () => {
      const h = setupMemo();
      await act(async () => {
        h.view.result.current.handleCreateMemoNote?.(PICKED, NOTES);
      });
      expect(h.addNode).not.toHaveBeenCalled();
      expect(h.updateNode).not.toHaveBeenCalled();
      expect(h.memoNote.attach).toHaveBeenCalledExactlyOnceWith(
        "task-old",
        "Old",
        { notes: NOTES, noteTagIds: ["tag-work"], itemTagIds: [] },
      );
      expect(h.memoNote.pushTodoUndo).toHaveBeenCalledExactlyOnceWith(
        ATTACHED,
        null,
      );
      expect(h.memoNote.land).toHaveBeenCalledExactlyOnceWith(
        "task",
        "Old",
        ATTACHED,
      );
      expect(h.setCreatePanel).toHaveBeenCalledWith(null);
    });
  });
});
