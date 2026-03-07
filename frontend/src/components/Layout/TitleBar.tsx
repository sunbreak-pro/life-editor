import { useRef, useEffect } from "react";
import { PanelLeft } from "lucide-react";
import { isMac } from "../../utils/platform";

interface TitleBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onPortalTarget: (el: HTMLDivElement | null) => void;
}

export function TitleBar({
  sidebarOpen,
  onToggleSidebar,
  onPortalTarget,
}: TitleBarProps) {
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPortalTarget(portalRef.current);
    return () => onPortalTarget(null);
  }, [onPortalTarget]);

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
            ? "text-notion-text-secondary hover:text-notion-text"
            : "text-notion-accent hover:text-notion-text"
        }`}
        title="Toggle sidebar"
      >
        <PanelLeft size={16} />
      </button>
      <div className="mx-3 h-5 w-px bg-notion-border shrink-0" />
      <div
        ref={portalRef}
        className="titlebar-nodrag flex items-center flex-1 min-w-0 overflow-x-auto"
      />
    </div>
  );
}
