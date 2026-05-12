import { memo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import { renderIcon } from "../../../utils/iconRenderer";
import { RoundedCheckbox } from "../../shared/RoundedCheckbox";

interface TaskNodeCheckboxProps {
  isFolder: boolean;
  isDone: boolean;
  isExpanded?: boolean;
  isDragging?: boolean;
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
  icon,
  isCompletedItem,
  onToggleExpand,
  onToggleStatus,
}: TaskNodeCheckboxProps) {
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
        <span className="text-notion-text-secondary">
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
    <RoundedCheckbox
      checked={isDone}
      onChange={onToggleStatus}
      size={14}
      ariaLabel={isCompletedItem ? "Mark incomplete" : "Mark complete"}
    />
  );
});
