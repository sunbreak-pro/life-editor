import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import type { SectionId } from "../../types/taskTree";
import { LeftSidebar } from "./LeftSidebar";
import { CollapsedSidebar } from "./CollapsedSidebar";
import { TitleBar } from "./TitleBar";
import { HeaderPortalContext } from "./HeaderPortalContext";
import { MainContent } from "./MainContent";
import { RightSidebar } from "./RightSidebar";
import { TerminalPanel } from "../Terminal/TerminalPanel";

import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useExternalDataSync } from "../../hooks/useExternalDataSync";
import { useShortcutConfig } from "../../hooks/useShortcutConfig";
import {
  terminalClaudeState,
  terminalWrite,
} from "../../services/terminalBridge";

import {
  RightSidebarContext,
  type RightSidebarContextValue,
} from "../../context/RightSidebarContext";

const TERMINAL_DEFAULT_HEIGHT = 300;
const TERMINAL_DEFAULT_WIDTH = 400;
const TERMINAL_MIN_WIDTH = 250;

const LEFT_MIN_WIDTH = 165;
const LEFT_MAX_WIDTH = 250;
const LEFT_DEFAULT_WIDTH = 190;

const RIGHT_MIN_WIDTH = 200;
const RIGHT_MAX_WIDTH = 500;
const RIGHT_DEFAULT_WIDTH = 280;

function deserializeWidth(min: number, max: number, def: number) {
  return (raw: string): number => {
    const val = parseInt(raw, 10);
    return val >= min && val <= max ? val : def;
  };
}

function deserializeBool(raw: string): boolean {
  return raw !== "false";
}

function deserializeDock(raw: string): "bottom" | "right" {
  return raw === "right" ? "right" : "bottom";
}

export interface TerminalCommandHandle {
  getActiveSessionId: () => string | null;
}

export interface LayoutHandle {
  toggleLeftSidebar: () => void;
  toggleTerminal: () => void;
  toggleRightSidebar: () => void;
  openTerminal: () => void;
  launchClaude: () => Promise<void>;
}

interface LayoutProps {
  children: ReactNode;
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  handleRef?: React.MutableRefObject<LayoutHandle | null>;
}

export function Layout({
  children,
  activeSection,
  onSectionChange,
  handleRef,
}: LayoutProps) {
  const [leftSidebarOpen, setLeftSidebarOpen] = useLocalStorage<boolean>(
    STORAGE_KEYS.LEFT_SIDEBAR_OPEN,
    true,
    { serialize: String, deserialize: deserializeBool },
  );

  // Left sidebar
  const [leftSidebarWidth, setLeftSidebarWidth] = useLocalStorage<number>(
    STORAGE_KEYS.LEFT_SIDEBAR_WIDTH,
    LEFT_DEFAULT_WIDTH,
    {
      serialize: String,
      deserialize: deserializeWidth(
        LEFT_MIN_WIDTH,
        LEFT_MAX_WIDTH,
        LEFT_DEFAULT_WIDTH,
      ),
    },
  );
  const isResizingLeft = useRef(false);
  const [dragLeftWidth, setDragLeftWidth] = useState<number | null>(null);

  // Right sidebar
  const [rightSidebarOpen, setRightSidebarOpen] = useLocalStorage<boolean>(
    STORAGE_KEYS.RIGHT_SIDEBAR_OPEN,
    false,
    { serialize: String, deserialize: deserializeBool },
  );
  const [rightSidebarWidth, setRightSidebarWidth] = useLocalStorage<number>(
    STORAGE_KEYS.RIGHT_SIDEBAR_WIDTH,
    RIGHT_DEFAULT_WIDTH,
    {
      serialize: String,
      deserialize: deserializeWidth(
        RIGHT_MIN_WIDTH,
        RIGHT_MAX_WIDTH,
        RIGHT_DEFAULT_WIDTH,
      ),
    },
  );
  const isResizingRight = useRef(false);
  const [dragRightWidth, setDragRightWidth] = useState<number | null>(null);

  // Terminal state
  const [terminalOpen, setTerminalOpen] = useLocalStorage<boolean>(
    STORAGE_KEYS.TERMINAL_OPEN,
    false,
    { serialize: String, deserialize: deserializeBool },
  );
  const [terminalHeight, setTerminalHeight] = useLocalStorage<number>(
    STORAGE_KEYS.TERMINAL_HEIGHT,
    TERMINAL_DEFAULT_HEIGHT,
    {
      serialize: String,
      deserialize: deserializeWidth(150, 2000, TERMINAL_DEFAULT_HEIGHT),
    },
  );
  const [terminalDock, setTerminalDock] = useLocalStorage<"bottom" | "right">(
    STORAGE_KEYS.TERMINAL_DOCK,
    "bottom",
    { serialize: String, deserialize: deserializeDock },
  );
  const [terminalWidth, setTerminalWidth] = useLocalStorage<number>(
    STORAGE_KEYS.TERMINAL_WIDTH,
    TERMINAL_DEFAULT_WIDTH,
    {
      serialize: String,
      deserialize: deserializeWidth(
        TERMINAL_MIN_WIDTH,
        2000,
        TERMINAL_DEFAULT_WIDTH,
      ),
    },
  );

  const [terminalMinimized, setTerminalMinimized] = useState(false);
  const terminalCommandRef = useRef<TerminalCommandHandle | null>(null);

  // Poll for external DB changes when terminal is open
  const { refetch } = useTaskTreeContext();
  useExternalDataSync(terminalOpen, refetch);
  const { matchEvent } = useShortcutConfig();

  useEffect(() => {
    if (handleRef) {
      handleRef.current = {
        toggleLeftSidebar: () => setLeftSidebarOpen((prev) => !prev),
        toggleTerminal: () => {
          if (terminalOpen && terminalMinimized) {
            setTerminalMinimized(false);
          } else {
            setTerminalOpen((prev) => !prev);
          }
        },
        toggleRightSidebar: () => setRightSidebarOpen((prev) => !prev),
        openTerminal: () => {
          if (!terminalOpen) setTerminalOpen(true);
          if (terminalMinimized) setTerminalMinimized(false);
        },
        launchClaude: async () => {
          // Open terminal if needed
          if (!terminalOpen) setTerminalOpen(true);
          if (terminalMinimized) setTerminalMinimized(false);

          // Wait for active session (terminal may need to initialize)
          let sessionId: string | null = null;
          for (let i = 0; i < 30; i++) {
            sessionId =
              terminalCommandRef.current?.getActiveSessionId() ?? null;
            if (sessionId) break;
            await new Promise((r) => setTimeout(r, 100));
          }
          if (!sessionId) return;

          // Check current Claude state via IPC
          const currentState = await terminalClaudeState(sessionId);

          if (currentState === "inactive") {
            // Claude not running - launch it
            await terminalWrite(sessionId, "claude\n");
          }
        },
      };
    }
  }, [
    handleRef,
    setLeftSidebarOpen,
    setTerminalOpen,
    setRightSidebarOpen,
    terminalOpen,
    terminalMinimized,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchEvent(e, "view:toggle-sidebar")) {
        e.preventDefault();
        setLeftSidebarOpen((prev) => !prev);
      }
      if (matchEvent(e, "view:toggle-terminal")) {
        e.preventDefault();
        if (terminalOpen && terminalMinimized) {
          setTerminalMinimized(false);
        } else {
          setTerminalOpen((prev) => !prev);
        }
      }
      if (matchEvent(e, "view:toggle-right-sidebar")) {
        e.preventDefault();
        setRightSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    setLeftSidebarOpen,
    setTerminalOpen,
    setRightSidebarOpen,
    matchEvent,
    terminalOpen,
    terminalMinimized,
  ]);

  // Left sidebar resize
  const handleLeftMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingLeft.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  // Right sidebar resize
  const handleRightMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRight.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current) {
        const clamped = Math.max(
          LEFT_MIN_WIDTH,
          Math.min(LEFT_MAX_WIDTH, e.clientX),
        );
        setDragLeftWidth(clamped);
      }
      if (isResizingRight.current) {
        const fromRight = window.innerWidth - e.clientX;
        const clamped = Math.max(
          RIGHT_MIN_WIDTH,
          Math.min(RIGHT_MAX_WIDTH, fromRight),
        );
        setDragRightWidth(clamped);
      }
    };

    const handleMouseUp = () => {
      if (isResizingLeft.current) {
        isResizingLeft.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setDragLeftWidth((prev) => {
          if (prev !== null) setLeftSidebarWidth(prev);
          return null;
        });
      }
      if (isResizingRight.current) {
        isResizingRight.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setDragRightWidth((prev) => {
          if (prev !== null) setRightSidebarWidth(prev);
          return null;
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setLeftSidebarWidth, setRightSidebarWidth]);

  const currentLeftWidth = dragLeftWidth ?? leftSidebarWidth;
  const currentRightWidth = dragRightWidth ?? rightSidebarWidth;

  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const [rightPortalTarget, setRightPortalTarget] =
    useState<HTMLDivElement | null>(null);

  const rightSidebarContextValue = useMemo<RightSidebarContextValue>(
    () => ({
      portalTarget: rightPortalTarget,
      requestOpen: () => setRightSidebarOpen(true),
    }),
    [rightPortalTarget, setRightSidebarOpen],
  );

  // Auto-open right sidebar for sections that use it
  useEffect(() => {
    if (
      activeSection === "materials" ||
      activeSection === "connect" ||
      activeSection === "settings" ||
      activeSection === "work" ||
      activeSection === "analytics"
    ) {
      setRightSidebarOpen(true);
    }
  }, [activeSection, setRightSidebarOpen]);

  const handleToggleSidebar = useCallback(() => {
    setLeftSidebarOpen((prev) => !prev);
  }, [setLeftSidebarOpen]);

  const handleToggleRightSidebar = useCallback(() => {
    setRightSidebarOpen((prev) => !prev);
  }, [setRightSidebarOpen]);

  const handleDockChange = useCallback(
    (dock: "bottom" | "right") => {
      setTerminalDock(dock);
    },
    [setTerminalDock],
  );

  return (
    <RightSidebarContext.Provider value={rightSidebarContextValue}>
      <HeaderPortalContext.Provider value={portalTarget}>
        <div className="flex flex-col h-screen">
          <TitleBar
            sidebarOpen={leftSidebarOpen}
            onToggleSidebar={handleToggleSidebar}
            onPortalTarget={setPortalTarget}
            activeSection={activeSection}
            rightSidebarOpen={rightSidebarOpen}
            onToggleRightSidebar={handleToggleRightSidebar}
          />
          <div className="flex flex-1 min-h-0">
            <div
              className={`relative shrink-0 overflow-hidden ${
                dragLeftWidth === null
                  ? "transition-[width] duration-200 ease-out"
                  : ""
              }`}
              style={{ width: leftSidebarOpen ? currentLeftWidth : 48 }}
            >
              {leftSidebarOpen ? (
                <>
                  <LeftSidebar
                    width={currentLeftWidth}
                    activeSection={activeSection}
                    onSectionChange={onSectionChange}
                    layoutRef={handleRef ?? { current: null }}
                  />
                  <div
                    onMouseDown={handleLeftMouseDown}
                    className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-notion-accent/30 transition-colors z-10"
                  />
                </>
              ) : (
                <CollapsedSidebar
                  activeSection={activeSection}
                  onSectionChange={onSectionChange}
                  layoutRef={handleRef ?? { current: null }}
                />
              )}
            </div>
            {/* Center area */}
            <div
              className={`flex flex-1 min-w-0 ${
                terminalDock === "right" ? "flex-row" : "flex-col"
              }`}
            >
              <div className="flex flex-col flex-1 min-w-0 min-h-0">
                <MainContent>{children}</MainContent>
              </div>
              <TerminalPanel
                isOpen={terminalOpen}
                dock={terminalDock}
                height={terminalHeight}
                width={terminalWidth}
                onHeightChange={setTerminalHeight}
                onWidthChange={setTerminalWidth}
                onClose={() => setTerminalOpen(false)}
                onDockChange={handleDockChange}
                isMinimized={terminalMinimized}
                onMinimizedChange={setTerminalMinimized}
                commandRef={terminalCommandRef}
              />
            </div>
            <div
              className={`shrink-0 overflow-hidden ${
                dragRightWidth === null
                  ? "transition-[width] duration-200 ease-out"
                  : ""
              }`}
              style={{ width: rightSidebarOpen ? currentRightWidth : 0 }}
            >
              <RightSidebar
                width={currentRightWidth}
                onMouseDown={handleRightMouseDown}
                onPortalTarget={setRightPortalTarget}
              />
            </div>
          </div>
        </div>
      </HeaderPortalContext.Provider>
    </RightSidebarContext.Provider>
  );
}
