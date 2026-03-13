import type { DayFlowFilterTab } from "./OneDaySchedule";
import type { RoutineNode } from "../../../../types/routine";
import type { ScheduleItem } from "../../../../types/schedule";
import { MiniRoutineFlow } from "../Routine/MiniRoutineFlow";
import { ProgressSection } from "../shared/ProgressSection";

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
        />
      </div>
    </div>
  );
}
