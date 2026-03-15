import { useMemo, useCallback } from "react";
import { CheckCircle2, Circle, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../../../types/routine";
import type { ScheduleItem } from "../../../../types/schedule";

interface MiniRoutineFlowProps {
  routines: RoutineNode[];
  scheduleItems: ScheduleItem[];
  tagAssignments?: Map<string, number[]>;
  onToggleComplete: (id: string) => void;
  onOpenManagement?: () => void;
}

interface FlowStep {
  routineId: string;
  scheduleItemId: string | null;
  title: string;
  startTime: string | null;
  completed: boolean;
}

export function MiniRoutineFlow({
  routines,
  scheduleItems,
  onToggleComplete,
  onOpenManagement,
}: MiniRoutineFlowProps) {
  const { t } = useTranslation();

  const scheduleItemByRoutineId = useMemo(() => {
    const map = new Map<string, ScheduleItem>();
    for (const item of scheduleItems) {
      if (item.routineId) {
        map.set(item.routineId, item);
      }
    }
    return map;
  }, [scheduleItems]);

  const steps = useMemo((): FlowStep[] => {
    return routines
      .filter((r) => !r.isArchived)
      .map((routine) => {
        const scheduleItem = scheduleItemByRoutineId.get(routine.id);
        return {
          routineId: routine.id,
          scheduleItemId: scheduleItem?.id ?? null,
          title: routine.title,
          startTime: routine.startTime,
          completed: scheduleItem?.completed ?? false,
        };
      })
      .sort((a, b) =>
        (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"),
      );
  }, [routines, scheduleItemByRoutineId]);

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggle = useCallback(
    (scheduleItemId: string | null) => {
      if (scheduleItemId) {
        onToggleComplete(scheduleItemId);
      }
    },
    [onToggleComplete],
  );

  if (totalCount === 0) return null;

  return (
    <div className="border border-notion-border rounded-lg p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium">
          {t("schedule.routineFlow", "Routine Flow")}
        </span>
        {onOpenManagement && (
          <button
            onClick={onOpenManagement}
            className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
          >
            <Settings size={12} />
          </button>
        )}
      </div>

      <div className="mt-1.5 ml-[3px]">
        {steps.map((step, i) => (
          <button
            key={step.routineId}
            onClick={() => handleToggle(step.scheduleItemId)}
            disabled={!step.scheduleItemId}
            className={`flex text-left w-full ${
              step.scheduleItemId ? "cursor-pointer" : "cursor-default"
            }`}
          >
            <div className="flex flex-col items-center mr-2">
              <div className="flex-shrink-0 transition-colors">
                {step.completed ? (
                  <CheckCircle2 size={14} className="text-green-500" />
                ) : (
                  <Circle size={14} className="text-notion-text-secondary" />
                )}
              </div>
              {i < steps.length - 1 && (
                <div className="w-px flex-1 min-h-[12px] bg-notion-border" />
              )}
            </div>
            <div className="pb-2 min-w-0">
              <div
                className={`text-xs truncate ${
                  step.completed
                    ? "text-notion-text-secondary line-through"
                    : "text-notion-text"
                }`}
              >
                {step.startTime && (
                  <span className="text-[10px] text-notion-text-secondary mr-1">
                    {step.startTime}
                  </span>
                )}
                {step.title}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mt-1 pt-1 border-t border-notion-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-notion-text-secondary">
            {completedCount}/{totalCount}
          </span>
          <span className="text-[10px] text-notion-text-secondary">
            {progressPercent}%
          </span>
        </div>
        <div className="h-1 bg-notion-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
