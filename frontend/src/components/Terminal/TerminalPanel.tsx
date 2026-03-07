import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown, Minus, X } from "lucide-react";
import { TerminalPane } from "./TerminalPane";

const MIN_HEIGHT = 150;
const MAX_HEIGHT_RATIO = 0.8;

interface TerminalPanelProps {
  isOpen: boolean;
  height: number;
  onHeightChange: (h: number) => void;
  onClose: () => void;
}

export function TerminalPanel({
  isOpen,
  height,
  onHeightChange,
  onClose,
}: TerminalPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Create session when panel opens
  useEffect(() => {
    if (!isOpen) return;

    let id: string | null = null;
    window.electronAPI
      ?.invoke<string>("terminal:create")
      .then((sid) => {
        id = sid;
        setSessionId(sid);
      })
      .catch(console.error);

    return () => {
      if (id) {
        window.electronAPI?.invoke("terminal:destroy", id).catch(() => {});
      }
      setSessionId(null);
    };
  }, [isOpen]);

  // Drag resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      startY.current = e.clientY;
      startHeight.current = height;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [height],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startY.current - e.clientY;
      const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(maxHeight, startHeight.current + delta),
      );
      onHeightChange(newHeight);
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
  }, [onHeightChange]);

  if (!isOpen) return null;

  return (
    <div
      className="flex flex-col border-t border-notion-border bg-[#11111b] shrink-0"
      style={{ height: isMinimized ? 36 : height }}
    >
      {/* Drag handle */}
      {!isMinimized && (
        <div
          onMouseDown={handleMouseDown}
          className="h-1 cursor-row-resize hover:bg-notion-accent/30 transition-colors shrink-0"
        />
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 h-8 shrink-0 bg-[#181825] border-b border-[#313244]">
        <span className="text-xs font-medium text-[#cdd6f4]">Terminal</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized((v) => !v)}
            className="p-0.5 text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
          >
            {isMinimized ? <ChevronDown size={14} /> : <Minus size={14} />}
          </button>
          <button
            onClick={onClose}
            className="p-0.5 text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Terminal content */}
      {!isMinimized && (
        <div className="flex-1 min-h-0">
          {sessionId && <TerminalPane sessionId={sessionId} />}
        </div>
      )}
    </div>
  );
}
