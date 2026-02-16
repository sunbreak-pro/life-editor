import { useState, useEffect, useRef } from "react";
import {
  StickyNote,
  Plus,
  Trash2,
  Pin,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNoteContext } from "../../hooks/useNoteContext";
import { formatRelativeDate } from "../../utils/formatRelativeDate";
import { getContentPreview } from "../../utils/tiptapText";
import type { NoteSortMode } from "../../types/note";

const SORT_LABEL_KEYS: Record<NoteSortMode, string> = {
  updatedAt: "notes.sortUpdated",
  createdAt: "notes.sortCreated",
  title: "notes.sortTitle",
};

export function NoteList() {
  const {
    sortedFilteredNotes,
    selectedNoteId,
    setSelectedNoteId,
    searchQuery,
    setSearchQuery,
    sortMode,
    setSortMode,
    createNote,
    softDeleteNote,
  } = useNoteContext();

  const { t } = useTranslation();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setSearchQuery(localSearch);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch, setSearchQuery]);

  return (
    <div className="w-64 shrink-0 border-r border-notion-border h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-notion-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-notion-text">
            <StickyNote size={16} />
            <span className="text-sm font-medium">{t("notes.title")}</span>
          </div>
          <button
            onClick={() => createNote()}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
            title={t("notes.newNote")}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-notion-text-secondary"
          />
          <input
            type="text"
            placeholder={t("notes.searchNotes")}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-notion-bg-secondary border border-notion-border rounded-md text-notion-text placeholder:text-notion-text-secondary focus:outline-none focus:border-notion-primary"
          />
        </div>
      </div>

      {/* Sort row */}
      <div className="px-3 py-1 flex items-center gap-1">
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <ArrowUpDown size={12} />
            {t(SORT_LABEL_KEYS[sortMode])}
          </button>
          {showSortMenu && (
            <div className="absolute top-full left-0 mt-1 bg-notion-bg border border-notion-border rounded-md shadow-lg z-10 py-1">
              {(Object.keys(SORT_LABEL_KEYS) as NoteSortMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setSortMode(mode);
                    setShowSortMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-notion-hover transition-colors ${
                    sortMode === mode
                      ? "text-notion-primary font-medium"
                      : "text-notion-text"
                  }`}
                >
                  {t(SORT_LABEL_KEYS[mode])}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Note items */}
      <div className="flex-1 overflow-y-auto p-1">
        {sortedFilteredNotes.length === 0 && (
          <p className="text-xs text-notion-text-secondary text-center py-4">
            {searchQuery ? t("notes.noMatching") : t("notes.noNotes")}
          </p>
        )}
        {sortedFilteredNotes.map((note) => (
          <div key={note.id} className="group relative">
            <button
              onClick={() => setSelectedNoteId(note.id)}
              className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                selectedNoteId === note.id
                  ? "bg-notion-hover"
                  : "hover:bg-notion-hover"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {note.isPinned && (
                  <Pin size={10} className="text-notion-primary shrink-0" />
                )}
                <span className="text-sm text-notion-text truncate font-medium">
                  {note.title || t("notes.untitled")}
                </span>
              </div>
              {note.updatedAt && (
                <p className="text-[10px] text-notion-text-secondary/60 mt-0.5">
                  {formatRelativeDate(note.updatedAt)}
                </p>
              )}
              {note.content && (
                <p className="text-xs text-notion-text-secondary truncate mt-0.5">
                  {getContentPreview(note.content, 40)}
                </p>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                softDeleteNote(note.id);
              }}
              className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-red-500 rounded transition-all"
              title={t("common.delete")}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
