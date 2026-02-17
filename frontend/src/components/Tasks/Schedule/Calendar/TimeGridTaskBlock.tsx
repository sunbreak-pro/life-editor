import type { TaskNode } from "../../../../types/taskTree";
import { getTextColorForBg } from "../../../../constants/folderColors";
import { formatTimeRangeCompact } from "../../../../utils/formatSchedule";
import { truncateFolderTag } from "../../../../utils/folderTag";

interface TimeGridTaskBlockProps {
  task: TaskNode;
  top: number;
  height: number;
  left: string;
  width: string;
  color?: string;
  tag?: string;
  onClick: (e: React.MouseEvent) => void;
}

export function TimeGridTaskBlock({
  task,
  top,
  height,
  left,
  width,
  color,
  tag,
  onClick,
}: TimeGridTaskBlockProps) {
  const bgColor = color ?? "#E0E7FF";
  const textColor = color ? getTextColorForBg(color) : "#4338CA";
  const isCompact = height < 40;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className="absolute rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity text-left"
      style={{
        top,
        left,
        width,
        height: Math.max(height, 20),
        backgroundColor: bgColor,
        borderLeft: `3px solid ${textColor}`,
        zIndex: 10,
      }}
    >
      <div className="px-1.5 py-0.5 h-full" style={{ color: textColor }}>
        <div
          className={`font-medium truncate ${isCompact ? "text-[10px]" : "text-xs"}`}
        >
          {task.title}
        </div>
        {!isCompact && task.scheduledAt && (
          <div className="text-[10px] truncate opacity-70">
            {formatTimeRangeCompact(task.scheduledAt, task.scheduledEndAt)}
          </div>
        )}
        {!isCompact && tag && (
          <div className="text-[10px] truncate opacity-70">
            {truncateFolderTag(tag)}
          </div>
        )}
      </div>
    </button>
  );
}
