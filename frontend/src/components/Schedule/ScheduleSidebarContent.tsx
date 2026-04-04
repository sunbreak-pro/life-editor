import { useState, useEffect, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { AchievementPanel } from "../Tasks/Schedule/Routine/AchievementPanel";
import { AchievementDetailsOverlay } from "../Tasks/Schedule/Routine/AchievementDetailsOverlay";
import { InProgressTasksList } from "./InProgressTasksList";
import { MiniTodayFlow } from "./MiniTodayFlow";
import { RoutineManagementOverlay } from "../Tasks/Schedule/Routine/RoutineManagementOverlay";
import { useScheduleContext } from "../../hooks/useScheduleContext";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { formatDateKey } from "../../utils/dateKey";
import { getDataService } from "../../services/dataServiceFactory";
import type { ScheduleItem } from "../../types/schedule";
import type { RoutineStats } from "../../types/schedule";

interface ScheduleSidebarContentProps {
  routineStats: RoutineStats | null;
  activeDate?: Date;
  activeFilters?: Set<string>;
  showManagement?: boolean;
  onShowManagementChange?: (open: boolean) => void;
  children: ReactNode;
  onSelectTask?: (taskId: string) => void;
}

export function ScheduleSidebarContent({
  routineStats,
  activeDate,
  activeFilters,
  showManagement: externalShowManagement,
  onShowManagementChange,
  children,
  onSelectTask,
}: ScheduleSidebarContentProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [internalShowManagement, setInternalShowManagement] = useState(false);
  const showManagement = externalShowManagement ?? internalShowManagement;
  const setShowManagement = onShowManagementChange ?? setInternalShowManagement;

  const [miniFlowDate, setMiniFlowDate] = useState<Date>(
    activeDate ?? new Date(),
  );
  const [sidebarScheduleItems, setSidebarScheduleItems] = useState<
    ScheduleItem[]
  >([]);

  const {
    routines,
    toggleComplete,
    routineTags,
    tagAssignments,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    setTagsForRoutine,
    getRoutineCompletionRate,
    createRoutineTag,
    updateRoutineTag,
    deleteRoutineTag,
    routineGroups,
    groupTagAssignments,
    routinesByGroup,
    groupTimeRange,
    createRoutineGroup,
    updateRoutineGroup,
    deleteRoutineGroup,
    setTagsForGroup,
    skipNextSync,
    scheduleItemsVersion,
    cleanupNonMatchingScheduleItems,
  } = useScheduleContext();

  // Sync miniFlowDate when activeDate changes from parent
  useEffect(() => {
    if (activeDate) setMiniFlowDate(activeDate);
  }, [activeDate]);

  // Load schedule items for the sidebar date independently
  const miniFlowDateKey = formatDateKey(miniFlowDate);
  useEffect(() => {
    getDataService()
      .fetchScheduleItemsByDate(miniFlowDateKey)
      .then(setSidebarScheduleItems)
      .catch(() => setSidebarScheduleItems([]));
  }, [miniFlowDateKey, scheduleItemsVersion]);

  const handlePrevDate = useCallback(() => {
    setMiniFlowDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const handleNextDate = useCallback(() => {
    setMiniFlowDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  const { nodes } = useTaskTreeContext();

  const dateTasks = useMemo(() => {
    return nodes.filter((n) => {
      if (n.type !== "task" || n.isDeleted || !n.scheduledAt) return false;
      const key = formatDateKey(new Date(n.scheduledAt));
      return key === miniFlowDateKey;
    });
  }, [nodes, miniFlowDateKey]);

  // Optimistic toggle: update sidebar items immediately, then persist via context
  const handleToggleComplete = useCallback(
    (id: string) => {
      setSidebarScheduleItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                completed: !item.completed,
                completedAt: !item.completed ? new Date().toISOString() : null,
              }
            : item,
        ),
      );
      toggleComplete(id);
    },
    [toggleComplete],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
        <div className="px-3 py-2 space-y-2">
          <MiniTodayFlow
            date={miniFlowDate}
            routines={routines}
            scheduleItems={sidebarScheduleItems}
            onToggleComplete={handleToggleComplete}
            tasks={dateTasks}
            onSelectTask={onSelectTask}
            onPrevDate={handlePrevDate}
            onNextDate={handleNextDate}
            activeFilters={activeFilters}
          />
          <InProgressTasksList
            date={miniFlowDate}
            onSelectTask={onSelectTask}
          />
        </div>
      </div>

      {routineStats && (
        <div className="px-3 py-2 border-t border-notion-border mt-auto shrink-0">
          <AchievementPanel
            stats={routineStats}
            onShowDetails={() => setShowDetails(true)}
          />
        </div>
      )}

      {showDetails && routineStats && (
        <AchievementDetailsOverlay
          stats={routineStats}
          onClose={() => setShowDetails(false)}
        />
      )}

      {showManagement && (
        <RoutineManagementOverlay
          routines={routines}
          routineTags={routineTags}
          tagAssignments={tagAssignments}
          onCreateRoutine={createRoutine}
          onUpdateRoutine={updateRoutine}
          onDeleteRoutine={deleteRoutine}
          setTagsForRoutine={setTagsForRoutine}
          getCompletionRate={getRoutineCompletionRate}
          onCreateRoutineTag={createRoutineTag}
          onUpdateRoutineTag={updateRoutineTag}
          onDeleteRoutineTag={deleteRoutineTag}
          routineGroups={routineGroups}
          groupTagAssignments={groupTagAssignments}
          routinesByGroup={routinesByGroup}
          groupTimeRange={groupTimeRange}
          onCreateRoutineGroup={createRoutineGroup}
          onUpdateRoutineGroup={updateRoutineGroup}
          onDeleteRoutineGroup={deleteRoutineGroup}
          setTagsForGroup={setTagsForGroup}
          onSkipNextSync={skipNextSync}
          onCleanupNonMatchingScheduleItems={cleanupNonMatchingScheduleItems}
          onClose={() => setShowManagement(false)}
        />
      )}
    </div>
  );
}
