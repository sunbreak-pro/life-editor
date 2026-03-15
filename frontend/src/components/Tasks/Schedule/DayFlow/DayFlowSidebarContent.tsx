import { useState } from "react";
import type { DayFlowFilterTab } from "./OneDaySchedule";
import type { RoutineNode } from "../../../../types/routine";
import type { ScheduleItem } from "../../../../types/schedule";
import { MiniRoutineFlow } from "../Routine/MiniRoutineFlow";
import { RoutineManagementOverlay } from "../Routine/RoutineManagementOverlay";
import { ProgressSection } from "../shared/ProgressSection";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";

export interface CategoryProgress {
  completed: number;
  total: number;
}

interface DayFlowSidebarContentProps {
  date: Date;
  activeFilter: DayFlowFilterTab;
  onFilterChange: (tab: DayFlowFilterTab) => void;
  categoryProgress: Record<DayFlowFilterTab, CategoryProgress>;
  routines: RoutineNode[];
  tagAssignments: Map<string, number[]>;
  scheduleItems: ScheduleItem[];
  onToggleComplete: (id: string) => void;
}

export function DayFlowSidebarContent({
  date,
  activeFilter,
  onFilterChange,
  categoryProgress,
  routines,
  tagAssignments,
  scheduleItems,
  onToggleComplete,
}: DayFlowSidebarContentProps) {
  const [showManagement, setShowManagement] = useState(false);
  const {
    routineTags,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    setTagsForRoutine,
    getRoutineCompletionRate,
    createRoutineTag,
    updateRoutineTag,
    deleteRoutineTag,
  } = useScheduleContext();

  return (
    <div className="flex flex-col gap-3">
      <ProgressSection
        date={date}
        categoryProgress={categoryProgress}
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
      />

      {/* Mini Routine Flow */}
      <div className="px-3">
        <MiniRoutineFlow
          routines={routines}
          scheduleItems={scheduleItems}
          tagAssignments={tagAssignments}
          onToggleComplete={onToggleComplete}
          onOpenManagement={() => setShowManagement(true)}
        />
      </div>

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
          onClose={() => setShowManagement(false)}
        />
      )}
    </div>
  );
}
