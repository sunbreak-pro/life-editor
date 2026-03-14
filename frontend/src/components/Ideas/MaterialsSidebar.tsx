import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Heart,
  StickyNote,
  BookOpen,
  Trash2,
  Plus,
  Network,
  Filter,
  Tag,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MemoNode } from "../../types/memo";
import type { NoteNode } from "../../types/note";
import type { WikiTagAssignment, WikiTag } from "../../types/wikiTag";
import { formatDisplayDate } from "../../utils/dateKey";
import { getContentPreview } from "../../utils/tiptapText";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { SearchBar, type SearchSuggestion } from "../shared/SearchBar";
import { CollapsibleSection } from "../shared/CollapsibleSection";
import { TagFilterOverlay } from "../shared/TagFilterOverlay";
import { InlineTagEditor } from "../WikiTags/InlineTagEditor";

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
  onNavigateToConnect?: (noteId: string) => void;
}

function loadSectionsState(): SectionsState {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MATERIALS_SECTIONS_STATE);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        favorites: parsed.favorites ?? true,
        notes: parsed.notes ?? true,
        daily: parsed.daily ?? true,
      };
    }
  } catch {
    // ignore
  }
  return {
    favorites: true,
    notes: true,
    daily: true,
  };
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
  onNavigateToConnect,
}: MaterialsSidebarProps) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<SectionsState>(loadSectionsState);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<number | null>(null);

  // Tag filter state
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set());
  const [showNoteFilter, setShowNoteFilter] = useState(false);

  // Tag editing state for memos
  const [editingTagEntityId, setEditingTagEntityId] = useState<string | null>(
    null,
  );
  const tagButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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

  // Search state (moved up for use in suggestions)
  const isSearching = debouncedQuery.trim().length > 0;
  const lowerQuery = debouncedQuery.toLowerCase();

  // Search suggestions: recent notes + memos (up to 10)
  const suggestions = useMemo<SearchSuggestion[]>(() => {
    const items: SearchSuggestion[] = [];
    const sortedNotes = [...notes]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 6);
    for (const n of sortedNotes) {
      items.push({
        id: n.id,
        label: n.title || t("notes.untitled"),
        icon: "note",
      });
    }
    const sortedMemos = [...memos]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4);
    for (const m of sortedMemos) {
      items.push({
        id: m.id,
        label: formatDisplayDate(m.date),
        icon: "memo",
      });
    }
    if (isSearching) {
      return items.filter((i) => i.label.toLowerCase().includes(lowerQuery));
    }
    return items;
  }, [notes, memos, isSearching, lowerQuery, t]);

  const handleSuggestionSelect = useCallback(
    (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (note) {
        onSelectView({ type: "note", noteId: note.id });
        return;
      }
      const memo = memos.find((m) => m.id === id);
      if (memo) {
        onSelectView({ type: "daily", date: memo.date });
      }
    },
    [notes, memos, onSelectView],
  );

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
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-colors ${
        isNoteSelected(note.id) ? "bg-notion-hover" : "hover:bg-notion-hover"
      }`}
    >
      <button
        onClick={() => onSelectView({ type: "note", noteId: note.id })}
        className="flex-1 flex items-center gap-1.5 min-w-0"
      >
        <StickyNote size={15} className="text-notion-text-secondary shrink-0" />
        <span className="flex flex-1 text-sm text-notion-text justify-start truncate">
          {note.title || t("notes.untitled")}
        </span>
        {renderTagDots(note.id)}
        {note.isPinned && (
          <Heart size={12} className="text-red-500 fill-current shrink-0" />
        )}
      </button>
      {onNavigateToConnect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToConnect(note.id);
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-notion-text transition-opacity shrink-0"
          title={t("ideas.connect")}
        >
          <Network size={12} />
        </button>
      )}
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
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-colors ${
        isDailySelected(memo.date) ? "bg-notion-hover" : "hover:bg-notion-hover"
      }`}
    >
      <button
        onClick={() => onSelectView({ type: "daily", date: memo.date })}
        className="flex-1 flex items-center gap-1.5 min-w-0"
      >
        <BookOpen size={15} className="text-notion-text-secondary shrink-0" />
        <span className="flex flex-1 text-sm text-notion-text justify-start truncate">
          {formatDisplayDate(memo.date)}
        </span>
        {renderTagDots(memo.id)}
        {memo.isPinned && (
          <Heart size={12} className="text-red-500 fill-current shrink-0" />
        )}
      </button>
      <button
        ref={(el) => {
          if (el) tagButtonRefs.current.set(memo.id, el);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setEditingTagEntityId(
            editingTagEntityId === memo.id ? null : memo.id,
          );
        }}
        className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-notion-text transition-opacity shrink-0"
        title="Edit tags"
      >
        <Tag size={12} />
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

  const toggleTagFilter = (tagId: string) => {
    setFilterTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  // Tag-filtered notes and memos
  const hasTagFilter = filterTagIds.size > 0;

  const entityTagIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const a of assignments) {
      const existing = map.get(a.entityId) || new Set();
      existing.add(a.tagId);
      map.set(a.entityId, existing);
    }
    return map;
  }, [assignments]);

  const tagFilteredNotes = useMemo(() => {
    if (!hasTagFilter) return notes;
    return notes.filter((n) => {
      const noteTagSet = entityTagIds.get(n.id);
      if (!noteTagSet) return false;
      return [...filterTagIds].some((tid) => noteTagSet.has(tid));
    });
  }, [notes, hasTagFilter, filterTagIds, entityTagIds]);

  const tagFilteredMemos = useMemo(() => {
    if (!hasTagFilter) return memos;
    return memos.filter((m) => {
      const memoTagSet = entityTagIds.get(m.id);
      if (!memoTagSet) return false;
      return [...filterTagIds].some((tid) => memoTagSet.has(tid));
    });
  }, [memos, hasTagFilter, filterTagIds, entityTagIds]);

  // Apply tag filter to display lists
  const displayNotes = hasTagFilter ? tagFilteredNotes : notes;
  const displayMemos = hasTagFilter ? tagFilteredMemos : memos;
  const displayPinnedNotes = hasTagFilter
    ? tagFilteredNotes.filter((n) => n.isPinned)
    : pinnedNotes;
  const displayPinnedMemos = hasTagFilter
    ? tagFilteredMemos.filter((m) => m.isPinned)
    : pinnedMemos;
  const displayHasFavorites =
    displayPinnedNotes.length > 0 || displayPinnedMemos.length > 0;

  // Search results: flat list
  if (isSearching) {
    return (
      <div className="h-full flex flex-col">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("ideas.searchMaterials")}
          suggestions={suggestions}
          onSuggestionSelect={handleSuggestionSelect}
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
        {editingTagEntityId &&
          tagButtonRefs.current.get(editingTagEntityId) && (
            <InlineTagEditor
              entityId={editingTagEntityId}
              entityType="memo"
              onClose={() => setEditingTagEntityId(null)}
              anchorEl={tagButtonRefs.current.get(editingTagEntityId)!}
            />
          )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("ideas.searchMaterials")}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Favorites */}
        {displayHasFavorites && (
          <CollapsibleSection
            label={t("ideas.favorites")}
            icon={<Heart size={15} />}
            isOpen={sections.favorites}
            onToggle={() => toggleSection("favorites")}
          >
            {displayPinnedNotes.map(renderNoteItem)}
            {displayPinnedMemos.map(renderMemoItem)}
          </CollapsibleSection>
        )}

        {/* Notes */}
        <CollapsibleSection
          label={t("ideas.notes")}
          icon={<StickyNote size={15} />}
          isOpen={sections.notes}
          onToggle={() => toggleSection("notes")}
          rightAction={
            <div className="flex items-center gap-0.5">
              <div className="relative">
                <button
                  onClick={() => setShowNoteFilter((v) => !v)}
                  className={`p-1 rounded transition-colors ${
                    filterTagIds.size > 0
                      ? "text-notion-accent"
                      : "text-notion-text-secondary hover:text-notion-text"
                  }`}
                  title="Filter by tag"
                >
                  <Filter size={14} />
                  {filterTagIds.size > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-notion-accent text-white text-[8px] font-bold">
                      {filterTagIds.size}
                    </span>
                  )}
                </button>
                {showNoteFilter && (
                  <div className="absolute right-0 top-full mt-1 z-20">
                    <TagFilterOverlay
                      tags={tags}
                      selectedTagIds={Array.from(filterTagIds)}
                      onToggle={toggleTagFilter}
                      onClose={() => setShowNoteFilter(false)}
                    />
                  </div>
                )}
              </div>
              <button
                onClick={onCreateNote}
                className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                title={t("notes.newNote")}
              >
                <Plus size={14} />
              </button>
            </div>
          }
        >
          {displayNotes.length === 0 ? (
            <p className="text-xs text-notion-text-secondary px-2 py-2">
              {hasTagFilter ? t("ideas.noSearchResults") : t("notes.noNotes")}
            </p>
          ) : (
            displayNotes.map(renderNoteItem)
          )}
        </CollapsibleSection>

        {/* Daily */}
        <CollapsibleSection
          label={t("ideas.daily")}
          icon={<BookOpen size={15} />}
          isOpen={sections.daily}
          onToggle={() => toggleSection("daily")}
        >
          {displayMemos.length === 0 ? (
            <p className="text-xs text-notion-text-secondary px-2 py-2">
              {hasTagFilter ? t("ideas.noSearchResults") : "No memos yet"}
            </p>
          ) : (
            displayMemos.map(renderMemoItem)
          )}
        </CollapsibleSection>
      </div>

      {editingTagEntityId && tagButtonRefs.current.get(editingTagEntityId) && (
        <InlineTagEditor
          entityId={editingTagEntityId}
          entityType="memo"
          onClose={() => setEditingTagEntityId(null)}
          anchorEl={tagButtonRefs.current.get(editingTagEntityId)!}
        />
      )}
    </div>
  );
}
