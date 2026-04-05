import { useRoutineContext } from "./useRoutineContext";
import { useScheduleItemsContext } from "./useScheduleItemsContext";
import { useCalendarTagsContext } from "./useCalendarTagsContext";

/** Facade hook that combines all three schedule sub-contexts for backward compatibility. */
export function useScheduleContext() {
  const routine = useRoutineContext();
  const scheduleItems = useScheduleItemsContext();
  const calendarTags = useCalendarTagsContext();
  return { ...routine, ...scheduleItems, ...calendarTags };
}
