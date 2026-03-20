import { useMemo, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  CircleDot,
  Settings,
  ListTodo,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../types/routine";
import type { ScheduleItem } from "../../types/schedule";
import type { TaskNode } from "../../types/taskTree";

type FlowEntry =
  | {
      type: "routine";
      routineId: string;
      scheduleItemId: string | null;
      title: string;
      startTime: string | null;
      completed: boolean;
    }
  | { type: "task"; task: TaskNode; sortKey: string };

interface MiniTodayFlowProps {
  routines: RoutineNode[];
  scheduleItems: ScheduleItem[];
  onToggleComplete: (id: string) => void;
  onOpenManagement?: () => void;
  tasks?: TaskNode[];
  onSelectTask?: (taskId: string) => void;
}

function extractTimeFromScheduledAt(scheduledAt: string): string {
  const d = new Date(scheduledAt);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function MiniTodayFlow({
  routines,
  scheduleItems,
  onToggleComplete,
  onOpenManagement,
  tasks = [],
  onSelectTask,
}: MiniTodayFlowProps) {
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

  const entries = useMemo((): FlowEntry[] => {
    const result: FlowEntry[] = [];

    // Add routines
    for (const routine of routines) {
      if (routine.isArchived) continue;
      const scheduleItem = scheduleItemByRoutineId.get(routine.id);
      result.push({
        type: "routine",
        routineId: routine.id,
        scheduleItemId: scheduleItem?.id ?? null,
        title: routine.title,
        startTime: scheduleItem?.startTime ?? routine.startTime,
        completed: scheduleItem?.completed ?? false,
      });
    }

    // Add tasks
    for (const task of tasks) {
      if (task.isAllDay) {
        result.push({ type: "task", task, sortKey: "99:99" });
      } else if (task.scheduledAt) {
        const time = extractTimeFromScheduledAt(task.scheduledAt);
        result.push({ type: "task", task, sortKey: time });
      }
    }

    // Sort by time
    result.sort((a, b) => {
      const aKey = a.type === "routine" ? (a.startTime ?? "99:99") : a.sortKey;
      const bKey = b.type === "routine" ? (b.startTime ?? "99:99") : b.sortKey;
      return aKey.localeCompare(bKey);
    });

    return result;
  }, [routines, scheduleItemByRoutineId, tasks]);

  const completedCount = entries.filter((e) =>
    e.type === "routine" ? e.completed : e.task.status === "DONE",
  ).length;
  const totalCount = entries.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggle = useCallback(
    (scheduleItemId: string | null) => {
      if (scheduleItemId) onToggleComplete(scheduleItemId);
    },
    [onToggleComplete],
  );

  if (totalCount === 0) return null;

  return (
    <div className="border border-notion-border rounded-lg p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium">
          {t("schedule.todayFlow", "Today Flow")}
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
        {entries.map((entry, i) => {
          if (entry.type === "routine") {
            return (
              <button
                key={`r-${entry.routineId}`}
                data-sidebar-item
                onClick={() => handleToggle(entry.scheduleItemId)}
                disabled={!entry.scheduleItemId}
                className={`flex text-left w-full ${entry.scheduleItemId ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className="flex flex-col items-center mr-2">
                  <div className="flex-shrink-0 transition-colors">
                    {entry.completed ? (
                      <CheckCircle2 size={14} className="text-green-500" />
                    ) : (
                      <Circle
                        size={14}
                        className="text-notion-text-secondary"
                      />
                    )}
                  </div>
                  {i < entries.length - 1 && (
                    <div className="w-px flex-1 min-h-[12px] bg-notion-border" />
                  )}
                </div>
                <div className="pb-2 min-w-0">
                  <div
                    className={`text-xs truncate ${entry.completed ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                  >
                    {entry.startTime && (
                      <span className="text-[10px] text-notion-text-secondary mr-1">
                        {entry.startTime}
                      </span>
                    )}
                    {entry.title}
                  </div>
                </div>
              </button>
            );
          }

          // Task entry
          const task = entry.task;
          const isDone = task.status === "DONE";
          const isInProgress = task.status === "IN_PROGRESS";
          return (
            <button
              key={`t-${task.id}`}
              data-sidebar-item
              onClick={() => onSelectTask?.(task.id)}
              className="flex text-left w-full cursor-pointer"
            >
              <div className="flex flex-col items-center mr-2">
                <div className="flex-shrink-0 transition-colors">
                  {isDone ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : isInProgress ? (
                    <CircleDot size={14} className="text-blue-500" />
                  ) : (
                    <Circle size={14} className="text-notion-text-secondary" />
                  )}
                </div>
                {i < entries.length - 1 && (
                  <div className="w-px flex-1 min-h-[12px] bg-notion-border" />
                )}
              </div>
              <div className="pb-2 min-w-0">
                <div
                  className={`text-xs truncate ${isDone ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                >
                  {task.scheduledAt && !task.isAllDay && (
                    <span className="text-[10px] text-notion-text-secondary mr-1">
                      {extractTimeFromScheduledAt(task.scheduledAt)}
                    </span>
                  )}
                  <ListTodo size={10} className="inline mr-0.5 opacity-60" />
                  {task.title}
                </div>
              </div>
            </button>
          );
        })}
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
