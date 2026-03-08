import { useRef, useEffect } from "react";

interface RightSidebarProps {
  width: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onPortalTarget: (el: HTMLDivElement | null) => void;
}

export function RightSidebar({
  width,
  onMouseDown,
  onPortalTarget,
}: RightSidebarProps) {
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPortalTarget(portalRef.current);
    return () => onPortalTarget(null);
  }, [onPortalTarget]);

  return (
    <aside
      className="relative h-full bg-notion-bg-secondary border-l border-notion-border flex flex-col"
      style={{ minWidth: width }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-notion-accent/30 transition-colors z-10"
      />
      {/* Portal target for section content */}
      <div ref={portalRef} className="flex-1 overflow-y-auto" />
    </aside>
  );
}
