import { useState, useEffect } from "react";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineTag } from "../../../../types/routineTag";
import type { RoutineStats, ScheduleItem } from "../../../../types/schedule";
import { AchievementPanel } from "./AchievementPanel";
import { AchievementDetailsOverlay } from "./AchievementDetailsOverlay";
import { RoutineFlow } from "./RoutineFlow";
import { RoutineManagementOverlay } from "./RoutineManagementOverlay";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import { formatDateKey } from "../../../../utils/dateKey";

interface RoutinesTabProps {
  routines: RoutineNode[];
  routineTags: RoutineTag[];
  tagAssignments: Map<string, number[]>;
  onCreateRoutine: (
    title: string,
    startTime?: string,
    endTime?: string,
  ) => string;
  onUpdateRoutine: (
    id: string,
    updates: Partial<
      Pick<RoutineNode, "title" | "startTime" | "endTime" | "isArchived">
    >,
  ) => void;
  onDeleteRoutine: (id: string) => void;
  setTagsForRoutine: (routineId: string, tagIds: number[]) => void;
  getCompletionRate: (routineId: string) => {
    completed: number;
    total: number;
  };
  routineStats: RoutineStats | null;
  scheduleItems: ScheduleItem[];
  onToggleComplete: (id: string) => void;
  onCreateRoutineTag: (name: string, color: string) => Promise<RoutineTag>;
  onUpdateRoutineTag: (
    id: number,
    updates: Partial<Pick<RoutineTag, "name" | "color">>,
  ) => void;
  onDeleteRoutineTag: (id: number) => void;
  refreshRoutineStats: (routines: RoutineNode[]) => void;
}

export function RoutinesTab({
  routines,
  routineTags,
  tagAssignments,
  onCreateRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  setTagsForRoutine,
  getCompletionRate,
  routineStats,
  scheduleItems,
  onToggleComplete,
  onCreateRoutineTag,
  onUpdateRoutineTag,
  onDeleteRoutineTag,
  refreshRoutineStats,
}: RoutinesTabProps) {
  const { ensureRoutineItemsForDate, loadItemsForDate } = useScheduleContext();
  const [showDetails, setShowDetails] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Ensure schedule items exist for today when RoutinesTab is opened directly
  useEffect(() => {
    const today = formatDateKey(new Date());
    loadItemsForDate(today);
  }, [loadItemsForDate]);

  useEffect(() => {
    if (routines.length > 0) {
      const today = formatDateKey(new Date());
      ensureRoutineItemsForDate(today, routines, tagAssignments);
    }
  }, [routines, tagAssignments, ensureRoutineItemsForDate]);

  useEffect(() => {
    if (routines.length > 0) {
      refreshRoutineStats(routines);
    }
  }, [routines, refreshRoutineStats]);

  if (isFullscreen) {
    return (
      <div className="h-full p-3">
        <RoutineFlow
          routines={routines}
          scheduleItems={scheduleItems}
          tagAssignments={tagAssignments}
          routineTags={routineTags}
          filterTagIds={filterTagIds}
          onFilterChange={setFilterTagIds}
          isFullscreen
          onToggleFullscreen={() => setIsFullscreen(false)}
          onToggleComplete={onToggleComplete}
          onOpenManagement={() => setShowManagement(true)}
        />

        {showManagement && (
          <RoutineManagementOverlay
            routines={routines}
            routineTags={routineTags}
            tagAssignments={tagAssignments}
            onCreateRoutine={onCreateRoutine}
            onUpdateRoutine={onUpdateRoutine}
            onDeleteRoutine={onDeleteRoutine}
            setTagsForRoutine={setTagsForRoutine}
            getCompletionRate={getCompletionRate}
            onCreateRoutineTag={onCreateRoutineTag}
            onUpdateRoutineTag={onUpdateRoutineTag}
            onDeleteRoutineTag={onDeleteRoutineTag}
            onClose={() => setShowManagement(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full p-3">
      {/* Left column: Routine Flow */}
      <div className="w-1/2">
        <RoutineFlow
          routines={routines}
          scheduleItems={scheduleItems}
          tagAssignments={tagAssignments}
          routineTags={routineTags}
          filterTagIds={filterTagIds}
          onFilterChange={setFilterTagIds}
          isFullscreen={false}
          onToggleFullscreen={() => setIsFullscreen(true)}
          onToggleComplete={onToggleComplete}
          onOpenManagement={() => setShowManagement(true)}
        />
      </div>

      {/* Right column: Achievement */}
      <div className="w-1/2 flex flex-col gap-3">
        {routineStats && (
          <AchievementPanel
            stats={routineStats}
            onShowDetails={() => setShowDetails(true)}
          />
        )}
      </div>

      {showManagement && (
        <RoutineManagementOverlay
          routines={routines}
          routineTags={routineTags}
          tagAssignments={tagAssignments}
          onCreateRoutine={onCreateRoutine}
          onUpdateRoutine={onUpdateRoutine}
          onDeleteRoutine={onDeleteRoutine}
          setTagsForRoutine={setTagsForRoutine}
          getCompletionRate={getCompletionRate}
          onCreateRoutineTag={onCreateRoutineTag}
          onUpdateRoutineTag={onUpdateRoutineTag}
          onDeleteRoutineTag={onDeleteRoutineTag}
          onClose={() => setShowManagement(false)}
        />
      )}

      {showDetails && routineStats && (
        <AchievementDetailsOverlay
          stats={routineStats}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}
