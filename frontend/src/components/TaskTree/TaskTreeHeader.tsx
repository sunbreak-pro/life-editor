import { Undo2, Redo2, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { flattenFolders } from "../../utils/flattenFolders";
import { FolderDropdown } from "../shared/FolderDropdown";

interface TaskTreeHeaderProps {
  filterFolderId: string | null;
  onFilterChange: (folderId: string | null) => void;
}

export function TaskTreeHeader({
  filterFolderId,
  onFilterChange,
}: TaskTreeHeaderProps) {
  const { t } = useTranslation();
  const { nodes, undo, redo, canUndo, canRedo } = useTaskTreeContext();

  const folders = flattenFolders(nodes);
  const activeFolder = folders.find((f) => f.id === filterFolderId);
  const displayName = activeFolder?.title ?? t("taskTreeHeader.allTasks");

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border shrink-0">
      <FolderDropdown
        selectedId={filterFolderId}
        onSelect={onFilterChange}
        rootLabel={t("taskTreeHeader.allTasks")}
        panelMinWidth="min-w-50"
        maxHeightClass="max-h-72"
        trigger={
          <button className="flex items-center gap-1 text-lg font-semibold text-notion-text hover:text-notion-accent transition-colors">
            <span className="truncate max-w-60">{displayName}</span>
            <ChevronDown size={16} className="transition-transform" />
          </button>
        }
      />

      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`p-1.5 rounded transition-colors ${
            canUndo
              ? "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
              : "opacity-30 cursor-default"
          }`}
          title={t("taskTree.undo")}
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`p-1.5 rounded transition-colors ${
            canRedo
              ? "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
              : "opacity-30 cursor-default"
          }`}
          title={t("taskTree.redo")}
        >
          <Redo2 size={16} />
        </button>
      </div>
    </div>
  );
}
