import { useTranslation } from "react-i18next";

interface GroupFrameProps {
  groupName: string;
  groupColor: string;
  top: number;
  height: number;
  itemCount: number;
  timeRange: string;
  headerHeight: number;
  left?: string;
  width?: string;
  onMouseDown?: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  onHeaderContextMenu?: (e: React.MouseEvent) => void;
}

export function GroupFrame({
  groupName,
  groupColor,
  top,
  height,
  itemCount,
  timeRange,
  headerHeight,
  left = "2px",
  width = "calc(100% - 4px)",
  onMouseDown,
  onDoubleClick,
  onHeaderContextMenu,
}: GroupFrameProps) {
  const { t } = useTranslation();
  return (
    <div
      className="absolute z-[1] pointer-events-auto rounded-md overflow-hidden"
      style={{
        top,
        height: Math.max(height, headerHeight + 8),
        left,
        width,
        border: `2px solid ${groupColor}80`,
        cursor: onMouseDown ? "grab" : undefined,
      }}
      onMouseDown={onMouseDown}
    >
      {/* Header bar */}
      <div
        className={`flex items-center gap-1.5 px-2 select-none ${onDoubleClick ? "cursor-pointer" : "pointer-events-none"}`}
        style={{
          height: headerHeight,
          backgroundColor: `${groupColor}40`,
          borderBottom: `2px solid ${groupColor}50`,
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.();
        }}
        onContextMenu={(e) => {
          if (onHeaderContextMenu) {
            e.preventDefault();
            e.stopPropagation();
            onHeaderContextMenu(e);
          }
        }}
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: groupColor }}
        />
        <span
          className="text-[10px] font-semibold truncate"
          style={{ color: groupColor }}
        >
          {groupName}
        </span>
        <span
          className="text-[9px] opacity-70 shrink-0"
          style={{ color: groupColor }}
        >
          {t("dayFlow.itemCount", { count: itemCount })}
        </span>
        <span
          className="text-[9px] opacity-60 shrink-0 ml-auto"
          style={{ color: groupColor }}
        >
          {timeRange}
        </span>
      </div>
      {/* Body area */}
      <div
        className="w-full h-full"
        style={{
          backgroundColor: `${groupColor}15`,
        }}
      />
    </div>
  );
}
