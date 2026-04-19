import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import type { SectionId } from "../../types/taskTree";
import { LeftSidebar } from "./LeftSidebar";
import { CollapsedSidebar } from "./CollapsedSidebar";
import { TitleBar } from "./TitleBar";
import { HeaderPortalContext } from "./HeaderPortalContext";
import { MainContent } from "./MainContent";
import { RightSidebar } from "./RightSidebar";
import { TipsPanel } from "../shared/TipsPanel";
import { TerminalSection } from "../Terminal/TerminalSection";

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

function deserializeBoolFalse(raw: string): boolean {
  return raw === "true";
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
  terminalCommandRef?: React.MutableRefObject<TerminalCommandHandle | null>;
}

export function Layout({
  children,
  activeSection,
  onSectionChange,
  handleRef,
  terminalCommandRef,
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

  // Tips panel
  const [tipsOpen, setTipsOpen] = useLocalStorage<boolean>(
    STORAGE_KEYS.TIPS_OPEN,
    false,
    { serialize: String, deserialize: deserializeBoolFalse },
  );
  const handleToggleTips = useCallback(() => {
    setTipsOpen((prev) => !prev);
  }, [setTipsOpen]);
  const handleCloseTips = useCallback(() => {
    setTipsOpen(false);
  }, [setTipsOpen]);

  const previousSectionRef = useRef<SectionId>(activeSection);

  // Poll for external DB changes when terminal section is active
  const { refetch } = useTaskTreeContext();
  useExternalDataSync(activeSection === "terminal", refetch);
  const { matchEvent } = useShortcutConfig();

  const launchClaudeImpl = useCallback(async () => {
    // Wait for active session (terminal may need to initialize)
    let sessionId: string | null = null;
    for (let i = 0; i < 30; i++) {
      sessionId = terminalCommandRef?.current?.getActiveSessionId() ?? null;
      if (sessionId) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!sessionId) return;

    const currentState = await terminalClaudeState(sessionId);

    if (currentState === "inactive") {
      await terminalWrite(sessionId, "claude\n");
    }
  }, [terminalCommandRef]);

  useEffect(() => {
    if (handleRef) {
      handleRef.current = {
        toggleLeftSidebar: () => setLeftSidebarOpen((prev) => !prev),
        toggleTerminal: () => {
          if (activeSection === "terminal") {
            const prev = previousSectionRef.current;
            onSectionChange(prev !== "terminal" ? prev : "schedule");
          } else {
            previousSectionRef.current = activeSection;
            onSectionChange("terminal");
          }
        },
        toggleRightSidebar: () => setRightSidebarOpen((prev) => !prev),
        openTerminal: () => {
          if (activeSection !== "terminal") {
            previousSectionRef.current = activeSection;
            onSectionChange("terminal");
          }
        },
        launchClaude: async () => {
          if (activeSection !== "terminal") {
            previousSectionRef.current = activeSection;
            onSectionChange("terminal");
          }
          await launchClaudeImpl();
        },
      };
    }
  }, [
    handleRef,
    setLeftSidebarOpen,
    setRightSidebarOpen,
    activeSection,
    onSectionChange,
    launchClaudeImpl,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchEvent(e, "view:toggle-sidebar")) {
        e.preventDefault();
        setLeftSidebarOpen((prev) => !prev);
      }
      if (matchEvent(e, "view:toggle-terminal")) {
        e.preventDefault();
        if (activeSection === "terminal") {
          const prev = previousSectionRef.current;
          onSectionChange(prev !== "terminal" ? prev : "schedule");
        } else {
          previousSectionRef.current = activeSection;
          onSectionChange("terminal");
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
    setRightSidebarOpen,
    matchEvent,
    activeSection,
    onSectionChange,
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
    if (activeSection === "terminal") {
      setRightSidebarOpen(false);
    }
  }, [activeSection, setRightSidebarOpen]);

  const handleToggleSidebar = useCallback(() => {
    setLeftSidebarOpen((prev) => !prev);
  }, [setLeftSidebarOpen]);

  const handleToggleRightSidebar = useCallback(() => {
    setRightSidebarOpen((prev) => !prev);
  }, [setRightSidebarOpen]);

  const handleSectionChange = useCallback(
    (section: SectionId) => {
      if (section !== "terminal" && activeSection !== "terminal") {
        previousSectionRef.current = activeSection;
      }
      if (section === "terminal" && activeSection !== "terminal") {
        previousSectionRef.current = activeSection;
      }
      onSectionChange(section);
    },
    [activeSection, onSectionChange],
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
            onSectionChange={handleSectionChange}
            layoutRef={handleRef ?? { current: null }}
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
              <div
                className={`absolute inset-0 transition-opacity duration-200 ease-out ${
                  leftSidebarOpen
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <LeftSidebar
                  width={currentLeftWidth}
                  activeSection={activeSection}
                  onSectionChange={handleSectionChange}
                  onToggleTips={handleToggleTips}
                  tipsOpen={tipsOpen}
                />
                <div
                  onMouseDown={handleLeftMouseDown}
                  className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-notion-accent/30 transition-colors z-10"
                />
              </div>
              <div
                className={`absolute inset-0 transition-opacity duration-200 ease-out ${
                  leftSidebarOpen
                    ? "opacity-0 pointer-events-none"
                    : "opacity-100"
                }`}
              >
                <CollapsedSidebar
                  activeSection={activeSection}
                  onSectionChange={handleSectionChange}
                  onToggleTips={handleToggleTips}
                  tipsOpen={tipsOpen}
                />
              </div>
            </div>
            {/* Center area */}
            <div className="relative flex flex-col flex-1 min-w-0 min-h-0">
              <div
                className="flex flex-col flex-1 min-w-0 min-h-0"
                style={{
                  display: activeSection === "terminal" ? "none" : "flex",
                }}
              >
                <MainContent>{children}</MainContent>
              </div>
              <div
                className="flex flex-col flex-1 min-w-0 min-h-0"
                style={{
                  display: activeSection === "terminal" ? "flex" : "none",
                }}
              >
                <TerminalSection
                  isActive={activeSection === "terminal"}
                  commandRef={terminalCommandRef}
                />
              </div>
              <TipsPanel
                isOpen={tipsOpen}
                onClose={handleCloseTips}
                activeSection={activeSection}
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
