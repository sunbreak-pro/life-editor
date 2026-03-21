import { useEffect, useRef, useCallback } from "react";
import type { MutableRefObject } from "react";
import {
  ChevronLeft,
  ChevronUp,
  Minus,
  X,
  Plus,
  Columns2,
  Rows2,
  PanelBottom,
  PanelRight,
  Power,
  Terminal,
} from "lucide-react";
import { SplitLayout } from "./SplitLayout";
import { TerminalTabBar } from "./TerminalTabBar";
import { useTerminalLayout } from "../../hooks/useTerminalLayout";
import { countLeaves, findLeaf } from "../../utils/terminalLayout";
import type { TerminalCommandHandle } from "../Layout/Layout";

const MIN_HEIGHT = 150;
const MAX_HEIGHT_RATIO = 0.8;
const MIN_WIDTH = 250;
const MAX_WIDTH_RATIO = 0.6;
const MAX_PANES = 4;
const MAX_TABS = 4;

interface TerminalPanelProps {
  isOpen: boolean;
  dock: "bottom" | "right";
  height: number;
  width: number;
  onHeightChange: (h: number) => void;
  onWidthChange: (w: number) => void;
  onClose: () => void;
  onDockChange: (dock: "bottom" | "right") => void;
  isMinimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
  commandRef?: MutableRefObject<TerminalCommandHandle | null>;
}

export function TerminalPanel({
  isOpen,
  dock,
  height,
  width,
  onHeightChange,
  onWidthChange,
  onClose,
  onDockChange,
  isMinimized,
  onMinimizedChange,
  commandRef,
}: TerminalPanelProps) {
  const layout = useTerminalLayout();
  const isResizing = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const prevLayoutStateRef = useRef(layout.state);

  // Expose active session ID for external command sending
  useEffect(() => {
    if (commandRef) {
      commandRef.current = {
        getActiveSessionId: () => {
          const tab = layout.activeTab;
          if (!tab) return null;
          const leaf = findLeaf(tab.root, tab.activePaneId);
          return leaf?.sessionId ?? null;
        },
      };
    }
    return () => {
      if (commandRef) commandRef.current = null;
    };
  }, [commandRef, layout.activeTab]);

  // Open panel when first shown (don't close on hide — keep PTY session alive)
  useEffect(() => {
    if (isOpen && !layout.state) {
      layout.openPanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // When layout state transitions from non-null to null (all tabs closed), close the panel
  useEffect(() => {
    const prev = prevLayoutStateRef.current;
    prevLayoutStateRef.current = layout.state;

    if (prev !== null && layout.state === null && isOpen) {
      onClose();
    }
  }, [layout.state, isOpen, onClose]);

  // Panel-level keyboard shortcuts (capture phase)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey) return;

      const panel = panelRef.current;
      if (!panel || !panel.contains(document.activeElement)) {
        if (e.code === "KeyW" && !e.shiftKey) {
          window.electronAPI?.invoke("window:close");
          return;
        }
        return;
      }

      if (e.code === "KeyW" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        layout.closeActivePane();
        return;
      }

      if (e.code === "KeyT" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        layout.addTab();
        return;
      }

      if (e.code === "KeyD" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        layout.splitVertical();
        return;
      }

      if (e.code === "KeyD" && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        layout.splitHorizontal();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, layout]);

  // Drag resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      if (dock === "bottom") {
        startPos.current = e.clientY;
        startSize.current = height;
        document.body.style.cursor = "row-resize";
      } else {
        startPos.current = e.clientX;
        startSize.current = width;
        document.body.style.cursor = "col-resize";
      }
      document.body.style.userSelect = "none";
    },
    [dock, height, width],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      if (dock === "bottom") {
        const delta = startPos.current - e.clientY;
        const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
        const newHeight = Math.max(
          MIN_HEIGHT,
          Math.min(maxHeight, startSize.current + delta),
        );
        onHeightChange(newHeight);
      } else {
        const delta = startPos.current - e.clientX;
        const maxWidth = window.innerWidth * MAX_WIDTH_RATIO;
        const newWidth = Math.max(
          MIN_WIDTH,
          Math.min(maxWidth, startSize.current + delta),
        );
        onWidthChange(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dock, onHeightChange, onWidthChange]);

  // Trigger xterm.js resize when tab switches or toggling back from display:none
  useEffect(() => {
    if (isOpen && layout.state) {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    }
  }, [isOpen, layout.state, layout.state?.activeTabId]);

  const activeTab = layout.activeTab;
  const paneCount = activeTab ? countLeaves(activeTab.root) : 0;
  const canAddPane = paneCount < MAX_PANES;
  const canAddTab = (layout.state?.tabs.length ?? 0) < MAX_TABS;

  const isBottom = dock === "bottom";

  const handleTerminate = useCallback(() => {
    layout.closePanel();
    onClose();
  }, [layout, onClose]);

  const panelStyle: React.CSSProperties = isBottom
    ? { height: isMinimized ? 36 : height }
    : { width: isMinimized ? 36 : width };

  const panelClassName = isBottom
    ? "flex flex-col border-t border-notion-border bg-[#11111b] shrink-0"
    : "relative flex flex-col border-l border-notion-border bg-[#11111b] shrink-0";

  return (
    <div
      ref={panelRef}
      className={panelClassName}
      style={{
        ...panelStyle,
        ...(isOpen ? {} : { display: "none" }),
      }}
    >
      {/* Right dock minimized: vertical strip */}
      {isMinimized && !isBottom ? (
        <div
          className="flex flex-col items-center h-full py-2 gap-2 cursor-pointer"
          onClick={() => onMinimizedChange(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimizedChange(false);
            }}
            className="p-0.5 text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
            title="Restore terminal"
          >
            <ChevronLeft size={14} />
          </button>
          <Terminal size={14} className="text-[#6c7086] shrink-0" />
          <span
            className="text-xs text-[#6c7086] select-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Terminal
          </span>
          <div className="flex-1" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTerminate();
            }}
            className="p-0.5 text-[#6c7086] hover:text-red-400 transition-colors"
            title="Kill terminal"
          >
            <Power size={14} />
          </button>
        </div>
      ) : (
        <>
          {/* Drag handle */}
          {!isMinimized &&
            (isBottom ? (
              <div
                onMouseDown={handleMouseDown}
                className="h-1 cursor-row-resize hover:bg-notion-accent/30 transition-colors shrink-0"
              />
            ) : (
              <div
                onMouseDown={handleMouseDown}
                className="absolute left-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-notion-accent/30 transition-colors z-10"
              />
            ))}

          {/* Header bar */}
          <div className="flex items-center justify-between px-3 h-8 shrink-0 bg-[#181825] border-b border-[#313244]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#cdd6f4]">
                Terminal
              </span>
              {paneCount > 1 && (
                <span className="text-[10px] text-[#6c7086]">
                  {paneCount}/{MAX_PANES}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => layout.addTab()}
                disabled={!canAddTab}
                className="p-0.5 text-[#6c7086] hover:text-[#cdd6f4] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="New tab (⌘T)"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => layout.splitVertical()}
                disabled={!canAddPane}
                className="p-0.5 text-[#6c7086] hover:text-[#cdd6f4] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Split vertical (⌘D)"
              >
                <Columns2 size={14} />
              </button>
              <button
                onClick={() => layout.splitHorizontal()}
                disabled={!canAddPane}
                className="p-0.5 text-[#6c7086] hover:text-[#cdd6f4] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Split horizontal (⌘⇧D)"
              >
                <Rows2 size={14} />
              </button>
              <div className="w-px h-3 bg-[#313244] mx-0.5" />
              {/* Dock position buttons */}
              <button
                onClick={() => onDockChange("bottom")}
                className={`p-0.5 transition-colors ${
                  isBottom
                    ? "text-[#cdd6f4]"
                    : "text-[#6c7086] hover:text-[#cdd6f4]"
                }`}
                title="Dock to bottom"
              >
                <PanelBottom size={14} />
              </button>
              <button
                onClick={() => onDockChange("right")}
                className={`p-0.5 transition-colors ${
                  !isBottom
                    ? "text-[#cdd6f4]"
                    : "text-[#6c7086] hover:text-[#cdd6f4]"
                }`}
                title="Dock to right"
              >
                <PanelRight size={14} />
              </button>
              <div className="w-px h-3 bg-[#313244] mx-0.5" />
              <button
                onClick={handleTerminate}
                className="p-0.5 text-[#6c7086] hover:text-red-400 transition-colors"
                title="Kill terminal"
              >
                <Power size={14} />
              </button>
              <div className="w-px h-3 bg-[#313244] mx-0.5" />
              <button
                onClick={() => onMinimizedChange(!isMinimized)}
                className="p-0.5 text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
                title={isMinimized ? "Restore" : "Minimize"}
              >
                {isMinimized ? <ChevronUp size={14} /> : <Minus size={14} />}
              </button>
              <button
                onClick={onClose}
                className="p-0.5 text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
                title="Hide terminal"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          {!isMinimized && layout.state && (
            <TerminalTabBar
              tabs={layout.state.tabs}
              activeTabId={layout.state.activeTabId}
              onSwitchTab={layout.switchTab}
              onCloseTab={layout.closeTab}
              onAddTab={() => layout.addTab()}
              canAddTab={canAddTab}
            />
          )}

          {/* Terminal content — render all tabs, hide non-active with display:none */}
          {!isMinimized &&
            layout.state &&
            layout.state.tabs.map((tab) => (
              <div
                key={tab.id}
                className="flex-1 min-h-0"
                style={{
                  display:
                    tab.id === layout.state!.activeTabId ? "flex" : "none",
                  flexDirection: "column",
                }}
              >
                <SplitLayout
                  node={tab.root}
                  activePaneId={tab.activePaneId}
                  onPaneFocus={layout.setActivePaneId}
                  onSizesChange={layout.updateSizes}
                />
              </div>
            ))}
        </>
      )}
    </div>
  );
}
