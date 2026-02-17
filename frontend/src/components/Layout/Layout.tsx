import { useRef, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import type { SectionId } from "../../types/taskTree";
import { LeftSidebar } from "./LeftSidebar";
import { MainContent } from "./MainContent";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useLocalStorage } from "../../hooks/useLocalStorage";

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

  useEffect(() => {
    if (handleRef) {
      handleRef.current = {
        toggleLeftSidebar: () => setLeftSidebarOpen((prev) => !prev),
      };
    }
  }, [handleRef, setLeftSidebarOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === "Period") {
        e.preventDefault();
        setLeftSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setLeftSidebarOpen]);

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
    <div className="flex min-h-screen">
      {leftSidebarOpen ? (
        <div className="relative shrink-0" style={{ width: currentLeftWidth }}>
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
        <div className="w-12 h-screen bg-notion-bg-secondary border-r border-notion-border flex flex-col items-center pt-4 shrink-0">
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
  );
}
