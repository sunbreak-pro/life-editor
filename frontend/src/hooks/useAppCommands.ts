import { useMemo, type RefObject } from "react";
import type { Command } from "../components/CommandPalette/CommandPalette";
import type { LayoutHandle } from "../components/Layout";
import type { TaskNode } from "../types/taskTree";
import type { SectionId } from "../types/taskTree";
import { useShortcutConfig } from "./useShortcutConfig";
import {
  Calendar,
  Lightbulb,
  BarChart3,
  Settings as SettingsIcon,
  Plus,
  FolderPlus,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  PanelLeft,
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
  nodes?: TaskNode[];
  selectedTaskId?: string | null;
}

export function useAppCommands({
  setActiveSection,
  addNode,
  selectedTask,
  softDelete,
  setSelectedTaskId,
  timer,
  layoutRef,
  nodes,
  selectedTaskId,
}: UseAppCommandsParams): Command[] {
  const { getDisplayString } = useShortcutConfig();

  return useMemo(
    () => [
      {
        id: "nav-schedule",
        title: "Go to Schedule",
        category: "Navigation",
        shortcut: getDisplayString("nav:schedule"),
        icon: Calendar,
        action: () => setActiveSection("schedule"),
      },
      {
        id: "nav-materials",
        title: "Go to Materials",
        category: "Navigation",
        icon: Lightbulb,
        action: () => setActiveSection("materials"),
      },
      {
        id: "nav-connect",
        title: "Go to Connect",
        category: "Navigation",
        shortcut: getDisplayString("nav:ideas"),
        icon: Lightbulb,
        action: () => setActiveSection("connect"),
      },
      {
        id: "nav-work",
        title: "Go to Work",
        category: "Navigation",
        shortcut: getDisplayString("nav:work"),
        icon: Play,
        action: () => setActiveSection("work"),
      },
      {
        id: "nav-analytics",
        title: "Go to Analytics",
        category: "Navigation",
        shortcut: getDisplayString("nav:analytics"),
        icon: BarChart3,
        action: () => setActiveSection("analytics"),
      },
      {
        id: "nav-settings",
        title: "Go to Settings",
        category: "Navigation",
        shortcut: getDisplayString("global:settings"),
        icon: SettingsIcon,
        action: () => setActiveSection("settings"),
      },
      {
        id: "nav-tips",
        title: "Go to Tips",
        category: "Navigation",
        icon: SettingsIcon,
        action: () => setActiveSection("settings"),
      },
      {
        id: "nav-trash",
        title: "Go to Trash",
        category: "Navigation",
        icon: Trash2,
        action: () => setActiveSection("settings"),
      },
      {
        id: "task-create",
        title: "Create new task",
        category: "Task",
        shortcut: getDisplayString("global:new-task"),
        icon: Plus,
        action: () => {
          let parentId: string | null = null;
          if (selectedTaskId && nodes) {
            const sel = nodes.find((n) => n.id === selectedTaskId);
            if (sel) {
              parentId =
                sel.type === "folder" ? sel.id : (sel.parentId ?? null);
            }
          }
          addNode("task", parentId, "New Task");
        },
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
        shortcut: getDisplayString("global:play-pause"),
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
        shortcut: getDisplayString("global:reset-timer"),
        icon: RotateCcw,
        action: () => timer.reset(),
      },
      {
        id: "view-left-sidebar",
        title: "Toggle left sidebar",
        category: "View",
        shortcut: getDisplayString("view:toggle-sidebar"),
        icon: PanelLeft,
        action: () => layoutRef.current?.toggleLeftSidebar(),
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
      getDisplayString,
      nodes,
      selectedTaskId,
    ],
  );
}
