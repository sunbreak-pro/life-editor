import { Check, Repeat } from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { completedPalette, kindPalette } from "./chipPalette";
import type { DayItem } from "./dayItem";

const RAIL_WIDTH = 7;

interface MobileDayflowBlockProps {
  item: DayItem;
  top: number;
  height: number;
  left: string;
  width: string;
  isDragging: boolean;
  isDragSource: boolean;
  onEdit: () => void;
  onToggleComplete: () => void;
  onBlockPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
}

function isDone(item: DayItem): boolean {
  if (item.kind === "task") return item.status === "DONE";
  return item.completed;
}

function isInProgress(item: DayItem): boolean {
  return item.kind === "task" && item.status === "IN_PROGRESS";
}

function railBackground(
  done: boolean,
  inProgress: boolean,
  palette: { dot: string },
  completedDot: string,
): string {
  if (done) return completedDot;
  if (inProgress) {
    return `repeating-linear-gradient(180deg, ${palette.dot} 0 4px, transparent 4px 7px)`;
  }
  return palette.dot;
}

export function MobileDayflowBlock({
  item,
  top,
  height,
  left,
  width,
  isDragging,
  isDragSource,
  onEdit,
  onToggleComplete,
  onBlockPointerDown,
}: MobileDayflowBlockProps) {
  const palette = kindPalette(item.kind);
  const completed = completedPalette();
  const done = isDone(item);
  const inProgress = isInProgress(item);

  const railBg = railBackground(done, inProgress, palette, completed.dot);

  const containerStyle: CSSProperties = {
    left,
    width,
    top,
    height,
    background: done ? completed.bg : palette.bg,
    opacity: isDragSource ? 0.3 : done ? 0.5 : 1,
    transform: isDragging ? "scale(1.04)" : undefined,
    boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.18)" : undefined,
    transition: isDragging ? undefined : "transform 120ms ease-out",
    zIndex: isDragging ? 40 : 2,
  };

  return (
    <div
      className="absolute flex overflow-hidden rounded-lg"
      style={containerStyle}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete();
        }}
        aria-label="Toggle complete"
        className="shrink-0 rounded-l-lg active:brightness-90"
        style={{ width: RAIL_WIDTH, background: railBg }}
      />
      <button
        type="button"
        onClick={onEdit}
        onPointerDown={onBlockPointerDown}
        className="flex min-w-0 flex-1 cursor-pointer flex-col overflow-hidden text-left"
        style={{
          padding: "4px 6px 4px 7px",
          touchAction: isDragging ? "none" : undefined,
        }}
      >
        <div
          className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-notion-text"
          style={
            done ? { textDecoration: "line-through", opacity: 0.75 } : undefined
          }
        >
          {item.kind === "routine" && (
            <Repeat size={10} style={{ color: palette.dot }} />
          )}
          {done && <Check size={10} style={{ color: completed.fg }} />}
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {item.title}
          </span>
        </div>
        {height > 34 && (
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[9.5px] font-medium text-notion-text-secondary">
            {item.start} – {item.end}
          </div>
        )}
      </button>
    </div>
  );
}
