import { createContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ScheduleItem, RoutineStats } from "../types/schedule";
import type { RoutineNode } from "../types/routine";
import type { RoutineGroup } from "../types/routineGroup";

export interface ScheduleItemsContextValue {
  // Core — state
  scheduleItems: ScheduleItem[];
  currentDate: string;
  setCurrentDate: Dispatch<SetStateAction<string>>;
  monthlyScheduleItems: ScheduleItem[];
  scheduleItemsVersion: number;

  // Core — CRUD
  loadItemsForDate: (date: string) => Promise<void>;
  createScheduleItem: (
    date: string,
    title: string,
    startTime: string,
    endTime: string,
    routineId?: string,
    templateId?: string,
    noteId?: string,
    isAllDay?: boolean,
    content?: string,
    options?: { skipUndo?: boolean },
  ) => string;
  updateScheduleItem: (
    id: string,
    updates: Partial<
      Pick<
        ScheduleItem,
        | "title"
        | "startTime"
        | "endTime"
        | "completed"
        | "completedAt"
        | "memo"
        | "content"
        | "date"
        | "isAllDay"
      >
    >,
    options?: { skipUndo?: boolean },
  ) => void;
  deleteScheduleItem: (id: string, options?: { skipUndo?: boolean }) => void;
  softDeleteScheduleItem: (
    id: string,
    options?: { skipUndo?: boolean },
  ) => void;
  removeScheduleItemsByIds: (ids: string[]) => void;
  deletedScheduleItems: ScheduleItem[];
  loadDeletedScheduleItems: () => Promise<void>;
  restoreScheduleItem: (id: string) => void;
  permanentDeleteScheduleItem: (id: string) => void;
  dismissScheduleItem: (id: string) => void;
  undismissScheduleItem: (id: string) => Promise<void>;
  toggleComplete: (id: string) => void;
  loadScheduleItemsForMonth: (year: number, month: number) => Promise<void>;

  // Events
  events: ScheduleItem[];
  loadEvents: () => Promise<void>;
  eventsVersion: number;
  bumpEventsVersion: () => void;

  // Stats
  routineStats: RoutineStats | null;
  refreshRoutineStats: (routines: RoutineNode[]) => Promise<void>;
  getRoutineCompletionRate: (routineId: string) => {
    completed: number;
    total: number;
  };
  getRoutineCompletionByDate: (date: string) => {
    completed: number;
    total: number;
  };

  // RoutineSync
  ensureRoutineItemsForDate: (
    date: string,
    routines: RoutineNode[],
    groupForRoutine?: Map<string, RoutineGroup[]>,
  ) => Promise<void>;
  ensureRoutineItemsForWeek: (
    routines: RoutineNode[],
    groupForRoutine?: Map<string, RoutineGroup[]>,
  ) => Promise<void>;
  ensureRoutineItemsForDateRange: (
    startDate: string,
    endDate: string,
    routines: RoutineNode[],
    groupForRoutine?: Map<string, RoutineGroup[]>,
  ) => Promise<void>;
  backfillMissedRoutineItems: (
    routines: RoutineNode[],
    groupForRoutine?: Map<string, RoutineGroup[]>,
  ) => Promise<void>;
  syncScheduleItemsWithRoutines: (routines: RoutineNode[]) => void;
  reconcileRoutineScheduleItems: (
    routine: RoutineNode,
    group?: RoutineGroup,
    dateRange?: { startDate: string; endDate: string },
  ) => Promise<void>;
}

export const ScheduleItemsContext =
  createContext<ScheduleItemsContextValue | null>(null);
