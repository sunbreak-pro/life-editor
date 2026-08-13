import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { StrictMode, useEffect, type ReactNode } from "react";
import { UndoRedoProvider } from "../src/context/UndoRedoContext";
import { useUndoRedoContext } from "../src/hooks/useUndoRedoContext";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import { ScheduleItemsProvider } from "../src/context/ScheduleItemsContext";
import { DailiesUnifiedProvider } from "../src/context/DailiesUnifiedContext";
import { NotesUnifiedProvider } from "../src/context/NotesUnifiedContext";
import { TodoTreeProvider } from "../src/context/TodoTreeContext";
import { RoutineProvider } from "../src/context/RoutineContext";
import { useRoutineContext } from "../src/hooks/useRoutineContext";
import { useScheduleItemsContext } from "../src/hooks/useScheduleItemsContext";
import { useDailiesUnifiedContext } from "../src/hooks/useDailiesUnifiedContext";
import { useNotesUnifiedContext } from "../src/hooks/useNotesUnifiedContext";
import { useTodoTreeContext } from "../src/hooks/useTodoTreeContext";
import { resetMaterialsSelection } from "../src/state/materialsSelectionStore";
import type { DataService } from "../src/services/DataService";
import type { UndoRedoLike } from "../src/hooks/useTodoTreeHistory";
import type { ScheduleItemsViewMirror } from "../src/hooks/useScheduleItemsAPI";
import type { ScheduleItem } from "../src/types/schedule";
import { todayCalendarKey } from "../src/utils/dateKey";

/*
 * #304 child-2 — domain providers auto-connect to the ambient global UndoRedo
 * stack (useUndoRedoOptional), mirroring TodoTreeProvider. Per domain
 * (schedule / daily / note) this verifies the two wired behaviours:
 *  1. a domain mutation pushes onto the GLOBAL stack (canUndo flips true
 *     outside the domain provider), and
 *  2. unmounting the domain provider clears the stack (child-1 safety valve —
 *     a dead provider's closures must never run after navigation).
 * The DataService stubs only cover the mount fetch + the one mutation each
 * probe fires; persistence is fire-and-forget in the hooks.
 */

function SyncStub({ children }: { children: ReactNode }) {
  return (
    <SyncContext.Provider
      value={{
        syncVersion: 0,
        domainVersions: uniformDomainVersions(0),
        triggerSync: async () => {},
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

function CanUndoProbe() {
  const { canUndo } = useUndoRedoContext();
  return <span data-testid="can-undo">{String(canUndo())}</span>;
}

function ScheduleProbe() {
  const { createScheduleItem } = useScheduleItemsContext();
  return (
    <button
      onClick={() => createScheduleItem("2026-01-15", "t", "09:00", "10:00")}
    >
      mutate
    </button>
  );
}

function DailyProbe() {
  const { upsertDaily } = useDailiesUnifiedContext();
  return (
    <button onClick={() => upsertDaily("2026-01-15", "hello")}>mutate</button>
  );
}

function NoteProbe() {
  // #375: createFolder is retired — createNote is the remaining Notes
  // mutation that pushes onto the UndoRedo stack.
  const { createNote } = useNotesUnifiedContext();
  return <button onClick={() => createNote("N")}>mutate</button>;
}

function TaskProbe() {
  const { addNode } = useTodoTreeContext();
  return <button onClick={() => addNode("task", null, "T")}>mutate</button>;
}

function RoutineProbe() {
  const { createRoutine } = useRoutineContext();
  return <button onClick={() => createRoutine("R")}>mutate</button>;
}

const scheduleDS = {
  fetchScheduleItemsByDateAll: async () => [],
  fetchDeletedScheduleItems: async () => [],
  createScheduleItem: async () => ({ date: "" }),
  softDeleteScheduleItem: async () => {},
  restoreScheduleItem: async () => {},
} as unknown as DataService;

const dailyDS = {
  listDailiesUnified: async () => [],
  fetchDeletedDailiesUnified: async () => [],
  upsertDailyByDateUnified: async () => ({}),
  getDailyByDateUnified: async () => null,
} as unknown as DataService;

const noteDS = {
  listNotesUnified: async () => [],
  fetchDeletedNotesUnified: async () => [],
  createNoteUnified: async () => ({}),
} as unknown as DataService;

const taskDS = {
  fetchTodoTree: async () => [],
  fetchDeletedTodos: async () => [],
  syncTodoTree: async () => {},
} as unknown as DataService;

const routineDS = {
  fetchAllRoutines: async () => [],
  fetchDeletedRoutines: async () => [],
  createRoutine: async () => {},
  softDeleteRoutine: async () => ({ deletedScheduleItemIds: [] }),
  restoreRoutine: async () => {},
} as unknown as DataService;

/* ── #568 fixtures: a row on a day the provider is NOT anchored on ─────── */

const OFF_DAY_ITEM: ScheduleItem = {
  id: "schedule-off-day",
  // Fixed past date: the provider anchors on today, so this row can only ever
  // be reached through the host's on-screen store.
  date: "2026-03-09",
  title: "standup",
  startTime: "09:00",
  endTime: "09:30",
  completed: false,
  completedAt: null,
  routineId: null,
  templateId: null,
  memo: null,
  noteId: null,
  content: null,
  isDeleted: false,
  deletedAt: null,
  isDismissed: false,
  isAllDay: false,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

/** Stand-in for the calendar's visible-range store (web/useVisibleRangeItems). */
function makeFakeMirror(initial: ScheduleItem[]) {
  let rows = initial;
  const mirror: ScheduleItemsViewMirror = {
    find: (id) => rows.find((i) => i.id === id),
    upsert: (item) => {
      rows = rows.some((i) => i.id === item.id)
        ? rows.map((i) => (i.id === item.id ? item : i))
        : [...rows, item];
    },
    patch: (id, patch) => {
      rows = rows.map((i) => (i.id === id ? { ...i, ...patch } : i));
    },
    remove: (id) => {
      rows = rows.filter((i) => i.id !== id);
    },
  };
  return { mirror, rows: () => rows };
}

function makeScheduleMutationDS(loaded: ScheduleItem[] = []) {
  const calls: Array<[string, unknown]> = [];
  const ds = {
    fetchScheduleItemsByDateAll: async () => loaded,
    fetchDeletedScheduleItems: async () => [],
    updateScheduleItem: async (_id: string, updates: unknown) => {
      calls.push(["update", updates]);
      return OFF_DAY_ITEM;
    },
    toggleScheduleItemComplete: async (id: string) => {
      calls.push(["toggle", id]);
      return {
        ...OFF_DAY_ITEM,
        completed: true,
        completedAt: "2026-03-09T09:30:00.000Z",
      };
    },
    softDeleteScheduleItem: async (id: string) => {
      calls.push(["softDelete", id]);
    },
    restoreScheduleItem: async (id: string) => {
      calls.push(["restore", id]);
    },
  } as unknown as DataService;
  return { ds, calls };
}

/**
 * Stands in for the calendar host: registers its store with the provider and
 * fires the same write pairs the real mutation layer does — provider first,
 * local patch after (the #568 order contract; see
 * web/src/schedule/useScheduleMutations.ts::applyOccurrencePatch).
 */
function OffDayProbe({
  mirror,
  itemId = OFF_DAY_ITEM.id,
}: {
  mirror: ScheduleItemsViewMirror;
  itemId?: string;
}) {
  const {
    registerViewMirror,
    updateScheduleItem,
    toggleComplete,
    deleteScheduleItem,
  } = useScheduleItemsContext();
  useEffect(() => registerViewMirror(mirror), [registerViewMirror, mirror]);
  const id = itemId;
  return (
    <>
      <button
        onClick={() => {
          const patch = { startTime: "11:00", endTime: "11:30" };
          updateScheduleItem(id, patch);
          mirror.patch(id, patch);
        }}
      >
        move
      </button>
      <button
        onClick={() => {
          toggleComplete(id);
          mirror.patch(id, {
            completed: true,
            completedAt: "2026-03-09T09:30:00.000Z",
          });
        }}
      >
        toggle
      </button>
      <button
        onClick={() => {
          deleteScheduleItem(id);
          mirror.remove(id);
        }}
      >
        delete
      </button>
    </>
  );
}

function UndoRedoProbe() {
  const { undo, redo, canUndo } = useUndoRedoContext();
  return (
    <>
      <span data-testid="can-undo">{String(canUndo())}</span>
      <button onClick={() => undo()}>undo</button>
      <button onClick={() => redo()}>redo</button>
    </>
  );
}

function OffDayHarness({
  dataService,
  mirror,
  probeMounted = true,
  itemId,
}: {
  dataService: DataService;
  mirror: ScheduleItemsViewMirror;
  probeMounted?: boolean;
  itemId?: string;
}) {
  return (
    <UndoRedoProvider>
      <UndoRedoProbe />
      <SyncStub>
        <ScheduleItemsProvider dataService={dataService}>
          {probeMounted ? (
            <OffDayProbe mirror={mirror} itemId={itemId} />
          ) : null}
        </ScheduleItemsProvider>
      </SyncStub>
    </UndoRedoProvider>
  );
}

/** Mounts the global stack + probe, with the domain subtree removable. */
function Harness({ mounted, domain }: { mounted: boolean; domain: ReactNode }) {
  return (
    <UndoRedoProvider>
      <CanUndoProbe />
      <SyncStub>{mounted ? domain : null}</SyncStub>
    </UndoRedoProvider>
  );
}

async function expectPushAndClearOnUnmount(domain: ReactNode) {
  const { rerender } = render(<Harness mounted domain={domain} />);
  // Flush the provider's initial load promise.
  await act(async () => {});
  expect(screen.getByTestId("can-undo").textContent).toBe("false");

  await act(async () => {
    fireEvent.click(screen.getByText("mutate"));
  });
  expect(screen.getByTestId("can-undo").textContent).toBe("true");

  rerender(<Harness mounted={false} domain={domain} />);
  await act(async () => {});
  expect(screen.getByTestId("can-undo").textContent).toBe("false");
}

describe("UndoRedo domain wiring (#304 child-2)", () => {
  beforeEach(() => {
    resetMaterialsSelection();
    localStorage.clear();
  });

  it("scheduleItems: push lands on the global stack; unmount clears it", async () => {
    await expectPushAndClearOnUnmount(
      <ScheduleItemsProvider dataService={scheduleDS}>
        <ScheduleProbe />
      </ScheduleItemsProvider>,
    );
  });

  it("dailies: push lands on the global stack; unmount clears it", async () => {
    await expectPushAndClearOnUnmount(
      <DailiesUnifiedProvider dataService={dailyDS}>
        <DailyProbe />
      </DailiesUnifiedProvider>,
    );
  });

  it("notes: push lands on the global stack; unmount clears it", async () => {
    await expectPushAndClearOnUnmount(
      <NotesUnifiedProvider dataService={noteDS}>
        <NoteProbe />
      </NotesUnifiedProvider>,
    );
  });

  // Regression for the child-1 unmount-clear effect: it depended on the
  // reactive context value, so its cleanup re-ran after every push and wiped
  // the history immediately ("canUndo" never survived a mutation).
  it("taskTree: push survives (child-1 clear-on-every-push regression)", async () => {
    await expectPushAndClearOnUnmount(
      <TodoTreeProvider dataService={taskDS}>
        <TaskProbe />
      </TodoTreeProvider>,
    );
  });

  // D-20260810-refactor-1: routines were the one domain whose API hook pushed
  // commands with nowhere to push them — the Provider never read the ambient
  // stack, so every routine command was a no-op. Ctrl+Z on a routine did
  // nothing at all, which is the behaviour this fixes.
  it("routines: push lands on the global stack; unmount clears it", async () => {
    await expectPushAndClearOnUnmount(
      <RoutineProvider dataService={routineDS}>
        <RoutineProbe />
      </RoutineProvider>,
    );
  });

  it("explicit undoRedo prop wins over the ambient stack and is not cleared on unmount", async () => {
    const pushes: string[] = [];
    let cleared = 0;
    const explicit: UndoRedoLike = {
      push: (_domain, command) => {
        pushes.push(command.label);
      },
      undo: () => {},
      redo: () => {},
      canUndo: () => false,
      canRedo: () => false,
      clear: () => {
        cleared += 1;
      },
    };
    const domain = (
      <DailiesUnifiedProvider dataService={dailyDS} undoRedo={explicit}>
        <DailyProbe />
      </DailiesUnifiedProvider>
    );
    const { rerender } = render(<Harness mounted domain={domain} />);
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByText("mutate"));
    });
    // The command went to the injected history, not the global stack.
    expect(pushes).toEqual(["createDaily"]);
    expect(screen.getByTestId("can-undo").textContent).toBe("false");

    rerender(<Harness mounted={false} domain={domain} />);
    await act(async () => {});
    // The host-managed history is left alone on unmount.
    expect(cleared).toBe(0);
  });

  // #568 regression: the provider is anchored on ONE day, but the calendar
  // grid shows a whole week/month out of its own store. Every mutation below
  // used to look for its "prev" in the anchored day's list only — miss, no
  // push, Ctrl+Z dead — and the pushes that did happen wrote their rollback
  // into that same list, which the grid does not read.
  describe("scheduleItems: mutations outside the anchored day (#568)", () => {
    it("update: pushes, and undo/redo reach the host's on-screen store", async () => {
      const { ds, calls } = makeScheduleMutationDS();
      const { mirror, rows } = makeFakeMirror([OFF_DAY_ITEM]);
      render(<OffDayHarness dataService={ds} mirror={mirror} />);
      await act(async () => {});
      expect(screen.getByTestId("can-undo").textContent).toBe("false");

      await act(async () => {
        fireEvent.click(screen.getByText("move"));
      });
      // The command exists at all — this is the bug in one assertion.
      expect(screen.getByTestId("can-undo").textContent).toBe("true");
      expect(rows()[0].startTime).toBe("11:00");

      await act(async () => {
        fireEvent.click(screen.getByText("undo"));
      });
      expect(rows()[0].startTime).toBe("09:00");
      expect(rows()[0].endTime).toBe("09:30");
      expect(calls).toContainEqual([
        "update",
        { startTime: "09:00", endTime: "09:30" },
      ]);

      await act(async () => {
        fireEvent.click(screen.getByText("redo"));
      });
      expect(rows()[0].startTime).toBe("11:00");
    });

    it("toggleComplete: pushes, and undo restores the completion pair", async () => {
      const { ds } = makeScheduleMutationDS();
      const { mirror, rows } = makeFakeMirror([OFF_DAY_ITEM]);
      render(<OffDayHarness dataService={ds} mirror={mirror} />);
      await act(async () => {});

      await act(async () => {
        fireEvent.click(screen.getByText("toggle"));
      });
      expect(screen.getByTestId("can-undo").textContent).toBe("true");
      expect(rows()[0].completed).toBe(true);

      await act(async () => {
        fireEvent.click(screen.getByText("undo"));
      });
      expect(rows()[0].completed).toBe(false);
      // completedAt travels with it — a stale timestamp on a not-done row
      // would show a checkmark time nobody set.
      expect(rows()[0].completedAt).toBeNull();
    });

    it("delete: pushes, and undo puts the row back on the grid", async () => {
      const { ds, calls } = makeScheduleMutationDS();
      const { mirror, rows } = makeFakeMirror([OFF_DAY_ITEM]);
      render(<OffDayHarness dataService={ds} mirror={mirror} />);
      await act(async () => {});

      await act(async () => {
        fireEvent.click(screen.getByText("delete"));
      });
      expect(screen.getByTestId("can-undo").textContent).toBe("true");
      expect(rows()).toHaveLength(0);

      await act(async () => {
        fireEvent.click(screen.getByText("undo"));
      });
      expect(rows()).toHaveLength(1);
      expect(rows()[0].id).toBe(OFF_DAY_ITEM.id);
      expect(rows()[0].isDeleted).toBe(false);
      expect(calls).toContainEqual(["restore", OFF_DAY_ITEM.id]);

      await act(async () => {
        fireEvent.click(screen.getByText("redo"));
      });
      expect(rows()).toHaveLength(0);
    });

    // The anchored day still answers first. The mirror is an ADDITION to the
    // provider's own list, not a replacement — a host store lagging behind
    // (its range fetch landed before the last edit) must not become the
    // snapshot an undo restores.
    it("today's row: the provider's own list wins over the host store", async () => {
      const todayItem: ScheduleItem = {
        ...OFF_DAY_ITEM,
        id: "schedule-today",
        date: todayCalendarKey(),
      };
      const { ds, calls } = makeScheduleMutationDS([todayItem]);
      const { mirror, rows } = makeFakeMirror([
        { ...todayItem, startTime: "23:00", endTime: "23:30" },
      ]);
      render(
        <OffDayHarness
          dataService={ds}
          mirror={mirror}
          itemId={todayItem.id}
        />,
      );
      await act(async () => {});

      await act(async () => {
        fireEvent.click(screen.getByText("move"));
      });
      expect(screen.getByTestId("can-undo").textContent).toBe("true");

      await act(async () => {
        fireEvent.click(screen.getByText("undo"));
      });
      // 09:00/09:30 is the fetched row; 23:00/23:30 is the stale mirror copy.
      expect(calls).toContainEqual([
        "update",
        { startTime: "09:00", endTime: "09:30" },
      ]);
      expect(rows()[0].startTime).toBe("09:00");
    });

    // A detached host (the calendar unmounted while the provider stayed) must
    // not make undo throw — the commands simply fall back to the anchored list.
    it("survives an undo after the host's store detached", async () => {
      const { ds } = makeScheduleMutationDS();
      const { mirror, rows } = makeFakeMirror([OFF_DAY_ITEM]);
      const { rerender } = render(
        <OffDayHarness dataService={ds} mirror={mirror} probeMounted />,
      );
      await act(async () => {});
      await act(async () => {
        fireEvent.click(screen.getByText("move"));
      });
      rerender(
        <OffDayHarness dataService={ds} mirror={mirror} probeMounted={false} />,
      );
      await act(async () => {
        fireEvent.click(screen.getByText("undo"));
      });
      // Nothing threw, and the detached store was left untouched.
      expect(rows()[0].startTime).toBe("11:00");
    });
  });

  // StrictMode double-mounts run the clear cleanup once mid-mount (on an
  // empty stack — harmless); a push afterwards must still survive.
  it("survives a StrictMode double-mount", async () => {
    const domain = (
      <NotesUnifiedProvider dataService={noteDS}>
        <NoteProbe />
      </NotesUnifiedProvider>
    );
    const { rerender } = render(
      <StrictMode>
        <Harness mounted domain={domain} />
      </StrictMode>,
    );
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByText("mutate"));
    });
    expect(screen.getByTestId("can-undo").textContent).toBe("true");

    rerender(
      <StrictMode>
        <Harness mounted={false} domain={domain} />
      </StrictMode>,
    );
    await act(async () => {});
    expect(screen.getByTestId("can-undo").textContent).toBe("false");
  });
});
