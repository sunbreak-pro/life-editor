import { useMemo, type RefObject } from "react";
import type { Command } from "../components/CommandPalette/CommandPalette";
import type { LayoutHandle } from "../components/Layout";
import type { TaskNode } from "../types/taskTree";
import type { SectionId } from "../types/taskTree";
import { isMac } from "../utils/platform";
import {
  ListTodo,
  StickyNote,
  Timer,
  CalendarClock,
  BarChart3,
  Settings as SettingsIcon,
  Lightbulb,
  Plus,
  FolderPlus,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  PanelLeft,
  PanelRight,
} from "lucide-react";

interface UseAppCommandsParams {
  setActiveSection: (section: SectionId) => void;
  addNode: (
    type: "task" | "folder",
    parentId: string | null,
    title: string,
  ) => TaskNode | undefined;
  selectedTask: TaskNode | null;
  softDelete: (id: string) => void;
  setSelectedTaskId: (id: string | null) => void;
  timer: {
    isRunning: boolean;
    pause: () => void;
    start: () => void;
    reset: () => void;
  };
  layoutRef: RefObject<LayoutHandle | null>;
}

export function useAppCommands({
  setActiveSection,
  addNode,
  selectedTask,
  softDelete,
  setSelectedTaskId,
  timer,
  layoutRef,
}: UseAppCommandsParams): Command[] {
  return useMemo(
    () => [
      {
        id: "nav-tasks",
        title: "Go to Tasks",
        category: "Navigation",
        shortcut: isMac ? "⌘1" : "Ctrl+1",
        icon: ListTodo,
        action: () => setActiveSection("tasks"),
      },
      {
        id: "nav-memo",
        title: "Go to Memo",
        category: "Navigation",
        icon: StickyNote,
        action: () => setActiveSection("memo"),
      },
      {
        id: "nav-music",
        title: "Go to Music",
        category: "Navigation",
        shortcut: isMac ? "⌘2" : "Ctrl+2",
        icon: Timer,
        action: () => setActiveSection("music"),
      },
      {
        id: "nav-work",
        title: "Go to Work",
        category: "Navigation",
        shortcut: isMac ? "⌘⇧T" : "Ctrl+Shift+T",
        icon: Play,
        action: () => setActiveSection("work"),
      },
      {
        id: "nav-schedule",
        title: "Go to Schedule",
        category: "Navigation",
        shortcut: isMac ? "⌘3" : "Ctrl+3",
        icon: CalendarClock,
        action: () => setActiveSection("schedule"),
      },
      {
        id: "nav-analytics",
        title: "Go to Analytics",
        category: "Navigation",
        shortcut: isMac ? "⌘4" : "Ctrl+4",
        icon: BarChart3,
        action: () => setActiveSection("analytics"),
      },
      {
        id: "nav-settings",
        title: "Go to Settings",
        category: "Navigation",
        shortcut: isMac ? "⌘," : "Ctrl+,",
        icon: SettingsIcon,
        action: () => setActiveSection("settings"),
      },
      {
        id: "nav-tips",
        title: "Go to Tips",
        category: "Navigation",
        icon: Lightbulb,
        action: () => setActiveSection("tips"),
      },
      {
        id: "task-create",
        title: "Create new task",
        category: "Task",
        shortcut: "n",
        icon: Plus,
        action: () => addNode("task", null, "New Task"),
      },
      {
        id: "task-create-folder",
        title: "Create new folder",
        category: "Task",
        icon: FolderPlus,
        action: () => addNode("folder", null, "New Folder"),
      },
      {
        id: "task-delete",
        title: "Delete selected task",
        category: "Task",
        shortcut: "Del",
        icon: Trash2,
        action: () => {
          if (selectedTask) {
            softDelete(selectedTask.id);
            setSelectedTaskId(null);
          }
        },
      },
      {
        id: "timer-toggle",
        title: timer.isRunning ? "Pause timer" : "Start timer",
        category: "Timer",
        shortcut: "Space",
        icon: timer.isRunning ? Pause : Play,
        action: () => {
          if (timer.isRunning) timer.pause();
          else timer.start();
        },
      },
      {
        id: "timer-reset",
        title: "Reset timer",
        category: "Timer",
        shortcut: "r",
        icon: RotateCcw,
        action: () => timer.reset(),
      },
      {
        id: "view-left-sidebar",
        title: "Toggle left sidebar",
        category: "View",
        shortcut: isMac ? "⌘." : "Ctrl+.",
        icon: PanelLeft,
        action: () => layoutRef.current?.toggleLeftSidebar(),
      },
      {
        id: "view-right-sidebar",
        title: "Toggle right sidebar",
        category: "View",
        shortcut: isMac ? "⌘⇧." : "Ctrl+Shift+.",
        icon: PanelRight,
        action: () => layoutRef.current?.toggleRightSidebar(),
      },
    ],
    [
      addNode,
      selectedTask,
      softDelete,
      setSelectedTaskId,
      timer,
      setActiveSection,
      layoutRef,
    ],
  );
}
