import { useMemo, useState } from "react";
import type { RoutineGroup } from "../../../../types/routineGroup";
import type { ScheduleItem } from "../../../../types/schedule";
import type { TaskNode } from "../../../../types/taskTree";
import type { DayFlowFilterTab } from "./dayFlowFilters";

export interface DayFlowFiltersResult {
  selectedFilterGroupIds: string[];
  setSelectedFilterGroupIds: React.Dispatch<React.SetStateAction<string[]>>;
  filteredScheduleItems: ScheduleItem[];
  filteredDayTasks: TaskNode[];
  allDayTasks2: TaskNode[];
  allDayScheduleItems: ScheduleItem[];
  timedScheduleItems: ScheduleItem[];
  hasAllDayItems: boolean;
}

export function useDayFlowFilters(params: {
  scheduleItems: ScheduleItem[];
  allDayTasks: TaskNode[];
  activeFilters: Set<DayFlowFilterTab>;
  groupForRoutine: Map<string, RoutineGroup[]>;
}): DayFlowFiltersResult {
  const { scheduleItems, allDayTasks, activeFilters, groupForRoutine } = params;

  const [selectedFilterGroupIds, setSelectedFilterGroupIds] = useState<
    string[]
  >([]);

  const showAll = activeFilters.size === 0;

  const filteredScheduleItems = useMemo(() => {
    let items = scheduleItems;
    if (!showAll) {
      const showRoutine = activeFilters.has("routine");
      const showEvents = activeFilters.has("events");
      if (!showRoutine && !showEvents) {
        items = [];
      } else {
        items = items.filter((i) => {
          const isRoutine = i.routineId !== null;
          return isRoutine ? showRoutine : showEvents;
        });
      }
    }
    if (selectedFilterGroupIds.length > 0) {
      items = items.filter((i) => {
        if (!i.routineId) return false;
        const groups = groupForRoutine.get(i.routineId);
        return groups
          ? groups.some((g) => selectedFilterGroupIds.includes(g.id))
          : false;
      });
    }
    return items;
  }, [
    scheduleItems,
    showAll,
    activeFilters,
    selectedFilterGroupIds,
    groupForRoutine,
  ]);

  const filteredDayTasks = useMemo(() => {
    if (!showAll && !activeFilters.has("tasks")) return [];
    return allDayTasks;
  }, [allDayTasks, showAll, activeFilters]);

  const allDayTasks2 = useMemo(
    () => filteredDayTasks.filter((t) => t.isAllDay),
    [filteredDayTasks],
  );

  const allDayScheduleItems = useMemo(
    () => filteredScheduleItems.filter((si) => si.isAllDay),
    [filteredScheduleItems],
  );

  const timedScheduleItems = useMemo(
    () => filteredScheduleItems.filter((si) => !si.isAllDay),
    [filteredScheduleItems],
  );

  const hasAllDayItems =
    allDayTasks2.length > 0 || allDayScheduleItems.length > 0;

  return {
    selectedFilterGroupIds,
    setSelectedFilterGroupIds,
    filteredScheduleItems,
    filteredDayTasks,
    allDayTasks2,
    allDayScheduleItems,
    timedScheduleItems,
    hasAllDayItems,
  };
}
