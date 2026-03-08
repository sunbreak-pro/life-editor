import { useState, useCallback, useMemo, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import type { TabItem } from "../shared/SectionTabs";
import { VerticalNavList } from "../shared/VerticalNavList";
import { CalendarView } from "./Schedule/Calendar/CalendarView";
import { OneDaySchedule } from "./Schedule/DayFlow/OneDaySchedule";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useCalendar } from "../../hooks/useCalendar";
import { formatDateKey } from "../../utils/dateKey";
import { RightSidebarContext } from "../../context/RightSidebarContext";

type ScheduleSubTab = "calendar" | "dayflow";

const SCHEDULE_TABS: readonly TabItem<ScheduleSubTab>[] = [
  { id: "calendar", labelKey: "tabs.calendar" },
  { id: "dayflow", labelKey: "tabs.dayflow" },
];

interface ScheduleTabViewProps {
  onCalendarSelectTask: (taskId: string, e: React.MouseEvent) => void;
  onCreateTask?: (
    title: string,
    parentId: string | null,
    schedule: {
      scheduledAt: string;
      scheduledEndAt?: string;
      isAllDay?: boolean;
    },
  ) => void;
  onStartTimer?: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
}

export function ScheduleTabView({
  onCalendarSelectTask,
  onCreateTask,
  onStartTimer,
  onSelectTask,
}: ScheduleTabViewProps) {
  const [subTab, setSubTab] = useState<ScheduleSubTab>("calendar");
  const [dayFlowDate, setDayFlowDate] = useState<Date>(() => new Date());

  const { nodes, getTaskColor, getFolderTagForTask } = useTaskTreeContext();

  const { tasksByDate } = useCalendar(
    nodes,
    dayFlowDate.getFullYear(),
    dayFlowDate.getMonth(),
    "incomplete",
    dayFlowDate,
  );

  // All tasks by date (including DONE) for DayFlow right panel
  const allTasksByDate = useMemo(() => {
    const map = new Map<string, typeof nodes>();
    for (const task of nodes) {
      if (task.type !== "task" || !task.scheduledAt || task.isDeleted) continue;
      const key = formatDateKey(new Date(task.scheduledAt));
      const existing = map.get(key);
      if (existing) existing.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [nodes]);

  const goToPrev = useCallback(() => {
    setDayFlowDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const goToNext = useCallback(() => {
    setDayFlowDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  const goToToday = useCallback(() => {
    setDayFlowDate(new Date());
  }, []);

  const { portalTarget: rightSidebarTarget, requestOpen } =
    useContext(RightSidebarContext);

  useEffect(() => {
    requestOpen();
  }, [requestOpen]);

  return (
    <div className="h-full flex flex-col">
      {rightSidebarTarget &&
        createPortal(
          <VerticalNavList
            items={SCHEDULE_TABS}
            activeItem={subTab}
            onItemChange={setSubTab}
          />,
          rightSidebarTarget,
        )}
      <div className="flex-1 min-h-0 overflow-auto">
        {subTab === "calendar" ? (
          <CalendarView
            onSelectTask={onSelectTask}
            onCreateTask={onCreateTask}
            onStartTimer={onStartTimer}
          />
        ) : (
          <OneDaySchedule
            date={dayFlowDate}
            tasksByDate={tasksByDate}
            allTasksByDate={allTasksByDate}
            onSelectTask={onCalendarSelectTask}
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
            onPrevDate={goToPrev}
            onNextDate={goToNext}
            onToday={goToToday}
          />
        )}
      </div>
    </div>
  );
}
