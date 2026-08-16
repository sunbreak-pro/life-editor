import type { DataService } from "@life-editor/shared";
import { useBriefingAggregation } from "./useBriefingAggregation";
import { useBriefingFetch } from "./useBriefingFetch";
import { useBriefingWrites } from "./useBriefingWrites";

/*
 * Data half of the Briefing host — three responsibilities, one entry point
 * (#892; extracted from BriefingScreen.tsx in the earlier hooks split).
 *
 * What used to be 830 lines in one hook is now a composition of three, each
 * with a single job and its own suite:
 *
 *   useBriefingFetch       — the seven reads and the state they land in
 *   useBriefingAggregation — fetched rows → the paper's blocks (pure)
 *   useBriefingWrites      — every mutation, with its optimistic update and
 *                            undo command
 *
 * They are wired together rather than layered: the writes fold their results
 * into the fetch half's state through its setters, and the aggregation reads
 * that same state. So the seam is the STATE, and this file is the only place
 * that knows all three halves exist.
 *
 * The returned surface is unchanged — BriefingScreen destructures exactly what
 * it did before. Any addition here belongs in one of the three, not in this
 * file.
 */
export function useBriefingData(ds: DataService, todayKey: string) {
  const {
    loading,
    scheduleItems,
    setScheduleItems,
    tomorrowItems,
    todoNodes,
    setTodoNodes,
    sessions,
    dailyContent,
    setDailyContent,
    notes,
    connections,
    setConnections,
  } = useBriefingFetch(ds, todayKey);

  const {
    data,
    dateLine,
    remainingTodos,
    upcoming,
    noteOptions,
    todoPlaced,
    todoUnplaced,
    todoAddable,
  } = useBriefingAggregation({
    todayKey,
    scheduleItems,
    tomorrowItems,
    todoNodes,
    sessions,
    dailyContent,
    notes,
    connections,
  });

  const {
    handleToggleScheduleItem,
    handleToggleTodo,
    handleSetTodoStatus,
    handleDeleteScheduleItem,
    handleDeleteTodo,
    deleteScopeItem,
    handleDeleteScopeChoose,
    closeDeleteScope,
    handleCreateEvent,
    handleCreateTodo,
    handlePlaceTodo,
    handleAddTodoCandidate,
  } = useBriefingWrites({
    ds,
    todayKey,
    scheduleItems,
    setScheduleItems,
    todoNodes,
    setTodoNodes,
    setConnections,
  });

  return {
    loading,
    data,
    dateLine,
    dailyContent,
    setDailyContent,
    remainingTodos,
    upcoming,
    handleToggleScheduleItem,
    handleToggleTodo,
    handleSetTodoStatus,
    handleDeleteScheduleItem,
    handleDeleteTodo,
    deleteScopeItem,
    handleDeleteScopeChoose,
    closeDeleteScope,
    noteOptions,
    handleCreateEvent,
    handleCreateTodo,
    handlePlaceTodo,
    todoPlaced,
    todoUnplaced,
    todoAddable,
    handleAddTodoCandidate,
  };
}
