import { useEffect } from "react";
import { Undo2, Redo2, ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import { flattenFolders } from "../../../utils/flattenFolders";
import { FolderDropdown } from "../Folder/FolderDropdown";
import { SearchInput } from "../../shared/SearchInput";

interface TaskTreeHeaderProps {
  filterFolderId: string | null;
  onFilterChange: (folderId: string | null) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isSearchOpen: boolean;
  onSearchOpen: () => void;
  onSearchClose: () => void;
}

export function TaskTreeHeader({
  filterFolderId,
  onFilterChange,
  searchQuery,
  onSearchChange,
  isSearchOpen,
  onSearchOpen,
  onSearchClose,
}: TaskTreeHeaderProps) {
  const { t } = useTranslation();
  const { nodes, undo, redo, canUndo, canRedo } = useTaskTreeContext();

  const folders = flattenFolders(nodes);
  const activeFolder = folders.find((f) => f.id === filterFolderId);
  const displayName = activeFolder?.title ?? t("taskTreeHeader.allTasks");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        const active = document.activeElement;
        const isInEditor =
          active?.closest(".tiptap") || active?.closest("[contenteditable]");
        if (!isInEditor) {
          e.preventDefault();
          onSearchOpen();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSearchOpen]);

  return (
    <div className="shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border">
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
            onClick={onSearchOpen}
            className={`p-1.5 rounded transition-colors ${
              isSearchOpen
                ? "text-notion-accent bg-notion-accent/10"
                : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
            }`}
            title={t("search.placeholder")}
          >
            <Search size={16} />
          </button>
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

      {isSearchOpen && (
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={t("search.placeholder")}
          onClose={onSearchClose}
        />
      )}
    </div>
  );
}
