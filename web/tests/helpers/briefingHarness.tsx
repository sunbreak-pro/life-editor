import { createElement, type ReactNode } from "react";
import { vi } from "vitest";
import {
  UndoRedoContext,
  type DataService,
  type ScheduleItem,
  type TodoNode,
  type UndoRedoContextValue,
} from "@life-editor/shared";
import { createBumpableSync, type BumpableSyncHandle } from "./index";

/*
 * Test harness for Briefing's data layer (#892).
 *
 * `useBriefingData` needs two contexts and seven read methods before it will
 * run at all: SyncContext (its refetch key), the OPTIONAL UndoRedo context
 * (row deletes push commands onto it), and one DataService method per source
 * the initial fetch fans out to. Written per suite that is thirty lines of
 * setup before the first assertion, three times over — and, worse, three
 * chances for a suite to quietly stub six of the seven reads and have the
 * effect throw inside `Promise.allSettled` where nothing reports it.
 *
 * The UndoRedo stub RECORDS rather than executes: what a delete owes the user
 * is a command that puts the row back, so the suites assert on the recorded
 * command and then call its `undo` themselves. A real provider would work too,
 * but it would answer "did the stack accept something" instead of "is what it
 * accepted the right thing".
 */

/** A command captured off the UndoRedo context, with the domain it was filed under. */
export interface PushedCommand {
  domain: string;
  label: string;
  undo: () => void;
  redo: () => void;
}

export interface BriefingHarness {
  /** Move Realtime counters — see createBumpableSync. */
  sync: BumpableSyncHandle;
  /** Undo commands pushed so far, in order. */
  commands: PushedCommand[];
  /** Pass straight to `renderHook(..., { wrapper })`. */
  wrapper: ({
    children,
  }: {
    children: ReactNode;
  }) => ReturnType<typeof createElement>;
}

export function createBriefingHarness(): BriefingHarness {
  const { sync, wrapper: SyncWrapper } = createBumpableSync();
  const commands: PushedCommand[] = [];
  const undoRedo: UndoRedoContextValue = {
    push: (domain, command) => {
      commands.push({ domain, ...command });
    },
    undo: () => {},
    redo: () => {},
    canUndo: () => false,
    canRedo: () => false,
    clear: () => {},
  };

  function BriefingWrapper({ children }: { children: ReactNode }) {
    return createElement(
      SyncWrapper,
      null,
      createElement(UndoRedoContext.Provider, { value: undoRedo }, children),
    );
  }

  return { sync, commands, wrapper: BriefingWrapper };
}

export interface BriefingReadSeed {
  /** Schedule rows keyed by date — the hook fetches today AND tomorrow. */
  scheduleByDate?: Record<string, ScheduleItem[]>;
  todos?: TodoNode[];
  sessions?: unknown[];
  /** Stored daily body, or null for "no daily yet". */
  dailyContent?: string | null;
  notes?: unknown[];
  connections?: unknown[];
}

/**
 * The seven reads the initial fetch makes, as vi mocks. Spread into
 * `stubDataService` alongside whatever writes the suite is about.
 */
export function briefingReads(
  seed: BriefingReadSeed = {},
): Record<string, unknown> {
  const {
    scheduleByDate = {},
    todos = [],
    sessions = [],
    dailyContent = null,
    notes = [],
    connections = [],
  } = seed;
  return {
    fetchScheduleItemsByDate: vi
      .fn()
      .mockImplementation((date: string) =>
        Promise.resolve(scheduleByDate[date] ?? []),
      ),
    fetchTodoTree: vi.fn().mockResolvedValue(todos),
    fetchTimerSessions: vi.fn().mockResolvedValue(sessions),
    getDailyByDateUnified: vi
      .fn()
      .mockResolvedValue(
        dailyContent === null ? null : { content: dailyContent },
      ),
    listNotesUnified: vi.fn().mockResolvedValue(notes),
    listAllTagConnections: vi.fn().mockResolvedValue(connections),
  };
}

/** A live schedule row on `date`; every field the aggregation reads is explicit. */
export function scheduleItem(
  over: Partial<ScheduleItem> & { id: string; date: string },
): ScheduleItem {
  return {
    title: over.id,
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    ...over,
  } as ScheduleItem;
}

/** Read a DataService mock back as a vi mock without repeating the cast. */
export function mockOf(
  ds: DataService,
  name: keyof DataService,
): ReturnType<typeof vi.fn> {
  return ds[name] as unknown as ReturnType<typeof vi.fn>;
}
