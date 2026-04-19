import { useRef, useEffect, useCallback } from "react";
import { PanelLeft, PanelRight, Terminal as TerminalIcon } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isMac } from "../../utils/platform";
import type { SectionId } from "../../types/taskTree";
import { UndoRedoButtons } from "../shared/UndoRedo";
import type { UndoDomain } from "../shared/UndoRedo";
import type { LayoutHandle } from "./Layout";
import { useTranslation } from "react-i18next";

const SECTION_UNDO_DOMAINS: Partial<Record<SectionId, UndoDomain[]>> = {
  schedule: ["scheduleItem", "routine", "taskTree", "calendar"],
  materials: ["memo", "note", "wikiTag"],
  connect: ["wikiTag"],
  work: ["playlist", "sound"],
  settings: ["settings"],
};

interface TitleBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onPortalTarget: (el: HTMLDivElement | null) => void;
  activeSection: SectionId;
  rightSidebarOpen: boolean;
  onToggleRightSidebar: () => void;
  onSectionChange: (section: SectionId) => void;
  layoutRef: React.RefObject<LayoutHandle | null>;
}

export function TitleBar({
  sidebarOpen,
  onToggleSidebar,
  onPortalTarget,
  activeSection,
  rightSidebarOpen,
  onToggleRightSidebar,
  onSectionChange,
  layoutRef,
}: TitleBarProps) {
  const portalRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    onPortalTarget(portalRef.current);
    return () => onPortalTarget(null);
  }, [onPortalTarget]);

  const sectionDomains = SECTION_UNDO_DOMAINS[activeSection] ?? null;
  const isTerminalActive = activeSection === "terminal";

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea"))
      return;
    e.preventDefault();
    getCurrentWindow().startDragging();
  }, []);

  const handleClaudeClick = useCallback(() => {
    if (isTerminalActive) {
      // Already in terminal — just (re)launch claude
      void layoutRef.current?.launchClaude();
    } else {
      onSectionChange("terminal");
      void layoutRef.current?.launchClaude();
    }
  }, [isTerminalActive, onSectionChange, layoutRef]);

  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleDragStart}
      className={`relative h-12 border-b border-notion-border bg-notion-bg-secondary shrink-0 ${
        isMac ? "pl-[88px]" : ""
      }`}
    >
      <div className="flex items-center h-full">
        <span className="text-sm font-semibold text-notion-text-secondary px-3 select-none whitespace-nowrap">
          Life Editor
        </span>
        <button
          onClick={onToggleSidebar}
          className={`p-1.5 rounded transition-colors ${
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
          className="flex items-center flex-1 min-w-0 overflow-x-clip"
        />
        {/* Fixed right area */}
        <div className="flex items-center gap-1 px-2 shrink-0">
          <button
            onClick={handleClaudeClick}
            className={`p-1.5 rounded transition-colors ${
              isTerminalActive
                ? "text-notion-accent hover:text-notion-text bg-notion-hover"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
            title={t("sidebar.launchClaude")}
            aria-label={t("sidebar.launchClaude")}
          >
            <TerminalIcon size={16} />
          </button>
          <div className="mx-1 h-5 w-px bg-notion-border" />
          {sectionDomains ? (
            <UndoRedoButtons domains={sectionDomains} />
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
    </div>
  );
}
