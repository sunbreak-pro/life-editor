import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Heart,
  StickyNote,
  BookOpen,
  Trash2,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MemoNode } from "../../types/memo";
import type { NoteNode } from "../../types/note";
import type { WikiTagAssignment } from "../../types/wikiTag";
import type { WikiTag } from "../../types/wikiTag";
import { formatDisplayDate } from "../../utils/dateKey";
import { getContentPreview } from "../../utils/tiptapText";
import { STORAGE_KEYS } from "../../constants/storageKeys";

type MaterialsView =
  | { type: "note"; noteId: string }
  | { type: "daily"; date: string };

interface SectionsState {
  favorites: boolean;
  notes: boolean;
  daily: boolean;
}

interface MaterialsSidebarProps {
  memos: MemoNode[];
  notes: NoteNode[];
  assignments: WikiTagAssignment[];
  tags: WikiTag[];
  selectedView: MaterialsView | null;
  onSelectView: (view: MaterialsView) => void;
  onCreateNote: () => void;
  onDeleteNote?: (noteId: string) => void;
  onDeleteMemo?: (date: string) => void;
}

function loadSectionsState(): SectionsState {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MATERIALS_SECTIONS_STATE);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return { favorites: true, notes: true, daily: true };
}

function saveSectionsState(state: SectionsState): void {
  localStorage.setItem(
    STORAGE_KEYS.MATERIALS_SECTIONS_STATE,
    JSON.stringify(state),
  );
}

export function MaterialsSidebar({
  memos,
  notes,
  assignments,
  tags,
  selectedView,
  onSelectView,
  onCreateNote,
  onDeleteNote,
  onDeleteMemo,
}: MaterialsSidebarProps) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<SectionsState>(loadSectionsState);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const toggleSection = (key: keyof SectionsState) => {
    setSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSectionsState(next);
      return next;
    });
  };

  // Build tag dot lookup: entityId -> tag colors
  const entityTagColors = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assignments) {
      const tag = tags.find((t) => t.id === a.tagId);
      if (tag) {
        const existing = map.get(a.entityId) || [];
        existing.push(tag.color);
        map.set(a.entityId, existing);
      }
    }
    return map;
  }, [assignments, tags]);

  // Pinned items
  const pinnedNotes = useMemo(() => notes.filter((n) => n.isPinned), [notes]);
  const pinnedMemos = useMemo(() => memos.filter((m) => m.isPinned), [memos]);
  const hasFavorites = pinnedNotes.length > 0 || pinnedMemos.length > 0;

  // Search filtering
  const isSearching = debouncedQuery.trim().length > 0;
  const lowerQuery = debouncedQuery.toLowerCase();

  const filteredNotes = useMemo(() => {
    if (!isSearching) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(lowerQuery) ||
        getContentPreview(n.content, 200).toLowerCase().includes(lowerQuery),
    );
  }, [notes, isSearching, lowerQuery]);

  const filteredMemos = useMemo(() => {
    if (!isSearching) return memos;
    return memos.filter(
      (m) =>
        m.date.includes(lowerQuery) ||
        getContentPreview(m.content, 200).toLowerCase().includes(lowerQuery),
    );
  }, [memos, isSearching, lowerQuery]);

  const isNoteSelected = (noteId: string) =>
    selectedView?.type === "note" && selectedView.noteId === noteId;
  const isDailySelected = (date: string) =>
    selectedView?.type === "daily" && selectedView.date === date;

  const renderTagDots = (entityId: string) => {
    const colors = entityTagColors.get(entityId);
    if (!colors || colors.length === 0) return null;
    return (
      <div className="flex items-center gap-0.5 shrink-0">
        {colors.slice(0, 3).map((color, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    );
  };

  const renderNoteItem = (note: NoteNode) => (
    <div
      key={note.id}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
        isNoteSelected(note.id) ? "bg-notion-hover" : "hover:bg-notion-hover"
      }`}
    >
      <button
        onClick={() => onSelectView({ type: "note", noteId: note.id })}
        className="flex-1 flex items-center gap-2 min-w-0"
      >
        <StickyNote size={15} className="text-notion-text-secondary shrink-0" />
        <span className="flex-1 text-sm text-notion-text truncate">
          {note.title || t("notes.untitled")}
        </span>
        {renderTagDots(note.id)}
        {note.isPinned && (
          <Heart
            size={12}
            className="text-notion-primary fill-current shrink-0"
          />
        )}
      </button>
      {onDeleteNote && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteNote(note.id);
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-red-500 transition-opacity shrink-0"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );

  const renderMemoItem = (memo: MemoNode) => (
    <div
      key={memo.id}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
        isDailySelected(memo.date) ? "bg-notion-hover" : "hover:bg-notion-hover"
      }`}
    >
      <button
        onClick={() => onSelectView({ type: "daily", date: memo.date })}
        className="flex-1 flex items-center gap-2 min-w-0"
      >
        <BookOpen size={15} className="text-notion-text-secondary shrink-0" />
        <span className="flex-1 text-sm text-notion-text truncate">
          {formatDisplayDate(memo.date)}
        </span>
        {renderTagDots(memo.id)}
        {memo.isPinned && (
          <Heart
            size={12}
            className="text-notion-primary fill-current shrink-0"
          />
        )}
      </button>
      {onDeleteMemo && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteMemo(memo.date);
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-red-500 transition-opacity shrink-0"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );

  // Search results: flat list
  if (isSearching) {
    return (
      <div className="h-full flex flex-col">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("ideas.searchMaterials")}
        />
        <div className="flex-1 overflow-y-auto p-1">
          {filteredNotes.length === 0 && filteredMemos.length === 0 && (
            <p className="text-xs text-notion-text-secondary text-center py-4">
              {t("ideas.noSearchResults")}
            </p>
          )}
          {filteredNotes.map(renderNoteItem)}
          {filteredMemos.map(renderMemoItem)}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("ideas.searchMaterials")}
        rightAction={
          <button
            onClick={onCreateNote}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
            title={t("notes.newNote")}
          >
            <Plus size={14} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* Favorites */}
        {hasFavorites && (
          <CollapsibleSection
            label={t("ideas.favorites")}
            icon={<Heart size={15} />}
            isOpen={sections.favorites}
            onToggle={() => toggleSection("favorites")}
          >
            {pinnedNotes.map(renderNoteItem)}
            {pinnedMemos.map(renderMemoItem)}
          </CollapsibleSection>
        )}

        {/* Notes */}
        <CollapsibleSection
          label={t("ideas.notes")}
          icon={<StickyNote size={15} />}
          isOpen={sections.notes}
          onToggle={() => toggleSection("notes")}
        >
          {notes.length === 0 ? (
            <p className="text-xs text-notion-text-secondary px-2 py-2">
              {t("notes.noNotes")}
            </p>
          ) : (
            notes.map(renderNoteItem)
          )}
        </CollapsibleSection>

        {/* Daily */}
        <CollapsibleSection
          label={t("ideas.daily")}
          icon={<BookOpen size={15} />}
          isOpen={sections.daily}
          onToggle={() => toggleSection("daily")}
        >
          {memos.length === 0 ? (
            <p className="text-xs text-notion-text-secondary px-2 py-2">
              No memos yet
            </p>
          ) : (
            memos.map(renderMemoItem)
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder,
  rightAction,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="p-3 border-b border-notion-border">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-notion-text-secondary"
          />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-notion-hover text-notion-text outline-none border border-transparent focus:border-notion-accent/50"
          />
        </div>
        {rightAction}
      </div>
    </div>
  );
}

function CollapsibleSection({
  label,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-notion-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-notion-text-secondary uppercase tracking-wider hover:bg-notion-hover transition-colors"
      >
        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        {icon}
        <span>{label}</span>
      </button>
      {isOpen && <div className="px-1 pb-1">{children}</div>}
    </div>
  );
}
