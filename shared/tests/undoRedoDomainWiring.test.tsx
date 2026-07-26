import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { UndoRedoProvider } from "../src/context/UndoRedoContext";
import { useUndoRedoContext } from "../src/hooks/useUndoRedoContext";
import { SyncContext } from "../src/context/SyncContextValue";
import { ScheduleItemsProvider } from "../src/context/ScheduleItemsContext";
import { DailiesUnifiedProvider } from "../src/context/DailiesUnifiedContext";
import { NotesUnifiedProvider } from "../src/context/NotesUnifiedContext";
import { TaskTreeProvider } from "../src/context/TaskTreeContext";
import { useScheduleItemsContext } from "../src/hooks/useScheduleItemsContext";
import { useDailiesUnifiedContext } from "../src/hooks/useDailiesUnifiedContext";
import { useNotesUnifiedContext } from "../src/hooks/useNotesUnifiedContext";
import { useTaskTreeContext } from "../src/hooks/useTaskTreeContext";
import { resetMaterialsSelection } from "../src/state/materialsSelectionStore";
import type { DataService } from "../src/services/DataService";
import type { UndoRedoLike } from "../src/hooks/useTaskTreeHistory";

/*
 * #304 child-2 — domain providers auto-connect to the ambient global UndoRedo
 * stack (useUndoRedoOptional), mirroring TaskTreeProvider. Per domain
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
      value={{ syncVersion: 0, triggerSync: async () => {} }}
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
  const { createFolder } = useNotesUnifiedContext();
  return <button onClick={() => createFolder("F")}>mutate</button>;
}

function TaskProbe() {
  const { addNode } = useTaskTreeContext();
  return <button onClick={() => addNode("task", null, "T")}>mutate</button>;
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
  fetchTaskTree: async () => [],
  fetchDeletedTasks: async () => [],
  syncTaskTree: async () => {},
} as unknown as DataService;

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
      <TaskTreeProvider dataService={taskDS}>
        <TaskProbe />
      </TaskTreeProvider>,
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
