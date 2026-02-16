import { useEffect, type RefObject } from "react";
import type { LayoutHandle } from "../components/Layout";
import type { SectionId, TaskNode } from "../types/taskTree";
import { getDataService } from "../services";

interface UseElectronMenuActionsParams {
  addNode: (
    type: "task" | "folder",
    parentId: string | null,
    title: string,
  ) => TaskNode | undefined;
  setActiveSection: (section: SectionId) => void;
  layoutRef: RefObject<LayoutHandle | null>;
}

export function useElectronMenuActions({
  addNode,
  setActiveSection,
  layoutRef,
}: UseElectronMenuActionsParams) {
  useEffect(() => {
    const cleanup = window.electronAPI?.onMenuAction((action: string) => {
      switch (action) {
        case "new-task":
          addNode("task", null, "New Task");
          break;
        case "new-folder":
          addNode("folder", null, "New Folder");
          break;
        case "navigate:settings":
          setActiveSection("settings");
          break;
        case "navigate:tips":
          setActiveSection("tips");
          break;
        case "toggle-timer-modal":
          setActiveSection("work");
          break;
        case "toggle-left-sidebar":
          layoutRef.current?.toggleLeftSidebar();
          break;
        case "export-data":
          getDataService().exportData().catch(console.warn);
          break;
        case "import-data":
          getDataService()
            .importData()
            .then((ok) => {
              if (ok) window.location.reload();
            })
            .catch(console.warn);
          break;
      }
    });
    return () => {
      cleanup?.();
    };
  }, [addNode, setActiveSection, layoutRef]);
}
