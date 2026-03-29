import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { AchievementPanel } from "../Tasks/Schedule/Routine/AchievementPanel";
import { AchievementDetailsOverlay } from "../Tasks/Schedule/Routine/AchievementDetailsOverlay";
import { InProgressTasksList } from "./InProgressTasksList";
import { MiniTodayFlow } from "./MiniTodayFlow";
import { RoutineManagementOverlay } from "../Tasks/Schedule/Routine/RoutineManagementOverlay";
import { useScheduleContext } from "../../hooks/useScheduleContext";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { formatDateKey } from "../../utils/dateKey";
import type { RoutineStats } from "../../types/schedule";

interface ScheduleSidebarContentProps {
  routineStats: RoutineStats | null;
  children: ReactNode;
  onSelectTask?: (taskId: string) => void;
}

export function ScheduleSidebarContent({
  routineStats,
  children,
  onSelectTask,
}: ScheduleSidebarContentProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showManagement, setShowManagement] = useState(false);

  const {
    routines,
    scheduleItems,
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
  } = useScheduleContext();

  const { nodes } = useTaskTreeContext();

  const todayKey = formatDateKey(new Date());
  const todayTasks = useMemo(() => {
    return nodes.filter((n) => {
      if (n.type !== "task" || n.isDeleted || !n.scheduledAt) return false;
      const key = formatDateKey(new Date(n.scheduledAt));
      return key === todayKey;
    });
  }, [nodes, todayKey]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
        <div className="px-3 py-2 space-y-2">
          <MiniTodayFlow
            routines={routines}
            scheduleItems={scheduleItems}
            onToggleComplete={toggleComplete}
            onOpenManagement={() => setShowManagement(true)}
            tasks={todayTasks}
            onSelectTask={onSelectTask}
          />
          <InProgressTasksList onSelectTask={onSelectTask} />
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
          onClose={() => setShowManagement(false)}
        />
      )}
    </div>
  );
}
