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
  filterTagId?: number | null;
}

interface FlowStep {
  routineId: string;
  scheduleItemId: string | null;
  title: string;
  startTime: string | null;
  endTime: string | null;
  completed: boolean;
  tagId: number | null;
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
  filterTagId,
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

    const groups = activeTemplates
      .map((template) => {
        const steps: FlowStep[] = template.items
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
              tagId: routine?.tagId ?? null,
            };
          })
          .filter((step) => filterTagId == null || step.tagId === filterTagId)
          .sort((a, b) =>
            (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"),
          );

        return {
          templateName: template.name,
          steps,
        };
      })
      .filter((g) => g.steps.length > 0);

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
  }, [templates, routineMap, scheduleItemByRoutineId, filterTagId]);

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
                    <button
                      key={step.routineId}
                      onClick={() => {
                        if (step.scheduleItemId) {
                          onToggleComplete(step.scheduleItemId);
                        }
                      }}
                      disabled={!step.scheduleItemId}
                      className={`flex text-left w-full ${
                        step.scheduleItemId
                          ? "cursor-pointer"
                          : "cursor-default"
                      }`}
                    >
                      {/* Vertical line + icon */}
                      <div className="flex flex-col items-center mr-2.5">
                        <div className="flex-shrink-0 transition-colors">
                          {step.completed ? (
                            <CheckCircle2
                              size={18}
                              className="text-green-500"
                            />
                          ) : (
                            <Circle
                              size={18}
                              className="text-notion-text-secondary"
                            />
                          )}
                        </div>
                        {/* Connector line */}
                        {i < group.steps.length - 1 && (
                          <div className="w-px flex-1 min-h-[20px] bg-notion-border" />
                        )}
                      </div>

                      {/* Step content */}
                      <div className="pb-4 min-w-0">
                        <div
                          className={`text-xs truncate ${
                            step.completed
                              ? "text-notion-text-secondary line-through"
                              : "text-notion-text"
                          }`}
                        >
                          {step.startTime && (
                            <span className="text-[11px] text-notion-text-secondary mr-1.5">
                              {step.startTime}
                            </span>
                          )}
                          {step.title}
                        </div>
                      </div>
                    </button>
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
