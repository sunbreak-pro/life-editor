interface GroupFrameProps {
  groupName: string;
  groupColor: string;
  top: number;
  height: number;
  left?: string;
  width?: string;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export function GroupFrame({
  groupName,
  groupColor,
  top,
  height,
  left = "2px",
  width = "calc(100% - 4px)",
  onMouseDown,
}: GroupFrameProps) {
  return (
    <div
      className="absolute z-[1] pointer-events-auto rounded-md"
      style={{
        top,
        height: Math.max(height, 20),
        left,
        width,
        backgroundColor: `${groupColor}12`,
        border: `1px solid ${groupColor}30`,
        borderRadius: 6,
        cursor: onMouseDown ? "grab" : undefined,
      }}
      onMouseDown={onMouseDown}
    >
      <span
        className="absolute top-0.5 left-1.5 text-[10px] font-medium select-none pointer-events-none"
        style={{ color: groupColor }}
      >
        {groupName}
      </span>
    </div>
  );
}
