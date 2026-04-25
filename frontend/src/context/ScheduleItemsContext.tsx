import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useScheduleItems } from "../hooks/useScheduleItems";
import { useRoutineContext } from "../hooks/useRoutineContext";
import { useSyncContext } from "../hooks/useSyncContext";
import { ScheduleItemsContext } from "./ScheduleItemsContextValue";

export function ScheduleItemsProvider({ children }: { children: ReactNode }) {
  const { routines, isLoading, groupForRoutine } = useRoutineContext();
  const { syncVersion } = useSyncContext();
  const scheduleItemsState = useScheduleItems();

  // Sync schedule items when routine times change
  useEffect(() => {
    if (routines.length > 0) {
      scheduleItemsState.syncScheduleItemsWithRoutines(routines);
    }
  }, [routines, scheduleItemsState.syncScheduleItemsWithRoutines]);

  // Backfill missed routine items and pre-generate future items on startup
  const backfillDoneRef = useRef(false);
  useEffect(() => {
    if (backfillDoneRef.current || isLoading || routines.length === 0) return;
    backfillDoneRef.current = true;
    const r = routines;
    const gfr = groupForRoutine;
    scheduleItemsState.backfillMissedRoutineItems(r, gfr).then(() => {
      scheduleItemsState.ensureRoutineItemsForWeek(r, gfr);
    });
  }, [
    routines,
    isLoading,
    groupForRoutine,
    scheduleItemsState.backfillMissedRoutineItems,
    scheduleItemsState.ensureRoutineItemsForWeek,
  ]);

  // Reload current date items when sync pulls new data
  const syncVersionRef = useRef(syncVersion);
  useEffect(() => {
    if (syncVersionRef.current === syncVersion) return;
    syncVersionRef.current = syncVersion;
    scheduleItemsState.loadItemsForDate(scheduleItemsState.currentDate);
  }, [syncVersion, scheduleItemsState]);

  return (
    <ScheduleItemsContext.Provider value={scheduleItemsState}>
      {children}
    </ScheduleItemsContext.Provider>
  );
}
