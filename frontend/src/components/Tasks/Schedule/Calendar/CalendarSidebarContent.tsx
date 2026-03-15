import { useState } from "react";
import type { RoutineNode } from "../../../../types/routine";
import type { ScheduleItem } from "../../../../types/schedule";
import type { DayFlowFilterTab } from "../DayFlow/OneDaySchedule";
import type { CategoryProgress } from "../DayFlow/DayFlowSidebarContent";
import type { TabItem } from "../../../shared/SectionTabs";
import { MiniRoutineFlow } from "../Routine/MiniRoutineFlow";
import { RoutineManagementOverlay } from "../Routine/RoutineManagementOverlay";
import { ProgressSection } from "../shared/ProgressSection";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";

const CALENDAR_PROGRESS_TABS: readonly TabItem<DayFlowFilterTab>[] = [
  { id: "all", labelKey: "dayFlow.filterAll" },
  { id: "tasks", labelKey: "dayFlow.filterTasks" },
];

interface CalendarSidebarContentProps {
  progressDate: Date;
  categoryProgress: Record<DayFlowFilterTab, CategoryProgress>;
  activeProgressFilter: DayFlowFilterTab;
  onProgressFilterChange: (tab: DayFlowFilterTab) => void;
  routines: RoutineNode[];
  scheduleItems: ScheduleItem[];
  tagAssignments: Map<string, number[]>;
  onToggleComplete: (id: string) => void;
}

export function CalendarSidebarContent({
  progressDate,
  categoryProgress,
  activeProgressFilter,
  onProgressFilterChange,
  routines,
  scheduleItems,
  tagAssignments,
  onToggleComplete,
}: CalendarSidebarContentProps) {
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
      {/* Progress Section */}
      <ProgressSection
        date={progressDate}
        categoryProgress={categoryProgress}
        activeFilter={activeProgressFilter}
        onFilterChange={onProgressFilterChange}
        tabs={CALENDAR_PROGRESS_TABS}
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
