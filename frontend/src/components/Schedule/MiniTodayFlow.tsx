import { useMemo, useCallback } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  ListTodo,
  Pencil,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../types/routine";
import type { ScheduleItem } from "../../types/schedule";
import type { TaskNode } from "../../types/taskTree";
import { formatDateKey } from "../../utils/dateKey";

type FlowEntry =
  | {
      type: "routine";
      routineId: string;
      scheduleItemId: string | null;
      title: string;
      startTime: string | null;
      completed: boolean;
    }
  | { type: "task"; task: TaskNode; sortKey: string }
  | { type: "event"; scheduleItem: ScheduleItem };

interface MiniTodayFlowProps {
  date: Date;
  routines: RoutineNode[];
  scheduleItems: ScheduleItem[];
  onToggleComplete: (id: string) => void;
  tasks?: TaskNode[];
  onSelectTask?: (taskId: string) => void;
  onPrevDate?: () => void;
  onNextDate?: () => void;
  activeFilters?: Set<string>;
  onEditRoutine?: (routineId: string) => void;
  onDismissItem?: (scheduleItemId: string) => void;
}

function extractTimeFromScheduledAt(scheduledAt: string): string {
  const d = new Date(scheduledAt);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function MiniTodayFlow({
  date,
  routines,
  scheduleItems,
  onToggleComplete,
  tasks = [],
  onSelectTask,
  onPrevDate,
  onNextDate,
  activeFilters,
  onEditRoutine,
  onDismissItem,
}: MiniTodayFlowProps) {
  const { t } = useTranslation();

  // Empty set = show all
  const showAll = !activeFilters || activeFilters.size === 0;
  const showRoutines = showAll || activeFilters!.has("routine");
  const showEvents = showAll || activeFilters!.has("events");
  const showTasks = showAll || activeFilters!.has("tasks");

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
    if (showRoutines) {
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
    }

    // Add events (schedule items without routineId)
    if (showEvents) {
      for (const item of scheduleItems) {
        if (item.routineId === null) {
          result.push({ type: "event", scheduleItem: item });
        }
      }
    }

    // Add tasks
    if (showTasks) {
      for (const task of tasks) {
        if (task.isAllDay) {
          result.push({ type: "task", task, sortKey: "99:99" });
        } else if (task.scheduledAt) {
          const time = extractTimeFromScheduledAt(task.scheduledAt);
          result.push({ type: "task", task, sortKey: time });
        }
      }
    }

    // Sort by time
    result.sort((a, b) => {
      const aKey =
        a.type === "routine"
          ? (a.startTime ?? "99:99")
          : a.type === "event"
            ? (a.scheduleItem.startTime ?? "99:99")
            : a.sortKey;
      const bKey =
        b.type === "routine"
          ? (b.startTime ?? "99:99")
          : b.type === "event"
            ? (b.scheduleItem.startTime ?? "99:99")
            : b.sortKey;
      return aKey.localeCompare(bKey);
    });

    return result;
  }, [
    routines,
    scheduleItemByRoutineId,
    scheduleItems,
    tasks,
    showRoutines,
    showEvents,
    showTasks,
  ]);

  const completedCount = entries.filter((e) =>
    e.type === "routine"
      ? e.completed
      : e.type === "event"
        ? e.scheduleItem.completed
        : e.task.status === "DONE",
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

  const hasEntries = totalCount > 0;
  const isToday = formatDateKey(date) === formatDateKey(new Date());
  const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <div className="border border-notion-border rounded-lg p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          {onPrevDate && (
            <button
              onClick={onPrevDate}
              className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
            >
              <ChevronLeft size={12} />
            </button>
          )}
          <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium">
            {isToday
              ? t("schedule.todayFlow", "Today Flow")
              : `Flow ${dateLabel}`}
          </span>
          {onNextDate && (
            <button
              onClick={onNextDate}
              className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
            >
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>

      {!hasEntries && (
        <p className="mt-1.5 text-[10px] text-notion-text-secondary/50 px-1">
          {t("schedule.noItems", "No items for this day")}
        </p>
      )}

      {hasEntries && (
        <>
          <div className="mt-1.5 ml-[3px]">
            {entries.map((entry, i) => {
              if (entry.type === "routine") {
                return (
                  <div
                    key={`r-${entry.routineId}`}
                    data-sidebar-item
                    className="flex text-left w-full group"
                  >
                    <div className="flex flex-col items-center mr-2">
                      <button
                        onClick={() => handleToggle(entry.scheduleItemId)}
                        disabled={!entry.scheduleItemId}
                        className="flex-shrink-0 transition-colors"
                      >
                        {entry.completed ? (
                          <CheckCircle2 size={14} className="text-green-500" />
                        ) : (
                          <Circle
                            size={14}
                            className={`text-notion-text-secondary ${entry.scheduleItemId ? "hover:text-green-500" : ""}`}
                          />
                        )}
                      </button>
                      {i < entries.length - 1 && (
                        <div className="w-px flex-1 min-h-[12px] bg-notion-border" />
                      )}
                    </div>
                    <div className="pb-2 min-w-0 flex-1 flex items-start">
                      <div
                        className={`text-xs truncate flex-1 ${entry.completed ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                      >
                        {entry.startTime && (
                          <span className="text-[10px] text-notion-text-secondary mr-1">
                            {entry.startTime}
                          </span>
                        )}
                        {entry.title}
                      </div>
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-1">
                        {onEditRoutine && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditRoutine(entry.routineId);
                            }}
                            className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
                          >
                            <Pencil size={10} />
                          </button>
                        )}
                        {onDismissItem && entry.scheduleItemId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismissItem(entry.scheduleItemId!);
                            }}
                            className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-red-500 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // Event entry
              if (entry.type === "event") {
                const si = entry.scheduleItem;
                return (
                  <button
                    key={`e-${si.id}`}
                    data-sidebar-item
                    onClick={() => handleToggle(si.id)}
                    className="flex text-left w-full cursor-pointer"
                  >
                    <div className="flex flex-col items-center mr-2">
                      <div className="flex-shrink-0 transition-colors">
                        {si.completed ? (
                          <CheckCircle2 size={14} className="text-green-500" />
                        ) : (
                          <CalendarClock
                            size={14}
                            className="text-purple-500"
                          />
                        )}
                      </div>
                      {i < entries.length - 1 && (
                        <div className="w-px flex-1 min-h-[12px] bg-notion-border" />
                      )}
                    </div>
                    <div className="pb-2 min-w-0">
                      <div
                        className={`text-xs truncate ${si.completed ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                      >
                        {si.startTime && (
                          <span className="text-[10px] text-notion-text-secondary mr-1">
                            {si.startTime}
                          </span>
                        )}
                        {si.title}
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
                      className={`text-xs truncate ${isDone ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                    >
                      {task.scheduledAt && !task.isAllDay && (
                        <span className="text-[10px] text-notion-text-secondary mr-1">
                          {extractTimeFromScheduledAt(task.scheduledAt)}
                        </span>
                      )}
                      <ListTodo
                        size={10}
                        className="inline mr-0.5 opacity-60"
                      />
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
        </>
      )}
    </div>
  );
}
