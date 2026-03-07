import { useRef, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import type { SectionId } from "../../types/taskTree";
import { LeftSidebar } from "./LeftSidebar";
import { MainContent } from "./MainContent";
import { TerminalPanel } from "../Terminal/TerminalPanel";
import { StatusBar } from "../StatusBar/StatusBar";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useExternalDataSync } from "../../hooks/useExternalDataSync";
import { useShortcutConfig } from "../../hooks/useShortcutConfig";
import { useClaudeStatus } from "../../hooks/useClaudeStatus";

const TERMINAL_DEFAULT_HEIGHT = 300;

const LEFT_MIN_WIDTH = 165;
const LEFT_MAX_WIDTH = 250;
const LEFT_DEFAULT_WIDTH = 190;

function deserializeWidth(min: number, max: number, def: number) {
  return (raw: string): number => {
    const val = parseInt(raw, 10);
    return val >= min && val <= max ? val : def;
  };
}

function deserializeBool(raw: string): boolean {
  return raw !== "false";
}

export interface LayoutHandle {
  toggleLeftSidebar: () => void;
  toggleTerminal: () => void;
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

  // Poll for external DB changes when terminal is open
  const { refetch } = useTaskTreeContext();
  useExternalDataSync(terminalOpen, refetch);
  const { matchEvent } = useShortcutConfig();
  const claudeState = useClaudeStatus();

  useEffect(() => {
    if (handleRef) {
      handleRef.current = {
        toggleLeftSidebar: () => setLeftSidebarOpen((prev) => !prev),
        toggleTerminal: () => setTerminalOpen((prev) => !prev),
      };
    }
  }, [handleRef, setLeftSidebarOpen, setTerminalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchEvent(e, "view:toggle-sidebar")) {
        e.preventDefault();
        setLeftSidebarOpen((prev) => !prev);
      }
      if (matchEvent(e, "view:toggle-terminal")) {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setLeftSidebarOpen, setTerminalOpen, matchEvent]);

  // Left sidebar resize
  const handleLeftMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingLeft.current = true;
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
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setLeftSidebarWidth]);

  const currentLeftWidth = dragLeftWidth ?? leftSidebarWidth;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-1 min-h-0">
        {leftSidebarOpen ? (
          <div
            className="relative shrink-0"
            style={{ width: currentLeftWidth }}
          >
            <LeftSidebar
              width={currentLeftWidth}
              activeSection={activeSection}
              onSectionChange={onSectionChange}
              onToggle={() => setLeftSidebarOpen(false)}
            />
            <div
              onMouseDown={handleLeftMouseDown}
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-notion-accent/30 transition-colors z-10"
            />
          </div>
        ) : (
          <div className="h-full bg-notion-bg-secondary border-r border-notion-border flex flex-col items-center pt-4 shrink-0 w-12">
            <button
              onClick={() => setLeftSidebarOpen(true)}
              className="p-1.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
            >
              <PanelLeft size={18} />
            </button>
          </div>
        )}
        <MainContent>{children}</MainContent>
      </div>
      <TerminalPanel
        isOpen={terminalOpen}
        height={terminalHeight}
        onHeightChange={setTerminalHeight}
        onClose={() => setTerminalOpen(false)}
      />
      <StatusBar
        isTerminalOpen={terminalOpen}
        onToggleTerminal={() => setTerminalOpen((prev) => !prev)}
        claudeState={claudeState}
      />
    </div>
  );
}
