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
import { WikiTagsUnifiedProvider } from "../src/context/WikiTagsUnifiedContext";
import { useRoutineContext } from "../src/hooks/useRoutineContext";
import { useWikiTagsUnifiedContext } from "../src/hooks/useWikiTagsUnifiedContext";
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
 *  2. unmounting the domain provider expires only its SNAPSHOT commands
 *     (#1727) — by-id commands outlive the section they were made in.
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
  const { canUndo, undo } = useUndoRedoContext();
  return (
    <>
      <span data-testid="can-undo">{String(canUndo())}</span>
      {/* The header's button, in the one place that outlives every section. */}
      <button onClick={() => undo()}>undo</button>
    </>
  );
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

function TodoProbe() {
  const { addNode } = useTodoTreeContext();
  return <button onClick={() => addNode("task", null, "T")}>mutate</button>;
}

function RoutineProbe() {
  const { createRoutine } = useRoutineContext();
  return <button onClick={() => createRoutine("R")}>mutate</button>;
}

/**
 * #1800 — tagging is the sixth domain on this stack. The pills the user
 * clicks are in Materials, Connect, Notes and Schedule, and all four go
 * through this one mutator, so one probe stands for every entry.
 */
function TagsProbe() {
  const { assignTagToItem, getTagsForItem } = useWikiTagsUnifiedContext();
  return (
    <>
      <button onClick={() => void assignTagToItem("task-1", "tag-1")}>
        mutate
      </button>
      <span data-testid="tag-count">{getTagsForItem("task-1").length}</span>
    </>
  );
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

const todoDS = {
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

/**
 * The three bulk reads the tags hook fires on mount, plus the assign/unassign
 * pair the probe drives. The row is returned whole because the hook puts the
 * SERVER's row in its cache, not the optimistic one (#1593 revive).
 */
function makeTagsDS() {
  const calls: string[] = [];
  const ds = {
    listAllWikiTagsUnified: async () => [],
    listAllTagAssignments: async () => [],
    listAllTagConnections: async () => [],
    assignTagToItem: async (id: string, itemId: string, tagId: string) => {
      calls.push("assign");
      return {
        id,
        itemId,
        tagId,
        isDisplayColor: false,
        createdAt: "2026-09-21T00:00:00.000Z",
        updatedAt: "2026-09-21T00:00:00.000Z",
        isDeleted: false,
        deletedAt: null,
      };
    },
    unassignTagFromItem: async () => {
      calls.push("unassign");
    },
  } as unknown as DataService;
  return { ds, calls };
}

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

/**
 * Push one command, then unmount the domain provider.
 *
 * `survivesUnmount` is the #1727 half: a command that names its rows by id is
 * still there afterwards (the user walked to another section, not away from
 * their data), while a snapshot command — todoTree's tree writes — is expired
 * by the provider that took the snapshot.
 */
async function expectPushThenUnmount(
  domain: ReactNode,
  survivesUnmount: boolean,
) {
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
  expect(screen.getByTestId("can-undo").textContent).toBe(
    String(survivesUnmount),
  );
}

describe("UndoRedo domain wiring (#304 child-2)", () => {
  beforeEach(() => {
    resetMaterialsSelection();
    localStorage.clear();
  });

  it("scheduleItems: push lands on the global stack and survives unmount", async () => {
    await expectPushThenUnmount(
      <ScheduleItemsProvider dataService={scheduleDS}>
        <ScheduleProbe />
      </ScheduleItemsProvider>,
      true,
    );
  });

  it("dailies: push lands on the global stack and survives unmount", async () => {
    await expectPushThenUnmount(
      <DailiesUnifiedProvider dataService={dailyDS}>
        <DailyProbe />
      </DailiesUnifiedProvider>,
      true,
    );
  });

  it("notes: push lands on the global stack and survives unmount", async () => {
    await expectPushThenUnmount(
      <NotesUnifiedProvider dataService={noteDS}>
        <NoteProbe />
      </NotesUnifiedProvider>,
      true,
    );
  });

  // Regression for the child-1 unmount-clear effect: it depended on the
  // reactive context value, so its cleanup re-ran after every push and wiped
  // the history immediately ("canUndo" never survived a mutation).
  // The tree writes are the snapshot kind (#1727), so this is the one domain
  // whose command does NOT outlive its provider.
  it("todoTree: push survives its own push, and expires on unmount", async () => {
    await expectPushThenUnmount(
      <TodoTreeProvider dataService={todoDS}>
        <TodoProbe />
      </TodoTreeProvider>,
      false,
    );
  });

  // D-20260810-refactor-1: routines were the one domain whose API hook pushed
  // commands with nowhere to push them — the Provider never read the ambient
  // stack, so every routine command was a no-op. Ctrl+Z on a routine did
  // nothing at all, which is the behaviour this fixes.
  it("routines: push lands on the global stack and survives unmount", async () => {
    await expectPushThenUnmount(
      <RoutineProvider dataService={routineDS}>
        <RoutineProbe />
      </RoutineProvider>,
      true,
    );
  });

  /*
   * #1800: #1667 put tag assign / unassign on the stack, but the pickup of the
   * ambient history sat inside the API hook rather than here, and every suite
   * for it injected an `undoRedo` prop — so the wiring the APP uses had no
   * cover at all. These two say it out loud: a tag change with no explicit
   * prop reaches the global stack, and it is still reversible after the user
   * walks to another section (tag commands name their row by id, so the
   * unmount-expire leaves them standing).
   */
  it("tags: push lands on the global stack and survives unmount", async () => {
    await expectPushThenUnmount(
      <WikiTagsUnifiedProvider dataService={makeTagsDS().ds}>
        <TagsProbe />
      </WikiTagsUnifiedProvider>,
      true,
    );
  });

  it("tags: the global Undo takes the tag back off the item", async () => {
    const { ds, calls } = makeTagsDS();
    render(
      <Harness
        mounted
        domain={
          <WikiTagsUnifiedProvider dataService={ds}>
            <TagsProbe />
          </WikiTagsUnifiedProvider>
        }
      />,
    );
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByText("mutate"));
    });
    expect(screen.getByTestId("tag-count").textContent).toBe("1");

    // The header button, not the mutator: this is the path a user has.
    await act(async () => {
      fireEvent.click(screen.getByText("undo"));
    });
    expect(calls).toEqual(["assign", "unassign"]);
    expect(screen.getByTestId("tag-count").textContent).toBe("0");
  });

  /*
   * #1727 — the reported trip: do something in a section, walk to another
   * one, come back, press Undo. Before this the history was wiped on the way
   * out and the button came back dead, with the change still in the DB.
   *
   * The assertion is the WRITE, not just the button: a command that outlives
   * its provider has to reverse the row it named, whichever provider instance
   * is on screen when it runs.
   */
  it("leaving a section and returning keeps the undo, and it still writes", async () => {
    const deleted: string[] = [];
    const ds = {
      fetchScheduleItemsByDateAll: async () => [],
      fetchDeletedScheduleItems: async () => [],
      createScheduleItem: async () => ({ date: "" }),
      softDeleteScheduleItem: async (id: string) => {
        deleted.push(id);
      },
      restoreScheduleItem: async () => {},
    } as unknown as DataService;
    const domain = (
      <ScheduleItemsProvider dataService={ds}>
        <ScheduleProbe />
      </ScheduleItemsProvider>
    );

    const { rerender } = render(<Harness mounted domain={domain} />);
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByText("mutate"));
    });

    // …to another section…
    rerender(<Harness mounted={false} domain={domain} />);
    await act(async () => {});
    expect(screen.getByTestId("can-undo").textContent).toBe("true");

    // …and back. The provider is a NEW instance; the command is the old one.
    rerender(<Harness mounted domain={domain} />);
    await act(async () => {});
    expect(screen.getByTestId("can-undo").textContent).toBe("true");

    await act(async () => {
      fireEvent.click(screen.getByText("undo"));
    });
    // The created row was soft-deleted — the undo reached the DataService.
    expect(deleted).toHaveLength(1);
    expect(screen.getByTestId("can-undo").textContent).toBe("false");
  });

  /*
   * The other half of #1727: history dies with the DATA it describes. Every
   * command holds ids belonging to the account that pushed it, so a switch of
   * account must not leave them pointing at someone else's rows.
   */
  it("drops the whole stack when the account behind it changes", async () => {
    const domain = (
      <DailiesUnifiedProvider dataService={dailyDS}>
        <DailyProbe />
      </DailiesUnifiedProvider>
    );
    const { rerender } = render(
      <UndoRedoProvider identityKey="user-a">
        <CanUndoProbe />
        <SyncStub>{domain}</SyncStub>
      </UndoRedoProvider>,
    );
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByText("mutate"));
    });
    expect(screen.getByTestId("can-undo").textContent).toBe("true");

    // Same tree, different account.
    rerender(
      <UndoRedoProvider identityKey="user-b">
        <CanUndoProbe />
        <SyncStub>{domain}</SyncStub>
      </UndoRedoProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId("can-undo").textContent).toBe("false");
  });

  it("keeps the stack while the account stays the same", async () => {
    const domain = (
      <DailiesUnifiedProvider dataService={dailyDS}>
        <DailyProbe />
      </DailiesUnifiedProvider>
    );
    const view = (
      <UndoRedoProvider identityKey="user-a">
        <CanUndoProbe />
        <SyncStub>{domain}</SyncStub>
      </UndoRedoProvider>
    );
    const { rerender } = render(view);
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByText("mutate"));
    });
    // A re-render with the same key must not read as "the data was replaced".
    rerender(view);
    await act(async () => {});
    expect(screen.getByTestId("can-undo").textContent).toBe("true");
  });

  it("explicit undoRedo prop wins over the ambient stack and is not touched on unmount", async () => {
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

  // StrictMode double-mounts run the expiry cleanup once mid-mount (on an
  // empty stack — harmless); a push afterwards must still survive, and now
  // survives the unmount too (#1727 — notes push by-id commands).
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
    expect(screen.getByTestId("can-undo").textContent).toBe("true");
  });
});
