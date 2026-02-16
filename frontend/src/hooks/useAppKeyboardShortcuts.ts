import { useEffect, useCallback } from "react";
import type { SectionId } from "../types/taskTree";
import type { TaskNode } from "../types/taskTree";

interface UseAppKeyboardShortcutsParams {
  timer: {
    isRunning: boolean;
    pause: () => void;
    start: () => void;
    reset: () => void;
  };
  selectedTask: TaskNode | null;
  addNode: (
    type: "task" | "folder",
    parentId: string | null,
    title: string,
  ) => TaskNode | undefined;
  setActiveSection: (section: SectionId) => void;
  setIsCommandPaletteOpen: (
    open: boolean | ((prev: boolean) => boolean),
  ) => void;
  handleDeleteSelectedTask: () => void;
}

export function useAppKeyboardShortcuts({
  timer,
  selectedTask,
  addNode,
  setActiveSection,
  setIsCommandPaletteOpen,
  handleDeleteSelectedTask,
}: UseAppKeyboardShortcutsParams) {
  const isInputFocused = useCallback((e: KeyboardEvent) => {
    const el = e.target as Element | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return true;
    if (el.getAttribute("contenteditable") === "true") return true;
    if (el.closest?.('[contenteditable="true"]')) return true;
    return false;
  }, []);

  useEffect(() => {
    const sectionMap: Record<string, SectionId> = {
      "1": "tasks",
      "2": "music",
      "3": "schedule",
      "4": "analytics",
      "5": "settings",
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.shiftKey && e.code === "KeyK") {
        const el = document.activeElement;
        const isEditorWithSelection =
          el?.getAttribute("contenteditable") === "true" &&
          window.getSelection()?.toString();
        if (!isEditorWithSelection) {
          e.preventDefault();
          setIsCommandPaletteOpen((prev: boolean) => !prev);
          return;
        }
      }

      if (mod && e.code === "Comma") {
        e.preventDefault();
        setActiveSection("settings");
        return;
      }

      if (mod && !e.shiftKey && sectionMap[e.key]) {
        e.preventDefault();
        setActiveSection(sectionMap[e.key]);
        return;
      }

      if (mod && e.shiftKey && e.code === "KeyT") {
        e.preventDefault();
        setActiveSection("work");
        return;
      }

      if (isInputFocused(e)) return;

      if (e.key === " ") {
        e.preventDefault();
        if (timer.isRunning) timer.pause();
        else timer.start();
      }

      if (e.key === "n") {
        e.preventDefault();
        addNode("task", null, "New Task");
      }

      if (e.key === "r") {
        e.preventDefault();
        timer.reset();
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedTask) {
        e.preventDefault();
        handleDeleteSelectedTask();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    timer,
    selectedTask,
    addNode,
    isInputFocused,
    handleDeleteSelectedTask,
    setActiveSection,
    setIsCommandPaletteOpen,
  ]);
}
