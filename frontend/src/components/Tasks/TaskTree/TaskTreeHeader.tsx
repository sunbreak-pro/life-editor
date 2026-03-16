import { useEffect, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import { flattenFolders } from "../../../utils/flattenFolders";
import { FolderDropdown } from "../Folder/FolderDropdown";
import { SearchBar, type SearchSuggestion } from "../../shared/SearchBar";

interface TaskTreeHeaderProps {
  filterFolderId: string | null;
  onFilterChange: (folderId: string | null) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isSearchOpen: boolean;
  onSearchOpen: () => void;
  onSearchClose: () => void;
  onSelectTask?: (id: string) => void;
}

export function TaskTreeHeader({
  filterFolderId,
  onFilterChange,
  searchQuery,
  onSearchChange,
  isSearchOpen,
  onSearchOpen,
  onSearchClose,
  onSelectTask,
}: TaskTreeHeaderProps) {
  const { t } = useTranslation();
  const { nodes } = useTaskTreeContext();

  const folders = flattenFolders(nodes);
  const activeFolder = folders.find((f) => f.id === filterFolderId);
  const displayName = activeFolder?.title ?? t("taskTreeHeader.allTasks");

  const suggestions = useMemo<SearchSuggestion[]>(() => {
    const parentMap = new Map<string, string>();
    for (const n of nodes) {
      if (n.type === "folder") parentMap.set(n.id, n.title);
    }
    const items = [...nodes]
      .filter((n) => !n.isCompleted)
      .sort(
        (a, b) =>
          new Date(b.updatedAt ?? 0).getTime() -
          new Date(a.updatedAt ?? 0).getTime(),
      )
      .slice(0, 10)
      .map((n) => ({
        id: n.id,
        label:
          n.title ||
          (n.type === "folder" ? "Untitled Folder" : "Untitled Task"),
        icon: (n.type === "folder" ? "folder" : "task") as "folder" | "task",
        sublabel: n.parentId ? parentMap.get(n.parentId) : undefined,
      }));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return items.filter((i) => i.label.toLowerCase().includes(q));
    }
    return items;
  }, [nodes, searchQuery]);

  const handleSuggestionSelect = (id: string) => {
    onSelectTask?.(id);
  };

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
      </div>

      {isSearchOpen && (
        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={t("search.placeholder")}
          onClose={onSearchClose}
          autoFocus
          showSuggestionsOnFocus={false}
          suggestions={suggestions}
          onSuggestionSelect={handleSuggestionSelect}
          className="px-4 py-2 border-b border-notion-border"
        />
      )}
    </div>
  );
}
