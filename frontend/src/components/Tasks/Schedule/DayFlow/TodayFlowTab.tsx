import { useMemo } from "react";
import { Check, Circle, Clock, ListTodo } from "lucide-react";
import type { ScheduleItem } from "../../../../types/schedule";
import type { TaskNode } from "../../../../types/taskTree";

type FlowEntry =
  | { type: "schedule"; item: ScheduleItem; sortKey: string }
  | { type: "task"; task: TaskNode; sortKey: string };

interface TodayFlowTabProps {
  items: ScheduleItem[];
  onToggleComplete: (id: string) => void;
  tasks?: TaskNode[];
  onSelectTask?: (taskId: string, e: React.MouseEvent) => void;
  getTaskColor?: (taskId: string) => string | undefined;
}

function extractTimeFromScheduledAt(scheduledAt: string): string {
  const d = new Date(scheduledAt);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function TodayFlowTab({
  items,
  onToggleComplete,
  tasks = [],
  onSelectTask,
  getTaskColor,
}: TodayFlowTabProps) {
  const entries = useMemo(() => {
    const result: FlowEntry[] = [];

    for (const item of items) {
      result.push({ type: "schedule", item, sortKey: item.startTime });
    }

    for (const task of tasks) {
      if (task.isAllDay) {
        result.push({ type: "task", task, sortKey: "99:99" });
      } else if (task.scheduledAt) {
        const time = extractTimeFromScheduledAt(task.scheduledAt);
        result.push({ type: "task", task, sortKey: time });
      }
    }

    result.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return result;
  }, [items, tasks]);

  const nextIndex = useMemo(() => {
    return entries.findIndex((entry) => {
      if (entry.type === "schedule") return !entry.item.completed;
      return entry.task.status !== "DONE";
    });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-notion-text-secondary">
        <Clock size={32} className="mb-2 opacity-50" />
        <p className="text-xs">No schedule items for today</p>
      </div>
    );
  }

  const completedCount = entries.filter((e) =>
    e.type === "schedule" ? e.item.completed : e.task.status === "DONE",
  ).length;

  return (
    <div className="px-3 py-2">
      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-notion-text-secondary mb-1">
          <span>Progress</span>
          <span>
            {completedCount}/{entries.length}
          </span>
        </div>
        <div className="h-1.5 bg-notion-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-notion-accent rounded-full transition-all"
            style={{
              width: `${(completedCount / entries.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Flow list */}
      <div className="space-y-0">
        {entries.map((entry, i) => {
          const isNext = i === nextIndex;
          const isLast = i === entries.length - 1;

          if (entry.type === "schedule") {
            const item = entry.item;
            return (
              <div key={`s-${item.id}`} className="flex gap-2">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => onToggleComplete(item.id)}
                    className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      item.completed
                        ? "bg-green-500 border-green-500"
                        : isNext
                          ? "border-notion-accent bg-notion-accent/10"
                          : "border-notion-border"
                    }`}
                  >
                    {item.completed ? (
                      <Check size={10} className="text-white" />
                    ) : isNext ? (
                      <Circle
                        size={6}
                        className="text-notion-accent fill-notion-accent"
                      />
                    ) : null}
                  </button>
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 min-h-6 ${
                        item.completed ? "bg-green-500/30" : "bg-notion-border"
                      }`}
                    />
                  )}
                </div>

                {/* Content */}
                <div
                  className={`flex-1 pb-3 ${item.completed ? "opacity-40" : ""}`}
                >
                  <div
                    className={`text-xs font-medium ${
                      item.completed
                        ? "line-through text-notion-text-secondary"
                        : isNext
                          ? "text-notion-accent"
                          : "text-notion-text"
                    }`}
                  >
                    {item.title}
                  </div>
                  <div className="text-[10px] text-notion-text-secondary">
                    {item.startTime} - {item.endTime}
                  </div>
                </div>
              </div>
            );
          }

          // Task entry
          const task = entry.task;
          const isDone = task.status === "DONE";
          const color = getTaskColor?.(task.id);
          const timeStr = task.isAllDay
            ? "All day"
            : task.scheduledAt
              ? extractTimeFromScheduledAt(task.scheduledAt)
              : "";

          return (
            <div
              key={`t-${task.id}`}
              className="flex gap-2 cursor-pointer"
              onClick={(e) => onSelectTask?.(task.id, e)}
            >
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div
                  className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isDone
                      ? "bg-green-500 border-green-500"
                      : isNext
                        ? "border-notion-accent bg-notion-accent/10"
                        : "border-notion-border"
                  }`}
                >
                  {isDone ? (
                    <Check size={10} className="text-white" />
                  ) : (
                    <ListTodo
                      size={10}
                      className={
                        isNext
                          ? "text-notion-accent"
                          : "text-notion-text-secondary"
                      }
                    />
                  )}
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 min-h-6 ${
                      isDone ? "bg-green-500/30" : "bg-notion-border"
                    }`}
                  />
                )}
              </div>

              {/* Content */}
              <div
                className={`flex-1 pb-3 pl-1 border-l-2 ${isDone ? "opacity-40" : ""}`}
                style={{ borderLeftColor: color ?? "transparent" }}
              >
                <div
                  className={`text-xs font-medium ${
                    isDone
                      ? "line-through text-notion-text-secondary"
                      : isNext
                        ? "text-notion-accent"
                        : "text-notion-text"
                  }`}
                >
                  {task.title}
                </div>
                <div className="text-[10px] text-notion-text-secondary">
                  {timeStr}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
