import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useScheduleItems } from "../hooks/useScheduleItems";
import { useRoutineContext } from "../hooks/useRoutineContext";
import { ScheduleItemsContext } from "./ScheduleItemsContextValue";

export function ScheduleItemsProvider({ children }: { children: ReactNode }) {
  const { routines, isLoading, tagAssignments, groupForRoutine } =
    useRoutineContext();
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
    const ta = tagAssignments;
    const r = routines;
    const gfr = groupForRoutine;
    scheduleItemsState.backfillMissedRoutineItems(r, ta, gfr).then(() => {
      scheduleItemsState.ensureRoutineItemsForWeek(r, ta, gfr);
    });
  }, [
    routines,
    isLoading,
    tagAssignments,
    scheduleItemsState.backfillMissedRoutineItems,
    scheduleItemsState.ensureRoutineItemsForWeek,
  ]);

  return (
    <ScheduleItemsContext.Provider value={scheduleItemsState}>
      {children}
    </ScheduleItemsContext.Provider>
  );
}
