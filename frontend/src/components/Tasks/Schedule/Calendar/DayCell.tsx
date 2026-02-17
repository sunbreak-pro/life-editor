import { useState, useRef } from "react";
import { Plus } from "lucide-react";
import type { TaskNode } from "../../../../types/taskTree";
import type { MemoNode } from "../../../../types/memo";
import type { NoteNode } from "../../../../types/note";
import { CalendarTaskItem } from "./CalendarTaskItem";
import { useClickOutside } from "../../../../hooks/useClickOutside";

interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: TaskNode[];
  onSelectTask: (taskId: string, event: React.MouseEvent) => void;
  onCreateTask?: (date: Date, event: React.MouseEvent) => void;
  getTaskColor?: (taskId: string) => string | undefined;
  getFolderTag?: (taskId: string) => string;
  memo?: MemoNode;
  routineCompletion?: { completed: number; total: number };
  calendarMode?: "tasks" | "memo";
  notes?: NoteNode[];
  onMemoChipClick?: (date: string, e: React.MouseEvent) => void;
  onNoteChipClick?: (noteId: string, e: React.MouseEvent) => void;
}

const MAX_VISIBLE_TASKS = 2;
const MAX_VISIBLE_MEMO_ITEMS = 2;

export function DayCell({
  date,
  isCurrentMonth,
  isToday,
  tasks,
  onSelectTask,
  onCreateTask,
  getTaskColor,
  getFolderTag,
  memo,
  routineCompletion,
  calendarMode,
  notes,
  onMemoChipClick,
  onNoteChipClick,
}: DayCellProps) {
  const visibleTasks = tasks.slice(0, MAX_VISIBLE_TASKS);
  const hiddenTasks = tasks.slice(MAX_VISIBLE_TASKS);
  const remainingCount = hiddenTasks.length;

  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const closeMore = () => setShowMore(false);
  useClickOutside(moreRef, closeMore, showMore);

  const cellBg = isCurrentMonth ? "bg-notion-bg" : "bg-notion-bg-secondary/50";
  const dateColor = isToday
    ? "w-6 h-6 flex items-center justify-center rounded-full bg-notion-accent text-white font-bold"
    : isCurrentMonth
      ? "text-notion-text"
      : "text-notion-text-secondary/50";

  // Memo mode rendering
  if (calendarMode === "memo") {
    type MemoItem =
      | { kind: "daily"; date: string }
      | { kind: "note"; id: string; title: string };

    const memoItems: MemoItem[] = [];
    if (memo) memoItems.push({ kind: "daily", date: memo.date });
    for (const note of notes ?? []) {
      memoItems.push({
        kind: "note",
        id: note.id,
        title: note.title || "Untitled",
      });
    }

    const visible = memoItems.slice(0, MAX_VISIBLE_MEMO_ITEMS);
    const hidden = memoItems.slice(MAX_VISIBLE_MEMO_ITEMS);
    const hiddenMemoCount = hidden.length;

    return (
      <div
        className={`group min-h-30 border border-notion-border p-1.5 ${cellBg}`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className={`text-xs ${dateColor}`}>{date.getDate()}</div>
        </div>
        <div className="space-y-0.5">
          {routineCompletion && routineCompletion.total > 0 && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] truncate"
              style={{
                backgroundColor:
                  routineCompletion.completed === routineCompletion.total
                    ? "#DCFCE7"
                    : "#F3F4F6",
                color:
                  routineCompletion.completed === routineCompletion.total
                    ? "#16A34A"
                    : "#6B7280",
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  routineCompletion.completed === routineCompletion.total
                    ? "bg-green-500"
                    : "bg-gray-400"
                }`}
              />
              <span className="truncate font-medium">
                {routineCompletion.completed}/{routineCompletion.total}
              </span>
            </div>
          )}

          {visible.map((item) =>
            item.kind === "daily" ? (
              <button
                key="daily"
                onClick={(e) => {
                  e.stopPropagation();
                  onMemoChipClick?.(item.date, e);
                }}
                className="w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] truncate transition-colors hover:opacity-80"
                style={{ backgroundColor: "#FFF9C4", color: "#F59E0B" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="truncate font-medium">Daily</span>
              </button>
            ) : (
              <button
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onNoteChipClick?.(item.id, e);
                }}
                className="w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] truncate transition-colors hover:opacity-80"
                style={{ backgroundColor: "#DBEAFE", color: "#3B82F6" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span className="truncate font-medium">{item.title}</span>
              </button>
            ),
          )}

          {hiddenMemoCount === 1 &&
            (hidden[0].kind === "daily" ? (
              <button
                key="daily-extra"
                onClick={(e) => {
                  e.stopPropagation();
                  onMemoChipClick?.(
                    (hidden[0] as { kind: "daily"; date: string }).date,
                    e,
                  );
                }}
                className="w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] truncate transition-colors hover:opacity-80"
                style={{ backgroundColor: "#FFF9C4", color: "#F59E0B" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="truncate font-medium">Daily</span>
              </button>
            ) : (
              <button
                key={
                  (hidden[0] as { kind: "note"; id: string; title: string }).id
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onNoteChipClick?.(
                    (hidden[0] as { kind: "note"; id: string; title: string })
                      .id,
                    e,
                  );
                }}
                className="w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] truncate transition-colors hover:opacity-80"
                style={{ backgroundColor: "#DBEAFE", color: "#3B82F6" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span className="truncate font-medium">
                  {
                    (hidden[0] as { kind: "note"; id: string; title: string })
                      .title
                  }
                </span>
              </button>
            ))}

          {hiddenMemoCount >= 2 && (
            <div className="relative" ref={moreRef}>
              <button
                className="text-xs text-notion-text-secondary px-1 hover:text-notion-text transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMore(!showMore);
                }}
              >
                +{hiddenMemoCount} more
              </button>
              {showMore && (
                <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1">
                  {hidden.map((item) =>
                    item.kind === "daily" ? (
                      <button
                        key="daily-dropdown"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMemoChipClick?.(item.date, e);
                          setShowMore(false);
                        }}
                        className="w-full flex items-center gap-1 px-2 py-1 text-[11px] truncate transition-colors hover:bg-notion-hover"
                        style={{ color: "#F59E0B" }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span className="truncate font-medium">Daily</span>
                      </button>
                    ) : (
                      <button
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNoteChipClick?.(item.id, e);
                          setShowMore(false);
                        }}
                        className="w-full flex items-center gap-1 px-2 py-1 text-[11px] truncate transition-colors hover:bg-notion-hover"
                        style={{ color: "#3B82F6" }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        <span className="truncate font-medium">
                          {item.title}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tasks mode rendering — tasks only (no routine/memo chips)
  return (
    <div
      className={`group min-h-30 border border-notion-border p-1.5 ${cellBg}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className={`text-xs ${dateColor}`}>{date.getDate()}</div>
        {onCreateTask && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateTask(date, e);
            }}
            className="opacity-0 group-hover:opacity-100 w-5.5 h-5.5 flex items-center justify-center rounded hover:bg-notion-hover text-notion-text-secondary transition-opacity"
          >
            <Plus size={12} />
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        {visibleTasks.map((task) => (
          <CalendarTaskItem
            key={task.id}
            task={task}
            onClick={(e) => onSelectTask(task.id, e)}
            color={getTaskColor?.(task.id)}
            tag={getFolderTag?.(task.id)}
          />
        ))}
        {remainingCount === 1 && (
          <CalendarTaskItem
            key={hiddenTasks[0].id}
            task={hiddenTasks[0]}
            onClick={(e) => onSelectTask(hiddenTasks[0].id, e)}
            color={getTaskColor?.(hiddenTasks[0].id)}
            tag={getFolderTag?.(hiddenTasks[0].id)}
          />
        )}
        {remainingCount >= 2 && (
          <div className="relative" ref={moreRef}>
            <button
              className="text-xs text-notion-text-secondary px-1 hover:text-notion-text transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowMore(!showMore);
              }}
            >
              +{remainingCount} more
            </button>
            {showMore && (
              <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1">
                {hiddenTasks.map((task) => (
                  <CalendarTaskItem
                    key={task.id}
                    task={task}
                    onClick={(e) => {
                      onSelectTask(task.id, e);
                      setShowMore(false);
                    }}
                    color={getTaskColor?.(task.id)}
                    tag={getFolderTag?.(task.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
