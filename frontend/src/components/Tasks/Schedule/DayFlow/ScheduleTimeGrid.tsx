import { useEffect, useRef, useState, useMemo } from "react";
import type { TaskNode } from "../../../../types/taskTree";
import type { ScheduleItem } from "../../../../types/schedule";
import { TIME_GRID } from "../../../../constants/timeGrid";
import { TimeGridTaskBlock } from "../Calendar/TimeGridTaskBlock";
import { ScheduleItemBlock } from "./ScheduleItemBlock";
import { formatDateKey } from "../../../../utils/dateKey";

const HOURS = Array.from(
  { length: TIME_GRID.END_HOUR - TIME_GRID.START_HOUR },
  (_, i) => i + TIME_GRID.START_HOUR,
);
const GUTTER_WIDTH = 52;

interface PositionedTask {
  task: TaskNode;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
}

interface PositionedScheduleItem {
  item: ScheduleItem;
  top: number;
  height: number;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function layoutTasks(tasks: TaskNode[], dayDate: Date): PositionedTask[] {
  const positioned: PositionedTask[] = tasks.map((task) => {
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(24, 0, 0, 0);

    const taskStart = task.scheduledAt ? new Date(task.scheduledAt) : dayStart;
    const taskEnd = task.scheduledEndAt
      ? new Date(task.scheduledEndAt)
      : new Date(
          taskStart.getTime() + (task.workDurationMinutes ?? 25) * 60000,
        );

    const clampedStart = taskStart < dayStart ? dayStart : taskStart;
    const clampedEnd = taskEnd > dayEnd ? dayEnd : taskEnd;

    const top =
      (clampedStart.getHours() - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT +
      (clampedStart.getMinutes() / 60) * TIME_GRID.SLOT_HEIGHT;
    const durationMinutes = Math.max(
      (clampedEnd.getTime() - clampedStart.getTime()) / 60000,
      0,
    );
    const height = Math.max((durationMinutes / 60) * TIME_GRID.SLOT_HEIGHT, 20);
    return { task, top, height, column: 0, totalColumns: 1 };
  });

  positioned.sort((a, b) => a.top - b.top);

  const groups: PositionedTask[][] = [];
  for (const item of positioned) {
    let placed = false;
    for (const group of groups) {
      const overlaps = group.some(
        (g) => item.top < g.top + g.height && item.top + item.height > g.top,
      );
      if (overlaps) {
        item.column = group.length;
        group.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      item.column = 0;
      groups.push([item]);
    }
  }

  for (const group of groups) {
    const total = Math.min(group.length, 5);
    for (const item of group) {
      item.totalColumns = total;
    }
  }

  return positioned;
}

function layoutScheduleItems(items: ScheduleItem[]): PositionedScheduleItem[] {
  return items.map((item) => {
    const startMin = timeToMinutes(item.startTime);
    const endMin = timeToMinutes(item.endTime);
    const top = (startMin / 60 - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT;
    const height = Math.max(
      ((endMin - startMin) / 60) * TIME_GRID.SLOT_HEIGHT,
      20,
    );
    return { item, top, height };
  });
}

interface ScheduleTimeGridProps {
  date: Date;
  scheduleItems: ScheduleItem[];
  tasks: TaskNode[];
  onToggleComplete: (id: string) => void;
  onClickItem: (id: string) => void;
  onClickTask: (taskId: string, e: React.MouseEvent) => void;
  onCreateItem: (
    startTime: string,
    endTime: string,
    e: React.MouseEvent,
  ) => void;
  getTaskColor?: (taskId: string) => string | undefined;
  getFolderTag?: (taskId: string) => string;
}

export function ScheduleTimeGrid({
  date,
  scheduleItems,
  tasks,
  onToggleComplete,
  onClickItem,
  onClickTask,
  onCreateItem,
  getTaskColor,
  getFolderTag,
}: ScheduleTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const todayKey = formatDateKey(new Date());
  const dateKey = formatDateKey(date);
  const isToday = dateKey === todayKey;
  const totalHeight =
    (TIME_GRID.END_HOUR - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT;

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollTo = Math.max(
        0,
        (now.getHours() - 1) * TIME_GRID.SLOT_HEIGHT,
      );
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  const positionedTasks = useMemo(() => {
    const timeTasks = tasks.filter((t) => t.scheduledAt && !t.isAllDay);
    return layoutTasks(timeTasks, date);
  }, [tasks, date]);

  const positionedItems = useMemo(
    () => layoutScheduleItems(scheduleItems),
    [scheduleItems],
  );

  const nextItemId = useMemo(() => {
    const sorted = [...scheduleItems].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
    return sorted.find((i) => !i.completed)?.id ?? null;
  }, [scheduleItems]);

  const currentTimeTop =
    (currentTime.getHours() - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT +
    (currentTime.getMinutes() / 60) * TIME_GRID.SLOT_HEIGHT;

  const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawHour = y / TIME_GRID.SLOT_HEIGHT + TIME_GRID.START_HOUR;
    const hour = Math.floor(rawHour);
    const snappedMinute = Math.round(((rawHour % 1) * 60) / 15) * 15;
    const finalMinute = snappedMinute >= 60 ? 0 : snappedMinute;
    const finalHour = snappedMinute >= 60 ? hour + 1 : hour;

    const startTime = `${String(finalHour).padStart(2, "0")}:${String(finalMinute).padStart(2, "0")}`;
    const endHour = finalHour + 1;
    const endTime = `${String(Math.min(endHour, 23)).padStart(2, "0")}:${String(finalMinute).padStart(2, "0")}`;

    onCreateItem(startTime, endTime, e);
  };

  return (
    <div className="border h-full border-notion-border rounded-lg overflow-hidden bg-notion-bg flex-1">
      <div ref={scrollRef} className="overflow-y-auto h-full relative">
        <div className="flex relative" style={{ height: totalHeight }}>
          {/* Time gutter */}
          <div style={{ width: GUTTER_WIDTH }} className="shrink-0 relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 text-[10px] text-notion-text-secondary -translate-y-1/2"
                style={{
                  top: (hour - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT,
                }}
              >
                {hour > 0 && formatHour(hour)}
              </div>
            ))}
          </div>

          {/* Main column */}
          <div
            className="flex-1 relative border-l border-notion-border cursor-pointer"
            onClick={handleColumnClick}
          >
            {/* Hour grid lines */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute w-full border-t border-notion-border/50"
                style={{
                  top: (hour - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT,
                }}
              />
            ))}

            {/* Current time indicator */}
            {isToday && (
              <div
                className="absolute w-full z-30 pointer-events-none"
                style={{ top: currentTimeTop }}
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              </div>
            )}

            {/* Task blocks (dim appearance) */}
            <div className="opacity-30">
              {positionedTasks.map((p) => (
                <TimeGridTaskBlock
                  key={p.task.id}
                  task={p.task}
                  top={p.top}
                  height={p.height}
                  left={`${60 + (p.column / p.totalColumns) * 40}%`}
                  width={`${(1 / p.totalColumns) * 40}%`}
                  color={getTaskColor?.(p.task.id)}
                  tag={getFolderTag?.(p.task.id)}
                  onClick={(e) => onClickTask(p.task.id, e)}
                />
              ))}
            </div>

            {/* Schedule item blocks */}
            {positionedItems.map((p) => (
              <ScheduleItemBlock
                key={p.item.id}
                item={p.item}
                top={p.top}
                height={p.height}
                isNext={p.item.id === nextItemId}
                onToggleComplete={onToggleComplete}
                onClick={onClickItem}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
