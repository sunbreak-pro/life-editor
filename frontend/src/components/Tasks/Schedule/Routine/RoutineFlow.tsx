import { useMemo } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineTemplate, ScheduleItem } from "../../../../types/schedule";

interface RoutineFlowProps {
  templates: RoutineTemplate[];
  routines: RoutineNode[];
  scheduleItems: ScheduleItem[];
  onToggleComplete: (id: string) => void;
}

interface FlowStep {
  routineId: string;
  scheduleItemId: string | null;
  title: string;
  startTime: string | null;
  endTime: string | null;
  completed: boolean;
}

interface FlowGroup {
  templateName: string;
  steps: FlowStep[];
}

export function RoutineFlow({
  templates,
  routines,
  scheduleItems,
  onToggleComplete,
}: RoutineFlowProps) {
  const { t } = useTranslation();

  const routineMap = useMemo(
    () => new Map(routines.map((r) => [r.id, r])),
    [routines],
  );

  const scheduleItemByRoutineId = useMemo(() => {
    const map = new Map<string, ScheduleItem>();
    for (const item of scheduleItems) {
      if (item.routineId) {
        map.set(item.routineId, item);
      }
    }
    return map;
  }, [scheduleItems]);

  const flowGroups: FlowGroup[] = useMemo(() => {
    const today = new Date().getDay(); // 0-6
    const activeTemplates = templates.filter(
      (t) => t.frequencyType === "daily" || t.frequencyDays.includes(today),
    );

    const groups = activeTemplates.map((template) => {
      const steps: FlowStep[] = template.items
        .sort((a, b) => a.position - b.position)
        .map((item) => {
          const routine = routineMap.get(item.routineId);
          const scheduleItem = scheduleItemByRoutineId.get(item.routineId);
          return {
            routineId: item.routineId,
            scheduleItemId: scheduleItem?.id ?? null,
            title: routine?.title ?? "Unknown",
            startTime: item.startTime ?? routine?.startTime ?? null,
            endTime: item.endTime ?? routine?.endTime ?? null,
            completed: scheduleItem?.completed ?? false,
          };
        });

      return {
        templateName: template.name,
        steps,
      };
    });

    // Sort groups by earliest startTime of their steps
    groups.sort((a, b) => {
      const aMin = a.steps.reduce(
        (min, s) => (s.startTime && s.startTime < min ? s.startTime : min),
        "99:99",
      );
      const bMin = b.steps.reduce(
        (min, s) => (s.startTime && s.startTime < min ? s.startTime : min),
        "99:99",
      );
      return aMin.localeCompare(bMin);
    });

    return groups;
  }, [templates, routineMap, scheduleItemByRoutineId]);

  const totalSteps = flowGroups.reduce((sum, g) => sum + g.steps.length, 0);
  const completedSteps = flowGroups.reduce(
    (sum, g) => sum + g.steps.filter((s) => s.completed).length,
    0,
  );
  const progressPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="border border-notion-border rounded-lg p-3 h-full flex flex-col">
      <div className="text-xs font-medium text-notion-text mb-3">
        {t("schedule.routineFlow", "Routine Flow")}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {flowGroups.length === 0 ? (
          <p className="text-[10px] text-notion-text-secondary py-2">
            {t("schedule.noActiveTemplates", "No active templates for today.")}
          </p>
        ) : (
          <div className="space-y-4">
            {flowGroups.map((group) => (
              <div key={group.templateName}>
                {/* Template header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent-primary" />
                  <span className="text-[11px] font-medium text-notion-text">
                    {group.templateName}
                  </span>
                </div>

                {/* Steps */}
                <div className="ml-[5px]">
                  {group.steps.map((step, i) => (
                    <div key={step.routineId} className="flex">
                      {/* Vertical line + icon */}
                      <div className="flex flex-col items-center mr-2.5">
                        <button
                          onClick={() => {
                            if (step.scheduleItemId) {
                              onToggleComplete(step.scheduleItemId);
                            }
                          }}
                          className={`flex-shrink-0 transition-colors ${
                            step.scheduleItemId
                              ? "cursor-pointer"
                              : "cursor-default"
                          }`}
                          disabled={!step.scheduleItemId}
                        >
                          {step.completed ? (
                            <CheckCircle2
                              size={16}
                              className="text-green-500"
                            />
                          ) : (
                            <Circle
                              size={16}
                              className="text-notion-text-secondary"
                            />
                          )}
                        </button>
                        {/* Connector line */}
                        {i < group.steps.length - 1 && (
                          <div className="w-px flex-1 min-h-[16px] bg-notion-border" />
                        )}
                      </div>

                      {/* Step content */}
                      <div className="pb-3 min-w-0">
                        <div
                          className={`text-[11px] truncate ${
                            step.completed
                              ? "text-notion-text-secondary line-through"
                              : "text-notion-text"
                          }`}
                        >
                          {step.startTime && (
                            <span className="text-notion-text-secondary mr-1.5">
                              {step.startTime}
                            </span>
                          )}
                          {step.title}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {totalSteps > 0 && (
        <div className="mt-3 pt-3 border-t border-notion-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-notion-text-secondary">
              Progress: {completedSteps}/{totalSteps}
            </span>
            <span className="text-[10px] text-notion-text-secondary">
              {progressPercent}%
            </span>
          </div>
          <div className="h-1.5 bg-notion-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
