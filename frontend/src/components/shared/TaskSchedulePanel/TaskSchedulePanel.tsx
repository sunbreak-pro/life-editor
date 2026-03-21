import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { ExistingTaskTab } from "./ExistingTaskTab";
import { NewTaskTab } from "./NewTaskTab";
import type { TaskNode } from "../../../types/taskTree";

export type PanelTab = "existingTasks" | "newTask";

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
  existingTaskIds?: Set<string>;
  visibleTabs?: PanelTab[];
  defaultTab?: PanelTab;
  onSelectExistingTask?: (task: TaskNode, schedule: ScheduleParams) => void;
  onCreateNewTask?: (
    title: string,
    parentId: string | null,
    schedule: ScheduleParams,
  ) => void;
  onClose: () => void;
  folders?: TaskNode[];
}

const TAB_KEYS: Record<PanelTab, string> = {
  existingTasks: "schedulePanel.existingTasks",
  newTask: "schedulePanel.newTask",
};

export function TaskSchedulePanel({
  position,
  date,
  defaultStartTime = "09:00",
  defaultEndTime = "10:00",
  existingTaskIds,
  visibleTabs,
  defaultTab,
  onSelectExistingTask,
  onCreateNewTask,
  onClose,
  folders,
}: TaskSchedulePanelProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const tabs = visibleTabs ?? (["existingTasks", "newTask"] as PanelTab[]);
  const [activeTab, setActiveTab] = useState<PanelTab>(defaultTab ?? tabs[0]);

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

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-notion-bg border border-notion-border rounded-lg shadow-xl overflow-hidden"
      style={{ left, top, width: panelWidth }}
    >
      {/* Tab header */}
      {tabs.length > 1 && (
        <div className="flex border-b border-notion-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "text-notion-accent border-b-2 border-notion-accent"
                  : "text-notion-text-secondary hover:text-notion-text"
              }`}
            >
              {t(TAB_KEYS[tab])}
            </button>
          ))}
        </div>
      )}

      {activeTab === "existingTasks" && onSelectExistingTask && (
        <ExistingTaskTab
          date={date}
          defaultStartTime={defaultStartTime}
          defaultEndTime={defaultEndTime}
          existingTaskIds={existingTaskIds}
          onSelectExistingTask={onSelectExistingTask}
          onClose={onClose}
        />
      )}

      {activeTab === "newTask" && onCreateNewTask && (
        <NewTaskTab
          date={date}
          defaultStartTime={defaultStartTime}
          defaultEndTime={defaultEndTime}
          folders={folders}
          onCreateNewTask={onCreateNewTask}
          onClose={onClose}
        />
      )}
    </div>
  );
}
