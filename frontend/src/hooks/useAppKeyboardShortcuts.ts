import { useEffect, useCallback } from "react";
import type { SectionId } from "../types/taskTree";
import type { TaskNode } from "../types/taskTree";
import { useShortcutConfig } from "./useShortcutConfig";

interface UseAppKeyboardShortcutsParams {
  timer: {
    isRunning: boolean;
    pause: () => void;
    start: () => void;
    reset: () => void;
  };
  addNode: (
    type: "task" | "folder",
    parentId: string | null,
    title: string,
  ) => TaskNode | undefined;
  setActiveSection: (section: SectionId) => void;
  setIsCommandPaletteOpen: (
    open: boolean | ((prev: boolean) => boolean),
  ) => void;
  selectedTaskId?: string | null;
  nodes: TaskNode[];
  activeSection: SectionId;
}

export function useAppKeyboardShortcuts({
  timer,
  addNode,
  setActiveSection,
  setIsCommandPaletteOpen,
  selectedTaskId,
  nodes,
  activeSection,
}: UseAppKeyboardShortcutsParams) {
  const { matchEvent } = useShortcutConfig();

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
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette (Cmd+K) — skip if editor text is selected
      if (matchEvent(e, "global:command-palette")) {
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

      if (matchEvent(e, "global:settings")) {
        e.preventDefault();
        setActiveSection("settings");
        return;
      }

      if (matchEvent(e, "nav:schedule")) {
        e.preventDefault();
        setActiveSection("schedule");
        return;
      }
      if (matchEvent(e, "nav:ideas")) {
        e.preventDefault();
        setActiveSection("ideas");
        return;
      }
      if (matchEvent(e, "nav:work")) {
        e.preventDefault();
        setActiveSection("work");
        return;
      }
      if (matchEvent(e, "nav:analytics")) {
        e.preventDefault();
        setActiveSection("analytics");
        return;
      }

      if (matchEvent(e, "global:work-timer")) {
        e.preventDefault();
        setActiveSection("work");
        return;
      }

      if (isInputFocused(e)) return;

      if (matchEvent(e, "global:play-pause")) {
        e.preventDefault();
        if (timer.isRunning) timer.pause();
        else timer.start();
      }

      if (matchEvent(e, "global:new-task")) {
        e.preventDefault();
        let parentId: string | null = null;
        if (activeSection === "schedule" && selectedTaskId) {
          const selected = nodes.find((n) => n.id === selectedTaskId);
          if (selected) {
            parentId =
              selected.type === "folder"
                ? selected.id
                : (selected.parentId ?? null);
          }
        }
        addNode("task", parentId, "New Task");
      }

      if (matchEvent(e, "global:reset-timer")) {
        e.preventDefault();
        timer.reset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    timer,
    addNode,
    isInputFocused,
    setActiveSection,
    setIsCommandPaletteOpen,
    matchEvent,
    selectedTaskId,
    nodes,
    activeSection,
  ]);
}
