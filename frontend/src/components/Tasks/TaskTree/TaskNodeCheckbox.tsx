import { memo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Check,
  CheckCircle2,
} from "lucide-react";
import { getTextColorForBg } from "../../../constants/folderColors";

interface TaskNodeCheckboxProps {
  isFolder: boolean;
  isDone: boolean;
  isExpanded?: boolean;
  isDragging?: boolean;
  color?: string;
  isCompletedItem?: boolean;
  onToggleExpand: () => void;
  onToggleStatus: () => void;
}

export const TaskNodeCheckbox = memo(function TaskNodeCheckbox({
  isFolder,
  isDone,
  isExpanded,
  isDragging,
  color,
  isCompletedItem,
  onToggleExpand,
  onToggleStatus,
}: TaskNodeCheckboxProps) {
  if (isCompletedItem) {
    return (
      <button
        onClick={onToggleStatus}
        className="text-green-500 hover:text-notion-text-secondary"
      >
        <CheckCircle2 size={14} />
      </button>
    );
  }

  if (isFolder) {
    return (
      <>
        <button
          data-sidebar-toggle
          onClick={onToggleExpand}
          className="text-notion-text-secondary hover:text-notion-text"
        >
          {isExpanded && !isDragging ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>
        <span
          className="text-notion-text-secondary"
          style={color ? { color: getTextColorForBg(color) } : undefined}
        >
          {isExpanded && !isDragging ? (
            <FolderOpen size={14} />
          ) : (
            <Folder size={14} />
          )}
        </span>
      </>
    );
  }

  return (
    <button
      onClick={onToggleStatus}
      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
        isDone
          ? "bg-green-500 border-green-500 text-gray-900 hover:bg-green-500/70 hover:border-green-500/70"
          : "border-notion-border hover:border-notion-accent"
      }`}
    >
      {isDone && <Check size={10} className="check-animate" />}
    </button>
  );
});
