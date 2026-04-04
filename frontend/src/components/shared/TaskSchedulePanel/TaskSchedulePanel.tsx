import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ListTodo, CalendarDays, CalendarClock } from "lucide-react";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { ExistingTaskTab } from "./ExistingTaskTab";
import { NewTaskTab } from "./NewTaskTab";
import { EventTab } from "./EventTab";
import { RoutineTab } from "./RoutineTab";
import type { TaskNode } from "../../../types/taskTree";
import type { ScheduleItem } from "../../../types/schedule";
import type { RoutineNode } from "../../../types/routine";
import type { RoutineGroup } from "../../../types/routineGroup";

export type PanelTab = "task" | "event" | "routine";

interface ScheduleParams {
  scheduledAt: string;
  scheduledEndAt?: string;
  isAllDay?: boolean;
}

export interface TaskSchedulePanelProps {
  position: { x: number; y: number };
  date: Date;
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultTab?: PanelTab;
  // Task
  existingTaskIds?: Set<string>;
  onSelectExistingTask?: (task: TaskNode, schedule: ScheduleParams) => void;
  onCreateNewTask?: (
    title: string,
    parentId: string | null,
    schedule: ScheduleParams,
  ) => void;
  folders?: TaskNode[];
  // Event
  recentEvents?: ScheduleItem[];
  onCreateEvent?: (
    title: string,
    startTime: string,
    endTime: string,
    memo: string,
  ) => void;
  onDuplicateEvent?: (event: ScheduleItem) => void;
  // Routine
  routines?: RoutineNode[];
  routineGroups?: RoutineGroup[];
  routinesByGroup?: Map<string, RoutineNode[]>;
  onSelectRoutine?: (
    routine: RoutineNode,
    startTime: string,
    endTime: string,
  ) => void;
  onSelectGroup?: (
    group: RoutineGroup,
    routines: RoutineNode[],
    startTime: string,
    endTime: string,
  ) => void;
  onCreateRoutine?: (title: string, startTime: string, endTime: string) => void;
  // Common
  onClose: () => void;
}

const TAB_CONFIG: {
  key: PanelTab;
  icon: typeof ListTodo;
  labelKey: string;
  fallback: string;
}[] = [
  {
    key: "task",
    icon: ListTodo,
    labelKey: "schedulePanel.tabTask",
    fallback: "Task",
  },
  {
    key: "event",
    icon: CalendarDays,
    labelKey: "schedulePanel.tabEvent",
    fallback: "Event",
  },
  {
    key: "routine",
    icon: CalendarClock,
    labelKey: "schedulePanel.tabRoutine",
    fallback: "Routine",
  },
];

export function TaskSchedulePanel({
  position,
  date,
  defaultStartTime = "09:00",
  defaultEndTime = "10:00",
  defaultTab = "task",
  existingTaskIds,
  onSelectExistingTask,
  onCreateNewTask,
  folders,
  recentEvents,
  onCreateEvent,
  onDuplicateEvent,
  routines,
  routineGroups,
  routinesByGroup,
  onSelectRoutine,
  onSelectGroup,
  onCreateRoutine,
  onClose,
}: TaskSchedulePanelProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>(defaultTab);
  const [useExisting, setUseExisting] = useState(false);

  useClickOutside(ref, onClose, true);

  // Position calculation
  const panelWidth = 320;
  const panelHeight = 400;
  const margin = 16;
  const left = Math.min(position.x, window.innerWidth - panelWidth - margin);
  const spaceBelow = window.innerHeight - position.y - margin;
  const top =
    spaceBelow >= panelHeight
      ? position.y
      : Math.max(margin, position.y - panelHeight);

  // Determine which tabs to show based on provided callbacks
  const availableTabs = TAB_CONFIG.filter((tab) => {
    if (tab.key === "task") return !!onSelectExistingTask || !!onCreateNewTask;
    if (tab.key === "event") return !!onCreateEvent;
    if (tab.key === "routine") return !!onSelectRoutine;
    return false;
  });

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-notion-bg border border-notion-border rounded-lg shadow-xl overflow-hidden"
      style={{ left, top, width: panelWidth }}
    >
      {/* Tab header + existing toggle */}
      <div className="border-b border-notion-border">
        <div className="flex">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "text-notion-accent border-b-2 border-notion-accent"
                    : "text-notion-text-secondary hover:text-notion-text"
                }`}
              >
                <Icon size={12} />
                {t(tab.labelKey, tab.fallback)}
              </button>
            );
          })}
        </div>

        {/* Existing toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-notion-bg-secondary/50">
          <label className="flex items-center gap-1.5 text-[11px] text-notion-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useExisting}
              onChange={(e) => setUseExisting(e.target.checked)}
              className="w-3 h-3 rounded border-notion-border accent-notion-accent"
            />
            {t("schedulePanel.useExisting", "Select existing")}
          </label>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "task" && (
        <>
          {useExisting && onSelectExistingTask ? (
            <ExistingTaskTab
              date={date}
              defaultStartTime={defaultStartTime}
              defaultEndTime={defaultEndTime}
              existingTaskIds={existingTaskIds}
              onSelectExistingTask={onSelectExistingTask}
              onClose={onClose}
            />
          ) : onCreateNewTask ? (
            <NewTaskTab
              date={date}
              defaultStartTime={defaultStartTime}
              defaultEndTime={defaultEndTime}
              folders={folders}
              onCreateNewTask={onCreateNewTask}
              onClose={onClose}
            />
          ) : null}
        </>
      )}

      {activeTab === "event" && onCreateEvent && (
        <EventTab
          date={date}
          defaultStartTime={defaultStartTime}
          defaultEndTime={defaultEndTime}
          useExisting={useExisting}
          recentEvents={recentEvents}
          onCreateEvent={onCreateEvent}
          onDuplicateEvent={onDuplicateEvent}
          onClose={onClose}
        />
      )}

      {activeTab === "routine" &&
        routines &&
        routineGroups &&
        routinesByGroup &&
        onSelectRoutine &&
        onSelectGroup && (
          <RoutineTab
            defaultStartTime={defaultStartTime}
            defaultEndTime={defaultEndTime}
            useExisting={useExisting}
            routines={routines}
            routineGroups={routineGroups}
            routinesByGroup={routinesByGroup}
            onSelectRoutine={onSelectRoutine}
            onSelectGroup={onSelectGroup}
            onCreateRoutine={onCreateRoutine}
            onClose={onClose}
          />
        )}
    </div>
  );
}
