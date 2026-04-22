import { memo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  CheckCircle2,
} from "lucide-react";
import { getTextColorForBg } from "../../../constants/folderColors";
import { renderIcon } from "../../../utils/iconRenderer";

interface TaskNodeCheckboxProps {
  isFolder: boolean;
  isDone: boolean;
  isExpanded?: boolean;
  isDragging?: boolean;
  color?: string;
  icon?: string;
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
  icon,
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
          {icon ? (
            renderIcon(icon, { size: 14 })
          ) : isExpanded && !isDragging ? (
            <FolderOpen size={14} />
          ) : (
            <Folder size={14} />
          )}
        </span>
      </>
    );
  }

  return (
    <label
      onClick={(e) => e.stopPropagation()}
      className="flex items-center shrink-0"
    >
      <input
        type="checkbox"
        checked={isDone}
        onChange={onToggleStatus}
        className="w-3.5 h-3.5 cursor-pointer"
        style={{ accentColor: "var(--color-accent)" }}
      />
    </label>
  );
});
