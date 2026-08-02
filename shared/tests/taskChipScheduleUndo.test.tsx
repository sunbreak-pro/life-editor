import { describe, it, expect } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { type ReactNode } from "react";
import { UndoRedoProvider } from "../src/context/UndoRedoContext";
import { useUndoRedoContext } from "../src/hooks/useUndoRedoContext";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import { TaskTreeProvider } from "../src/context/TaskTreeContext";
import { useTaskTreeContext } from "../src/hooks/useTaskTreeContext";
import { TASK_HISTORY_LABELS } from "../src/hooks/useTaskTreeHistory";
import en from "../src/i18n/locales/en.json";
import ja from "../src/i18n/locales/ja.json";
import type { DataService } from "../src/services/DataService";
import type { TaskNode } from "../src/types/taskTree";

/*
 * #569 — the Schedule section's task-chip gestures are undoable.
 *
 * They all write through `updateNode`, which persists SILENTLY (no undo
 * command) because the Tasks board saves titles and bodies through the same
 * call as the user types. So the fix is per-call opt-in, and these tests pin
 * both halves of it: the Schedule gestures push, and the Tasks-side call next
 * to them still does not.
 *
 * The undo itself is asserted on the tree the provider hands its consumers —
 * the calendar chips are a pure derivation of that array (tasksToCalendarChips
 * over `nodes`), so a restored node IS a restored chip — and on what reached
 * the DataService, since a rollback that never leaves React comes back on the
 * next reload.
 */

const PLACED: TaskNode = {
  id: "task-placed",
  type: "task",
  title: "write the report",
  parentId: null,
  order: 0,
  status: "NOT_STARTED",
  createdAt: "2026-03-01T00:00:00.000Z",
  scheduledAt: "2026-03-09T09:00:00.000Z",
  scheduledEndAt: "2026-03-09T10:00:00.000Z",
  isAllDay: false,
};

/** The #298 staging shape: on the calendar, day known, time still TBD. */
const CANDIDATE: TaskNode = {
  id: "task-candidate",
  type: "task",
  title: "call the dentist",
  parentId: null,
  order: 1,
  status: "NOT_STARTED",
  createdAt: "2026-03-01T00:00:00.000Z",
  scheduledAt: "2026-03-09T00:00:00.000Z",
  isAllDay: true,
};

/** Never been near the calendar — what the tray's "add from tasks" offers. */
const UNSCHEDULED: TaskNode = {
  id: "task-unscheduled",
  type: "task",
  title: "book the flights",
  parentId: null,
  order: 2,
  status: "NOT_STARTED",
  createdAt: "2026-03-01T00:00:00.000Z",
};

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

function makeTaskDS() {
  const synced: TaskNode[][] = [];
  const ds = {
    fetchTaskTree: async () => [PLACED, CANDIDATE, UNSCHEDULED],
    fetchDeletedTasks: async () => [],
    syncTaskTree: async (nodes: TaskNode[]) => {
      synced.push(nodes);
    },
  } as unknown as DataService;
  /** The tree as the last write left it in the DB. */
  const lastSynced = (id: string) =>
    synced[synced.length - 1]?.find((n) => n.id === id);
  return { ds, synced, lastSynced };
}

/**
 * Stands in for CalendarTab: the same four writes its handlers make
 * (web/src/schedule/CalendarTab.tsx — handleTaskChipMove / Resize /
 * DropAllDay / handleTodoAddCandidate), plus the Tasks-board title save that
 * must stay out of the history (KanbanView.tsx:447).
 */
function ChipProbe() {
  const { nodes, updateNode } = useTaskTreeContext();
  const placed = nodes.find((n) => n.id === PLACED.id);
  const candidate = nodes.find((n) => n.id === CANDIDATE.id);
  const unscheduled = nodes.find((n) => n.id === UNSCHEDULED.id);
  return (
    <>
      <span data-testid="placed">
        {`${placed?.scheduledAt ?? "-"}|${placed?.scheduledEndAt ?? "-"}|${String(
          placed?.isAllDay,
        )}`}
      </span>
      <span data-testid="candidate">
        {`${candidate?.scheduledAt ?? "-"}|${String(candidate?.isAllDay)}`}
      </span>
      <span data-testid="unscheduled">
        {`${unscheduled?.scheduledAt ?? "-"}|${String(unscheduled?.isAllDay)}`}
      </span>
      <span data-testid="placed-title">{placed?.title ?? "-"}</span>

      {/* All-day chip dragged into the time body (A-3 "place"). */}
      <button
        onClick={() =>
          updateNode(
            CANDIDATE.id,
            {
              scheduledAt: "2026-03-09T14:00:00.000Z",
              scheduledEndAt: "2026-03-09T15:00:00.000Z",
              isAllDay: false,
            },
            { undoLabel: "taskChipPlace" },
          )
        }
      >
        place
      </button>
      {/* Timed chip dragged to another slot. */}
      <button
        onClick={() =>
          updateNode(
            PLACED.id,
            {
              scheduledAt: "2026-03-10T13:00:00.000Z",
              scheduledEndAt: "2026-03-10T14:00:00.000Z",
              isAllDay: false,
            },
            { undoLabel: "taskChipMove" },
          )
        }
      >
        move
      </button>
      {/* Bottom handle dragged down — only the end moves. */}
      <button
        onClick={() =>
          updateNode(
            PLACED.id,
            { scheduledEndAt: "2026-03-09T11:30:00.000Z" },
            { undoLabel: "taskChipResize" },
          )
        }
      >
        resize
      </button>
      {/* Dropped back on the all-day lane (#562). */}
      <button
        onClick={() =>
          updateNode(
            PLACED.id,
            { scheduledAt: "2026-03-09T00:00:00.000Z", isAllDay: true },
            { undoLabel: "taskChipAllDay" },
          )
        }
      >
        to-all-day
      </button>
      {/* Tray "add to today". */}
      <button
        onClick={() =>
          updateNode(
            UNSCHEDULED.id,
            { scheduledAt: "2026-03-09T00:00:00.000Z", isAllDay: true },
            { undoLabel: "taskAddToToday" },
          )
        }
      >
        add-today
      </button>
      {/* A drag released where it started: same values back. */}
      <button
        onClick={() =>
          updateNode(
            PLACED.id,
            {
              scheduledAt: PLACED.scheduledAt,
              scheduledEndAt: PLACED.scheduledEndAt,
              isAllDay: false,
            },
            { undoLabel: "taskChipMove" },
          )
        }
      >
        no-op-drag
      </button>
      {/* Tasks board title save — the path that must stay silent. */}
      <button onClick={() => updateNode(PLACED.id, { title: "renamed" })}>
        rename
      </button>
    </>
  );
}

function UndoProbe() {
  const { undo, redo, canUndo } = useUndoRedoContext();
  return (
    <>
      <span data-testid="can-undo">{String(canUndo())}</span>
      <button onClick={() => undo()}>undo</button>
      <button onClick={() => redo()}>redo</button>
    </>
  );
}

async function mount(ds: DataService, onApplied?: (label: string) => void) {
  render(
    <UndoRedoProvider
      onCommandApplied={(_direction, label) => onApplied?.(label)}
    >
      <UndoProbe />
      <SyncStub>
        <TaskTreeProvider dataService={ds}>
          <ChipProbe />
        </TaskTreeProvider>
      </SyncStub>
    </UndoRedoProvider>,
  );
  // Flush the provider's initial fetch — until it lands, every write is
  // dropped by the not-loaded guard (useTaskTreeAPI).
  await act(async () => {});
}

const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByText(name));
  });
};

const placed = () => screen.getByTestId("placed").textContent;
const candidate = () => screen.getByTestId("candidate").textContent;
const unscheduled = () => screen.getByTestId("unscheduled").textContent;
const canUndo = () => screen.getByTestId("can-undo").textContent;

describe("Schedule task-chip writes are undoable (#569)", () => {
  it("place: undo returns the chip to the all-day lane", async () => {
    const { ds, lastSynced } = makeTaskDS();
    await mount(ds);
    expect(canUndo()).toBe("false");

    await click("place");
    expect(canUndo()).toBe("true");
    expect(candidate()).toBe("2026-03-09T14:00:00.000Z|false");

    await click("undo");
    // Back to "today, time TBD" — scheduledEndAt included: a leftover end on
    // an all-day candidate is what the next place is supposed to write.
    expect(candidate()).toBe("2026-03-09T00:00:00.000Z|true");
    expect(lastSynced(CANDIDATE.id)?.isAllDay).toBe(true);
    expect(lastSynced(CANDIDATE.id)?.scheduledEndAt).toBeUndefined();

    await click("redo");
    expect(candidate()).toBe("2026-03-09T14:00:00.000Z|false");
  });

  it("move: undo restores BOTH ends and the original day", async () => {
    const { ds, lastSynced } = makeTaskDS();
    await mount(ds);

    await click("move");
    expect(placed()).toBe(
      "2026-03-10T13:00:00.000Z|2026-03-10T14:00:00.000Z|false",
    );

    await click("undo");
    expect(placed()).toBe(
      "2026-03-09T09:00:00.000Z|2026-03-09T10:00:00.000Z|false",
    );
    expect(lastSynced(PLACED.id)?.scheduledAt).toBe(PLACED.scheduledAt);
    expect(lastSynced(PLACED.id)?.scheduledEndAt).toBe(PLACED.scheduledEndAt);
  });

  it("resize: undo restores the end and leaves the start alone", async () => {
    const { ds } = makeTaskDS();
    await mount(ds);

    await click("resize");
    expect(placed()).toBe(
      "2026-03-09T09:00:00.000Z|2026-03-09T11:30:00.000Z|false",
    );

    await click("undo");
    expect(placed()).toBe(
      "2026-03-09T09:00:00.000Z|2026-03-09T10:00:00.000Z|false",
    );
  });

  it("drop on the all-day lane: undo restores the timed span (#562)", async () => {
    const { ds } = makeTaskDS();
    await mount(ds);

    await click("to-all-day");
    expect(placed()).toBe(
      "2026-03-09T00:00:00.000Z|2026-03-09T10:00:00.000Z|true",
    );

    await click("undo");
    expect(placed()).toBe(
      "2026-03-09T09:00:00.000Z|2026-03-09T10:00:00.000Z|false",
    );
  });

  it("add to today: undo takes the task back off the calendar entirely", async () => {
    const { ds, lastSynced } = makeTaskDS();
    await mount(ds);

    await click("add-today");
    expect(unscheduled()).toBe("2026-03-09T00:00:00.000Z|true");

    await click("undo");
    // Not "all-day on today with no time" — unscheduled. The task has to leave
    // the tray, which reads scheduledAt to decide the row exists at all.
    expect(unscheduled()).toBe("-|undefined");
    expect(lastSynced(UNSCHEDULED.id)?.scheduledAt).toBeUndefined();
    expect(lastSynced(UNSCHEDULED.id)?.isAllDay).toBeUndefined();

    await click("redo");
    expect(unscheduled()).toBe("2026-03-09T00:00:00.000Z|true");
  });

  // The label is a KEY the host looks up (UndoRedoHost.tsx), and a missing
  // entry does not throw — i18next falls back to the raw key, so the toast
  // reads "Undid: taskChipMove". Nothing on screen says it is broken, which is
  // exactly why this is worth a lockstep test rather than a review habit.
  it("every label has copy in both catalogs", () => {
    const enLabels = en.undoRedo.labels as Record<string, string | undefined>;
    const jaLabels = ja.undoRedo.labels as Record<string, string | undefined>;
    for (const label of TASK_HISTORY_LABELS) {
      expect(enLabels[label], `en: ${label}`).toBeTruthy();
      expect(jaLabels[label], `ja: ${label}`).toBeTruthy();
    }
  });

  it("reports each gesture under its own label", async () => {
    const applied: string[] = [];
    const { ds } = makeTaskDS();
    await mount(ds, (label) => applied.push(label));

    await click("move");
    await click("undo");
    await click("redo");
    // Same command both ways — the toast names the gesture, not the direction.
    expect(applied).toEqual(["taskChipMove", "taskChipMove"]);

    await click("add-today");
    await click("undo");
    expect(applied[applied.length - 1]).toBe("taskAddToToday");
  });

  // Regression guard for the Tasks side (#569 DoD): the board saves a title on
  // every keystroke through this same updateNode. Making the call undoable
  // wholesale would have filled the single global stack with half-typed words
  // and pushed every real action out of reach.
  it("a plain updateNode (Tasks board) still pushes nothing", async () => {
    const { ds, synced } = makeTaskDS();
    await mount(ds);

    await click("rename");
    expect(screen.getByTestId("placed-title").textContent).toBe("renamed");
    // The write happened — it is only the history that stays out of it.
    expect(synced).toHaveLength(1);
    expect(canUndo()).toBe("false");
  });

  // A drag released back on the slot it started from still commits (the grid
  // only checks that the pointer moved). Pushing there would answer Ctrl+Z
  // with a toast and no visible change, and swallow the press meant for the
  // user's previous action.
  it("a no-op drag writes but does not push", async () => {
    const { ds, synced } = makeTaskDS();
    await mount(ds);

    await click("no-op-drag");
    expect(synced).toHaveLength(1);
    expect(canUndo()).toBe("false");
  });

  // The stack is global and shared, so an undo has to reverse the LAST thing
  // that happened — not whatever the Schedule did most recently.
  it("undo walks back through the gestures one at a time", async () => {
    const { ds } = makeTaskDS();
    await mount(ds);

    await click("move");
    await click("resize");
    expect(placed()).toBe(
      "2026-03-10T13:00:00.000Z|2026-03-09T11:30:00.000Z|false",
    );

    await click("undo");
    expect(placed()).toBe(
      "2026-03-10T13:00:00.000Z|2026-03-10T14:00:00.000Z|false",
    );

    await click("undo");
    expect(placed()).toBe(
      "2026-03-09T09:00:00.000Z|2026-03-09T10:00:00.000Z|false",
    );
    expect(canUndo()).toBe("false");
  });
});
