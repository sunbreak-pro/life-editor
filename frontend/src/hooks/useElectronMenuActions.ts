import { useEffect, type RefObject } from "react";
import type { LayoutHandle } from "../components/Layout";
import type { SectionId, TaskNode } from "../types/taskTree";
import { getDataService } from "../services";
import { onMenuAction } from "../services/events";

interface UseElectronMenuActionsParams {
  addNode: (
    type: "task" | "folder",
    parentId: string | null,
    title: string,
  ) => TaskNode | undefined;
  setActiveSection: (section: SectionId) => void;
  layoutRef: RefObject<LayoutHandle | null>;
  selectedTaskId?: string | null;
  nodes?: TaskNode[];
}

export function useElectronMenuActions({
  addNode,
  setActiveSection,
  layoutRef,
  selectedTaskId,
  nodes,
}: UseElectronMenuActionsParams) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    onMenuAction((action: string) => {
      switch (action) {
        case "new-task": {
          let parentId: string | null = null;
          if (selectedTaskId && nodes) {
            const sel = nodes.find((n) => n.id === selectedTaskId);
            if (sel) {
              parentId =
                sel.type === "folder" ? sel.id : (sel.parentId ?? null);
            }
          }
          addNode("task", parentId, "New Task");
          break;
        }
        case "new-folder":
          addNode("folder", null, "New Folder");
          break;
        case "navigate:settings":
          setActiveSection("settings");
          break;
        case "navigate:tips":
          break;
        case "toggle-timer-modal":
        case "toggleTimer":
          setActiveSection("work");
          break;
        case "toggle-left-sidebar":
          layoutRef.current?.toggleLeftSidebar();
          break;
        case "toggle-terminal":
          layoutRef.current?.toggleTerminal();
          break;
        case "quickAddTask":
          addNode("task", null, "New Task");
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
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [addNode, setActiveSection, layoutRef, selectedTaskId, nodes]);
}
