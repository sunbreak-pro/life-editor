import { useRef, useEffect } from "react";
import { PanelLeft, PanelRight, Terminal } from "lucide-react";
import { isMac } from "../../utils/platform";
import type { SectionId } from "../../types/taskTree";
import { UndoRedoButtons } from "../shared/UndoRedo";
import type { UndoDomain } from "../shared/UndoRedo";

const SECTION_UNDO_DOMAIN: Partial<Record<SectionId, UndoDomain>> = {
  tasks: "taskTree",
  ideas: "memo",
  work: "playlist",
  schedule: "scheduleItem",
  settings: "settings",
};

interface TitleBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onPortalTarget: (el: HTMLDivElement | null) => void;
  activeSection: SectionId;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  rightSidebarOpen: boolean;
  onToggleRightSidebar: () => void;
}

export function TitleBar({
  sidebarOpen,
  onToggleSidebar,
  onPortalTarget,
  activeSection,
  terminalOpen,
  onToggleTerminal,
  rightSidebarOpen,
  onToggleRightSidebar,
}: TitleBarProps) {
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPortalTarget(portalRef.current);
    return () => onPortalTarget(null);
  }, [onPortalTarget]);

  const sectionDomain = SECTION_UNDO_DOMAIN[activeSection] ?? null;

  return (
    <div
      className={`titlebar-drag flex items-center h-12 border-b border-notion-border bg-notion-bg-secondary shrink-0 ${
        isMac ? "pl-[70px]" : ""
      }`}
    >
      <span className="text-sm font-semibold text-notion-text-secondary px-3 select-none whitespace-nowrap">
        life-editor
      </span>
      <button
        onClick={onToggleSidebar}
        className={`titlebar-nodrag p-1.5 rounded transition-colors ${
          sidebarOpen
            ? "text-notion-accent hover:text-notion-text"
            : "text-notion-text-secondary hover:text-notion-text"
        }`}
        title="Toggle sidebar"
      >
        <PanelLeft size={16} />
      </button>
      <div className="mx-3 h-5 w-px bg-notion-border shrink-0" />
      <div
        ref={portalRef}
        className="flex items-center flex-1 min-w-0 overflow-x-auto"
      />
      {/* Fixed right area */}
      <div className="titlebar-nodrag flex items-center gap-1 px-2 shrink-0">
        {sectionDomain ? (
          <UndoRedoButtons domain={sectionDomain} />
        ) : (
          <div className="flex items-center gap-1">
            <span className="p-1.5 opacity-30 cursor-default">
              <svg width="16" height="16" />
            </span>
            <span className="p-1.5 opacity-30 cursor-default">
              <svg width="16" height="16" />
            </span>
          </div>
        )}
        <div className="mx-1 h-5 w-px bg-notion-border" />
        <button
          onClick={onToggleTerminal}
          className={`p-1.5 rounded transition-colors ${
            terminalOpen
              ? "text-notion-accent hover:text-notion-text"
              : "text-notion-text-secondary hover:text-notion-text"
          }`}
          title="Toggle terminal (⌘J)"
        >
          <Terminal size={16} />
        </button>
        <div className="mx-1 h-5 w-px bg-notion-border" />
        <button
          onClick={onToggleRightSidebar}
          className={`p-1.5 rounded transition-colors ${
            rightSidebarOpen
              ? "text-notion-accent hover:text-notion-text"
              : "text-notion-text-secondary hover:text-notion-text"
          }`}
          title="Toggle right sidebar"
        >
          <PanelRight size={16} />
        </button>
      </div>
    </div>
  );
}
