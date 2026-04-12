import { useMemo } from "react";
import type { ScheduleItemsContextValue } from "../context/ScheduleItemsContextValue";
import { useScheduleItemsCore } from "./useScheduleItemsCore";
import { useScheduleItemsEvents } from "./useScheduleItemsEvents";
import { useScheduleItemsStats } from "./useScheduleItemsStats";
import { useScheduleItemsRoutineSync } from "./useScheduleItemsRoutineSync";

export function useScheduleItems(): ScheduleItemsContextValue {
  const eventsHook = useScheduleItemsEvents();
  const core = useScheduleItemsCore(eventsHook._setEvents);
  const stats = useScheduleItemsStats(
    core.scheduleItems,
    core.monthlyScheduleItems,
  );
  const sync = useScheduleItemsRoutineSync(core._handles);

  return useMemo(
    () => ({
      // Core
      scheduleItems: core.scheduleItems,
      currentDate: core.currentDate,
      setCurrentDate: core.setCurrentDate,
      loadItemsForDate: core.loadItemsForDate,
      createScheduleItem: core.createScheduleItem,
      updateScheduleItem: core.updateScheduleItem,
      deleteScheduleItem: core.deleteScheduleItem,
      dismissScheduleItem: core.dismissScheduleItem,
      undismissScheduleItem: core.undismissScheduleItem,
      toggleComplete: core.toggleComplete,
      monthlyScheduleItems: core.monthlyScheduleItems,
      loadScheduleItemsForMonth: core.loadScheduleItemsForMonth,
      scheduleItemsVersion: core.scheduleItemsVersion,
      // Events
      events: eventsHook.events,
      loadEvents: eventsHook.loadEvents,
      eventsVersion: eventsHook.eventsVersion,
      bumpEventsVersion: eventsHook.bumpEventsVersion,
      // Stats
      routineStats: stats.routineStats,
      refreshRoutineStats: stats.refreshRoutineStats,
      getRoutineCompletionRate: stats.getRoutineCompletionRate,
      getRoutineCompletionByDate: stats.getRoutineCompletionByDate,
      // RoutineSync
      ensureRoutineItemsForDate: sync.ensureRoutineItemsForDate,
      ensureRoutineItemsForWeek: sync.ensureRoutineItemsForWeek,
      ensureRoutineItemsForDateRange: sync.ensureRoutineItemsForDateRange,
      backfillMissedRoutineItems: sync.backfillMissedRoutineItems,
      syncScheduleItemsWithRoutines: sync.syncScheduleItemsWithRoutines,
      reconcileRoutineScheduleItems: sync.reconcileRoutineScheduleItems,
    }),
    [
      core.scheduleItems,
      core.currentDate,
      core.setCurrentDate,
      core.loadItemsForDate,
      core.createScheduleItem,
      core.updateScheduleItem,
      core.deleteScheduleItem,
      core.dismissScheduleItem,
      core.undismissScheduleItem,
      core.toggleComplete,
      core.monthlyScheduleItems,
      core.loadScheduleItemsForMonth,
      core.scheduleItemsVersion,
      eventsHook.events,
      eventsHook.loadEvents,
      eventsHook.eventsVersion,
      eventsHook.bumpEventsVersion,
      stats.routineStats,
      stats.refreshRoutineStats,
      stats.getRoutineCompletionRate,
      stats.getRoutineCompletionByDate,
      sync.ensureRoutineItemsForDate,
      sync.ensureRoutineItemsForWeek,
      sync.ensureRoutineItemsForDateRange,
      sync.backfillMissedRoutineItems,
      sync.syncScheduleItemsWithRoutines,
      sync.reconcileRoutineScheduleItems,
    ],
  );
}
