import { useMemo, useCallback } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Layers,
  Pencil,
  Repeat,
  Sun,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../types/routine";
import type { RoutineGroup } from "../../types/routineGroup";
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
      isDismissed: boolean;
    }
  | {
      type: "group";
      group: RoutineGroup;
      memberCount: number;
      allDismissed: boolean;
      startTime: string | null;
    }
  | { type: "task"; task: TaskNode; sortKey: string; isAllDay: boolean }
  | { type: "event"; scheduleItem: ScheduleItem };

interface MiniTodayFlowProps {
  date: Date;
  routines: RoutineNode[];
  scheduleItems: ScheduleItem[];
  onToggleComplete: (id: string) => void;
  tasks?: TaskNode[];
  routineGroups?: RoutineGroup[];
  routinesByGroup?: Map<string, RoutineNode[]>;
  onSelectTask?: (taskId: string) => void;
  onPrevDate?: () => void;
  onNextDate?: () => void;
  activeFilters?: Set<string>;
  onEditRoutine?: (routineId: string, e: React.MouseEvent) => void;
  onEditEvent?: (scheduleItemId: string, e: React.MouseEvent) => void;
  onEditTask?: (taskId: string, e: React.MouseEvent) => void;
  onDismissItem?: (scheduleItemId: string) => void;
  onUndismissItem?: (scheduleItemId: string) => void;
  onDismissGroup?: (groupId: string) => void;
  onUndismissGroup?: (groupId: string) => void;
  onToggleTaskStatus?: (taskId: string) => void;
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
  routineGroups = [],
  routinesByGroup,
  onSelectTask,
  onPrevDate,
  onNextDate,
  activeFilters,
  onEditRoutine,
  onEditEvent,
  onEditTask,
  onDismissItem,
  onUndismissItem,
  onDismissGroup,
  onUndismissGroup,
  onToggleTaskStatus,
}: MiniTodayFlowProps) {
  const { t } = useTranslation();

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

    // Add groups
    if (showRoutines && routineGroups.length > 0 && routinesByGroup) {
      for (const group of routineGroups) {
        const members = routinesByGroup.get(group.id) ?? [];
        if (members.length === 0) continue;
        const memberScheduleItems = members
          .map((r) => scheduleItemByRoutineId.get(r.id))
          .filter(Boolean) as ScheduleItem[];
        if (memberScheduleItems.length === 0) continue;
        const allDismissed =
          memberScheduleItems.length > 0 &&
          memberScheduleItems.every((si) => si.isDismissed);
        const firstTime =
          memberScheduleItems.length > 0
            ? memberScheduleItems.sort((a, b) =>
                a.startTime.localeCompare(b.startTime),
              )[0].startTime
            : null;
        result.push({
          type: "group",
          group,
          memberCount: members.length,
          allDismissed,
          startTime: firstTime,
        });
      }
    }

    // Add routines
    if (showRoutines) {
      for (const routine of routines) {
        if (routine.isArchived) continue;
        const scheduleItem = scheduleItemByRoutineId.get(routine.id);
        if (!scheduleItem) continue;
        result.push({
          type: "routine",
          routineId: routine.id,
          scheduleItemId: scheduleItem?.id ?? null,
          title: routine.title,
          startTime: scheduleItem?.startTime ?? routine.startTime,
          completed: scheduleItem?.completed ?? false,
          isDismissed: scheduleItem?.isDismissed ?? false,
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
          result.push({
            type: "task",
            task,
            sortKey: "99:99",
            isAllDay: true,
          });
        } else if (task.scheduledAt) {
          const time = extractTimeFromScheduledAt(task.scheduledAt);
          result.push({ type: "task", task, sortKey: time, isAllDay: false });
        }
      }
    }

    // Sort by time (groups and dismissed items mixed in)
    result.sort((a, b) => {
      // Groups first
      if (a.type === "group" && b.type !== "group") return -1;
      if (a.type !== "group" && b.type === "group") return 1;
      const aKey =
        a.type === "routine"
          ? (a.startTime ?? "99:99")
          : a.type === "event"
            ? (a.scheduleItem.startTime ?? "99:99")
            : a.type === "group"
              ? (a.startTime ?? "99:99")
              : a.sortKey;
      const bKey =
        b.type === "routine"
          ? (b.startTime ?? "99:99")
          : b.type === "event"
            ? (b.scheduleItem.startTime ?? "99:99")
            : b.type === "group"
              ? (b.startTime ?? "99:99")
              : b.sortKey;
      return aKey.localeCompare(bKey);
    });

    return result;
  }, [
    routines,
    routineGroups,
    routinesByGroup,
    scheduleItemByRoutineId,
    scheduleItems,
    tasks,
    showRoutines,
    showEvents,
    showTasks,
  ]);

  const groupEntries = useMemo(
    () => entries.filter((e) => e.type === "group"),
    [entries],
  );
  const allDayEntries = useMemo(
    () =>
      entries.filter(
        (e) =>
          (e.type === "task" && e.isAllDay) ||
          (e.type === "event" && e.scheduleItem.isAllDay),
      ),
    [entries],
  );
  const timelineEntries = useMemo(
    () =>
      entries.filter(
        (e) =>
          e.type !== "group" &&
          !(e.type === "task" && e.isAllDay) &&
          !(e.type === "event" && e.scheduleItem.isAllDay),
      ),
    [entries],
  );

  const completedCount = entries.filter((e) =>
    e.type === "routine"
      ? e.completed
      : e.type === "event"
        ? e.scheduleItem.completed
        : e.type === "task"
          ? e.task.status === "DONE"
          : false,
  ).length;
  const totalCount = entries.filter((e) => e.type !== "group").length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggle = useCallback(
    (scheduleItemId: string | null) => {
      if (scheduleItemId) onToggleComplete(scheduleItemId);
    },
    [onToggleComplete],
  );

  const hasEntries = entries.length > 0;
  const isToday = formatDateKey(date) === formatDateKey(new Date());
  const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <div className="border border-notion-border/60 rounded-lg p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          {onPrevDate && (
            <button
              onClick={onPrevDate}
              className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
          )}
          <span className="text-xs text-notion-text-secondary uppercase tracking-wide font-medium">
            {isToday
              ? t("schedule.todayFlow", "Today Flow")
              : `Flow ${dateLabel}`}
          </span>
          {onNextDate && (
            <button
              onClick={onNextDate}
              className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {!hasEntries && (
        <p className="mt-1.5 text-xs text-notion-text-secondary/50 px-1">
          {t("schedule.noItems", "No items for this day")}
        </p>
      )}

      {hasEntries && (
        <>
          {/* ── Groups section ── */}
          {groupEntries.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {groupEntries.map((entry) => {
                if (entry.type !== "group") return null;
                const g = entry.group;
                return (
                  <div
                    key={`g-${g.id}`}
                    className="group rounded-md px-2 py-1.5"
                    style={{ backgroundColor: `${g.color}12` }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Layers
                        size={12}
                        style={{ color: g.color }}
                        className="shrink-0"
                      />
                      <span
                        className={`text-xs font-medium truncate flex-1 ${entry.allDismissed ? "text-notion-text-secondary/50" : ""}`}
                        style={{
                          color: entry.allDismissed ? undefined : g.color,
                        }}
                      >
                        {g.name}
                        <span className="text-[10px] opacity-60 ml-1">
                          ({entry.memberCount})
                        </span>
                      </span>
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                        {entry.allDismissed && onUndismissGroup ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUndismissGroup(g.id);
                            }}
                            className="p-0.5 rounded hover:bg-white/10 text-notion-text-secondary/50 hover:text-notion-text transition-colors"
                            title={t("schedule.show", "Show")}
                          >
                            <Eye size={11} />
                          </button>
                        ) : onDismissGroup ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismissGroup(g.id);
                            }}
                            className="p-0.5 rounded hover:bg-white/10 text-notion-text-secondary hover:text-notion-text transition-colors"
                            title={t("schedule.hide", "Hide")}
                          >
                            <EyeOff size={11} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Timeline section (timed items) ── */}
          {timelineEntries.length > 0 && (
            <div
              className={`ml-[3px] ${groupEntries.length > 0 ? "mt-2" : "mt-1.5"}`}
            >
              {timelineEntries.map((entry, i) => {
                // --- Routine entry ---
                if (entry.type === "routine") {
                  const isDismissed = entry.isDismissed;
                  return (
                    <div
                      key={`r-${entry.routineId}`}
                      data-sidebar-item
                      className="flex text-left w-full group"
                    >
                      <div className="flex flex-col items-center mr-2">
                        <button
                          onClick={() => handleToggle(entry.scheduleItemId)}
                          disabled={!entry.scheduleItemId || isDismissed}
                          className="flex-shrink-0 transition-colors"
                        >
                          {entry.completed ? (
                            <CheckCircle2
                              size={16}
                              className="text-green-500"
                            />
                          ) : (
                            <Repeat
                              size={16}
                              className={`${isDismissed ? "text-notion-text-secondary/30" : "text-emerald-500"} ${entry.scheduleItemId && !isDismissed ? "hover:text-green-500" : ""}`}
                            />
                          )}
                        </button>
                        {i < timelineEntries.length - 1 && (
                          <div className="w-px flex-1 min-h-[10px] bg-notion-border" />
                        )}
                      </div>
                      <div className="pb-2 min-w-0 flex-1 flex items-start">
                        <div
                          className={`text-xs truncate flex-1 ${isDismissed ? "text-notion-text-secondary/40 line-through" : entry.completed ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                        >
                          {entry.startTime && (
                            <span className="text-xs text-notion-text-secondary mr-1">
                              {entry.startTime}
                            </span>
                          )}
                          {entry.title}
                        </div>
                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-1">
                          {!isDismissed && onEditRoutine && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditRoutine(entry.routineId, e);
                              }}
                              className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {isDismissed &&
                          onUndismissItem &&
                          entry.scheduleItemId ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUndismissItem(entry.scheduleItemId!);
                              }}
                              className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary/50 hover:text-notion-text transition-colors"
                              title={t("schedule.show", "Show")}
                            >
                              <Eye size={12} />
                            </button>
                          ) : !isDismissed &&
                            onDismissItem &&
                            entry.scheduleItemId ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDismissItem(entry.scheduleItemId!);
                              }}
                              className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
                              title={t("schedule.hide", "Hide")}
                            >
                              <EyeOff size={12} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                }

                // --- Event entry ---
                if (entry.type === "event") {
                  const si = entry.scheduleItem;
                  const isDismissed = si.isDismissed ?? false;
                  return (
                    <div
                      key={`e-${si.id}`}
                      data-sidebar-item
                      className="flex text-left w-full group"
                    >
                      <div className="flex flex-col items-center mr-2">
                        <button
                          onClick={() => handleToggle(si.id)}
                          disabled={isDismissed}
                          className="flex-shrink-0 transition-colors"
                        >
                          {si.completed ? (
                            <CheckCircle2
                              size={16}
                              className="text-green-500"
                            />
                          ) : (
                            <CalendarClock
                              size={16}
                              className={`${isDismissed ? "text-notion-text-secondary/30" : "text-purple-500"} ${!isDismissed ? "hover:text-green-500" : ""}`}
                            />
                          )}
                        </button>
                        {i < timelineEntries.length - 1 && (
                          <div className="w-px flex-1 min-h-[10px] bg-notion-border" />
                        )}
                      </div>
                      <div className="pb-2 min-w-0 flex-1 flex items-start">
                        <div
                          className={`text-xs truncate flex-1 ${isDismissed ? "text-notion-text-secondary/40 line-through" : si.completed ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                        >
                          {si.startTime && (
                            <span className="text-xs text-notion-text-secondary mr-1">
                              {si.startTime}
                            </span>
                          )}
                          {si.title}
                        </div>
                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-1">
                          {!isDismissed && onEditEvent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditEvent(si.id, e);
                              }}
                              className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {isDismissed && onUndismissItem ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUndismissItem(si.id);
                              }}
                              className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary/50 hover:text-notion-text transition-colors"
                              title={t("schedule.show", "Show")}
                            >
                              <Eye size={12} />
                            </button>
                          ) : !isDismissed && onDismissItem ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDismissItem(si.id);
                              }}
                              className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
                              title={t("schedule.hide", "Hide")}
                            >
                              <EyeOff size={12} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                }

                // --- Timed task entry ---
                const task = entry.task;
                const isDone = task.status === "DONE";
                return (
                  <div
                    key={`t-${task.id}`}
                    data-sidebar-item
                    className="flex text-left w-full group"
                  >
                    <div className="flex flex-col items-center mr-2">
                      <button
                        onClick={() => onToggleTaskStatus?.(task.id)}
                        className="flex-shrink-0 transition-colors"
                      >
                        {isDone ? (
                          <CheckCircle2
                            size={14}
                            className="text-green-500 hover:text-notion-accent"
                          />
                        ) : (
                          <CheckSquare
                            size={16}
                            className="text-notion-accent hover:text-green-500"
                          />
                        )}
                      </button>
                      {i < timelineEntries.length - 1 && (
                        <div className="w-px flex-1 min-h-[10px] bg-notion-border" />
                      )}
                    </div>
                    <div className="pb-2 min-w-0 flex-1 flex items-start">
                      <button
                        onClick={() => onSelectTask?.(task.id)}
                        className={`text-xs truncate flex-1 text-left ${isDone ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                      >
                        {task.scheduledAt && !task.isAllDay && (
                          <span className="text-xs text-notion-text-secondary mr-1">
                            {extractTimeFromScheduledAt(task.scheduledAt)}
                          </span>
                        )}
                        {task.title}
                      </button>
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-1">
                        {onEditTask && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTask(task.id, e);
                            }}
                            className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── All-day section ── */}
          {allDayEntries.length > 0 && (
            <div
              className={`${timelineEntries.length > 0 || groupEntries.length > 0 ? "mt-1.5 pt-1.5 border-t border-notion-border/50" : "mt-1.5"}`}
            >
              <div className="flex items-center gap-1 mb-1 px-0.5">
                <Sun size={10} className="text-notion-text-secondary/50" />
                <span className="text-[10px] text-notion-text-secondary/50 uppercase tracking-wide">
                  {t("schedule.allDay", "All day")}
                </span>
              </div>
              <div className="space-y-0.5">
                {allDayEntries.map((entry) => {
                  if (entry.type === "task") {
                    const task = entry.task;
                    const isDone = task.status === "DONE";
                    return (
                      <div
                        key={`t-${task.id}`}
                        className="flex items-center gap-1.5 px-1.5 py-1 rounded group hover:bg-notion-hover transition-colors"
                      >
                        <button
                          onClick={() => onToggleTaskStatus?.(task.id)}
                          className="shrink-0 transition-colors"
                        >
                          {isDone ? (
                            <CheckCircle2
                              size={13}
                              className="text-green-500 hover:text-notion-accent"
                            />
                          ) : (
                            <CheckSquare
                              size={13}
                              className="text-notion-accent hover:text-green-500"
                            />
                          )}
                        </button>
                        <button
                          onClick={() => onSelectTask?.(task.id)}
                          className={`text-[11px] truncate flex-1 text-left ${isDone ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                        >
                          {task.title}
                        </button>
                        <div className="hidden group-hover:flex items-center shrink-0">
                          {onEditTask && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditTask(task.id, e);
                              }}
                              className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (entry.type === "event") {
                    const si = entry.scheduleItem;
                    const isDismissed = si.isDismissed ?? false;
                    return (
                      <div
                        key={`e-${si.id}`}
                        className="flex items-center gap-1.5 px-1.5 py-1 rounded group hover:bg-notion-hover transition-colors"
                      >
                        <button
                          onClick={() => handleToggle(si.id)}
                          disabled={isDismissed}
                          className="shrink-0 transition-colors"
                        >
                          {si.completed ? (
                            <CheckCircle2
                              size={13}
                              className="text-green-500"
                            />
                          ) : (
                            <CalendarClock
                              size={13}
                              className={
                                isDismissed
                                  ? "text-notion-text-secondary/30"
                                  : "text-purple-500"
                              }
                            />
                          )}
                        </button>
                        <span
                          className={`text-[11px] truncate flex-1 ${isDismissed ? "text-notion-text-secondary/40 line-through" : si.completed ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                        >
                          {si.title}
                        </span>
                        <div className="hidden group-hover:flex items-center shrink-0">
                          {!isDismissed && onEditEvent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditEvent(si.id, e);
                              }}
                              className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-1 pt-1 border-t border-notion-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-notion-text-secondary">
                {completedCount}/{totalCount}
              </span>
              <span className="text-xs text-notion-text-secondary">
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
