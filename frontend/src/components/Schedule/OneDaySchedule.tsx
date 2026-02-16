import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../types/taskTree";
import { useScheduleContext } from "../../hooks/useScheduleContext";
import { formatDateKey } from "../../utils/dateKey";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { ScheduleItemCreatePopover } from "./ScheduleItemCreatePopover";
import { TodayFlowTab } from "./TodayFlowTab";
import { RoutinesTab } from "./RoutinesTab";

interface OneDayScheduleProps {
  date: Date;
  tasksByDate: Map<string, TaskNode[]>;
  onSelectTask: (taskId: string, e: React.MouseEvent) => void;
  getTaskColor?: (taskId: string) => string | undefined;
  getFolderTag?: (taskId: string) => string;
}

export function OneDaySchedule({
  date,
  tasksByDate,
  onSelectTask,
  getTaskColor,
  getFolderTag,
}: OneDayScheduleProps) {
  const { t } = useTranslation();
  const {
    scheduleItems,
    loadItemsForDate,
    createScheduleItem,
    toggleComplete,
    routines,
    templates,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addTemplateItem,
    removeTemplateItem,
    ensureTemplateItemsForDate,
    getRoutineCompletionRate,
    routineStats,
    refreshRoutineStats,
  } = useScheduleContext();

  const dateKey = formatDateKey(date);
  const [rightTab, setRightTab] = useState<"flow" | "routines">("flow");
  const [createPopover, setCreatePopover] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null>(null);

  // Load schedule items when date changes
  useEffect(() => {
    loadItemsForDate(dateKey);
  }, [dateKey, loadItemsForDate]);

  // Auto-insert template items when date/templates change
  useEffect(() => {
    if (templates.length > 0 && routines.length > 0) {
      ensureTemplateItemsForDate(dateKey, templates, routines);
    }
  }, [dateKey, templates, routines, ensureTemplateItemsForDate]);

  // Load routine stats on mount and when routines change
  useEffect(() => {
    if (routines.length > 0) {
      refreshRoutineStats(routines);
    }
  }, [routines, refreshRoutineStats]);

  const dayTasks = useMemo(
    () => tasksByDate.get(dateKey) ?? [],
    [tasksByDate, dateKey],
  );

  const handleCreateItem = (
    startTime: string,
    endTime: string,
    e: React.MouseEvent,
  ) => {
    setCreatePopover({
      startTime,
      endTime,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Left: Time Grid */}
      <div className="flex-1 min-w-[300px]">
        <ScheduleTimeGrid
          date={date}
          scheduleItems={scheduleItems}
          tasks={dayTasks}
          onToggleComplete={toggleComplete}
          onClickItem={() => {}}
          onClickTask={onSelectTask}
          onCreateItem={handleCreateItem}
          getTaskColor={getTaskColor}
          getFolderTag={getFolderTag}
        />
      </div>

      {/* Right: Tab panel */}
      <div className="flex-1 min-w-[300px] border border-notion-border rounded-lg bg-notion-bg overflow-hidden flex flex-col">
        {/* Tab header */}
        <div className="flex border-b border-notion-border">
          <button
            onClick={() => setRightTab("flow")}
            className={`flex-1 px-3 py-2 text-xs transition-colors ${
              rightTab === "flow"
                ? "text-notion-accent border-b-2 border-notion-accent font-medium"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            {t("schedule.todayFlow", "Today Flow")}
          </button>
          <button
            onClick={() => setRightTab("routines")}
            className={`flex-1 px-3 py-2 text-xs transition-colors ${
              rightTab === "routines"
                ? "text-notion-accent border-b-2 border-notion-accent font-medium"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            {t("schedule.routines", "Routines")}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {rightTab === "flow" ? (
            <TodayFlowTab
              items={scheduleItems}
              onToggleComplete={toggleComplete}
            />
          ) : (
            <RoutinesTab
              routines={routines}
              templates={templates}
              onCreateRoutine={createRoutine}
              onUpdateRoutine={updateRoutine}
              onDeleteRoutine={deleteRoutine}
              onCreateTemplate={createTemplate}
              onUpdateTemplate={updateTemplate}
              onDeleteTemplate={deleteTemplate}
              onAddTemplateItem={addTemplateItem}
              onRemoveTemplateItem={removeTemplateItem}
              getCompletionRate={getRoutineCompletionRate}
              routineStats={routineStats}
            />
          )}
        </div>
      </div>

      {/* Create popover */}
      {createPopover && (
        <ScheduleItemCreatePopover
          position={createPopover.position}
          defaultStartTime={createPopover.startTime}
          defaultEndTime={createPopover.endTime}
          onSubmit={(title, startTime, endTime) => {
            createScheduleItem(dateKey, title, startTime, endTime);
          }}
          onClose={() => setCreatePopover(null)}
        />
      )}
    </div>
  );
}
