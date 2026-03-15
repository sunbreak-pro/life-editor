import { useState, useCallback, useMemo, useRef } from "react";
import {
  StickyNote,
  Plus,
  Heart,
  BookOpen,
  Package,
  Filter,
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WikiTag, WikiTagAssignment } from "../../../types/wikiTag";
import type { NoteNode } from "../../../types/note";
import type { MemoNode } from "../../../types/memo";
import { WikiTagChip } from "../../WikiTags/WikiTagChip";
import { SearchBar, type SearchSuggestion } from "../../shared/SearchBar";
import { CollapsibleSection } from "../../shared/CollapsibleSection";
import { TagFilterOverlay } from "../../shared/TagFilterOverlay";
import { ItemEditPopover } from "./ItemEditPopover";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { formatDisplayDate } from "../../../utils/dateKey";

interface SectionsState {
  favorites: boolean;
  notes: boolean;
  daily: boolean;
}

interface ConnectSidebarProps {
  query: string;
  onQueryChange: (query: string) => void;
  matchingTags: WikiTag[];
  matchingNotes: NoteNode[];
  selectedTagId: string | null;
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  notes: NoteNode[];
  memos: MemoNode[];
  onSelectTag: (tagId: string | null) => void;
  onNavigateToNote?: (noteId: string) => void;
  onCreateNote: (title: string, tagId?: string) => void;
  sidebarSelectedItemId: string | null;
  onSidebarSelect: (id: string | null) => void;
  onUpdateNoteTitle?: (noteId: string, title: string) => void;
}

function loadSectionsState(): SectionsState {
  try {
    const saved = localStorage.getItem(
      STORAGE_KEYS.MATERIALS_SECTIONS_STATE + "-connect",
    );
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
    STORAGE_KEYS.MATERIALS_SECTIONS_STATE + "-connect",
    JSON.stringify(state),
  );
}

export function ConnectSidebar({
  query,
  onQueryChange,
  matchingTags,
  matchingNotes,
  selectedTagId,
  tags,
  assignments,
  notes,
  memos,
  onSelectTag,
  onNavigateToNote,
  onCreateNote,
  sidebarSelectedItemId,
  onSidebarSelect,
  onUpdateNoteTitle,
}: ConnectSidebarProps) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<SectionsState>(loadSectionsState);

  // Note filter state
  const [sidebarFilterTagIds, setSidebarFilterTagIds] = useState<string[]>([]);
  const [showNoteFilter, setShowNoteFilter] = useState(false);

  // Entity editing state (name + tags)
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const editButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const toggleSection = (key: keyof SectionsState) => {
    setSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSectionsState(next);
      return next;
    });
  };

  const handleCreateNote = useCallback(() => {
    const selectedTag = tags.find((t) => t.id === selectedTagId);
    const title = selectedTag ? selectedTag.name : "Untitled";
    onCreateNote(title, selectedTagId ?? undefined);
  }, [tags, selectedTagId, onCreateNote]);

  // Note tag filter
  const noteTagMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const a of assignments) {
      if (a.entityType !== "note") continue;
      const existing = map.get(a.entityId) || new Set();
      existing.add(a.tagId);
      map.set(a.entityId, existing);
    }
    return map;
  }, [assignments]);

  // Build tag color dots lookup (include both notes and memos)
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

  const renderTagDots = (entityId: string) => {
    const colors = entityTagColors.get(entityId);
    if (!colors || colors.length === 0) return null;
    return (
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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

  const filteredNotes = useMemo(() => {
    if (sidebarFilterTagIds.length === 0) return notes;
    return notes.filter((n) => {
      const tagSet = noteTagMap.get(n.id);
      if (!tagSet) return false;
      return sidebarFilterTagIds.some((tid) => tagSet.has(tid));
    });
  }, [notes, sidebarFilterTagIds, noteTagMap]);

  const toggleSidebarFilterTag = useCallback((tagId: string) => {
    setSidebarFilterTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }, []);

  // Tag usage counts for search results
  const getUsageCount = useCallback(
    (tagId: string) => assignments.filter((a) => a.tagId === tagId).length,
    [assignments],
  );

  // Pinned items
  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => n.isPinned),
    [filteredNotes],
  );
  const pinnedMemos = useMemo(() => memos.filter((m) => m.isPinned), [memos]);
  const hasFavorites = pinnedNotes.length > 0 || pinnedMemos.length > 0;

  const handleItemClick = useCallback(
    (itemId: string) => {
      onSidebarSelect(sidebarSelectedItemId === itemId ? null : itemId);
    },
    [sidebarSelectedItemId, onSidebarSelect],
  );

  const isSearching = query.trim().length > 0;

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
    // If searching, filter
    if (isSearching) {
      const q = query.toLowerCase();
      return items.filter((i) => i.label.toLowerCase().includes(q));
    }
    return items;
  }, [notes, memos, query, isSearching, t]);

  const handleSuggestionSelect = useCallback(
    (id: string) => {
      handleItemClick(id);
    },
    [handleItemClick],
  );

  // Determine entity type for editing
  const getEntityType = (id: string): "note" | "memo" => {
    if (notes.some((n) => n.id === id)) return "note";
    return "memo";
  };

  const getEntityTitle = (id: string): string | undefined => {
    const note = notes.find((n) => n.id === id);
    return note?.title;
  };

  return (
    <div className="h-full flex flex-col">
      <SearchBar
        value={query}
        onChange={onQueryChange}
        placeholder={t("ideas.searchTagsAndNotes")}
        suggestions={suggestions}
        onSuggestionSelect={handleSuggestionSelect}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Search results */}
        {isSearching && (
          <div className="p-3 border-b border-notion-border">
            {matchingNotes.length > 0 && (
              <div className="mb-2">
                <h4 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wider mb-1">
                  {t("ideas.notes")}
                </h4>
                <div className="space-y-0.5">
                  {matchingNotes.map((note) => (
                    <div
                      key={note.id}
                      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors ${
                        sidebarSelectedItemId === note.id
                          ? "bg-notion-accent/10"
                          : "hover:bg-notion-hover"
                      }`}
                    >
                      <button
                        onClick={() => handleItemClick(note.id)}
                        className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                      >
                        <StickyNote
                          size={12}
                          className="text-notion-text-secondary shrink-0"
                        />
                        <span className="text-xs text-notion-text truncate">
                          {note.title || t("notes.untitled")}
                        </span>
                      </button>
                      {onNavigateToNote && (
                        <button
                          onClick={() => onNavigateToNote(note.id)}
                          className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-notion-text transition-opacity shrink-0"
                          title={t("ideas.materials")}
                        >
                          <Package size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {matchingTags.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wider mb-1">
                  {t("wikiTags.title")}
                </h4>
                <div className="space-y-0.5">
                  {matchingTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() =>
                        onSelectTag(tag.id === selectedTagId ? null : tag.id)
                      }
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-notion-hover transition-colors text-left ${
                        selectedTagId === tag.id ? "bg-notion-hover" : ""
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-xs text-notion-text truncate">
                        {tag.name}
                      </span>
                      <span className="text-xs text-notion-text-secondary tabular-nums">
                        {getUsageCount(tag.id)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {matchingNotes.length === 0 && matchingTags.length === 0 && (
              <p className="text-xs text-notion-text-secondary text-center py-2">
                {t("ideas.noSearchResults")}
              </p>
            )}
          </div>
        )}

        {/* Selected tag info */}
        {selectedTagId &&
          (() => {
            const selectedTag = tags.find((t) => t.id === selectedTagId);
            if (!selectedTag) return null;
            return (
              <div className="p-3 border-b border-notion-border">
                <div className="flex items-center justify-between mb-1">
                  <WikiTagChip tag={selectedTag} size="md" />
                  <button
                    onClick={handleCreateNote}
                    className="text-[10px] px-2 py-1 rounded bg-notion-accent text-white hover:opacity-90"
                  >
                    {t("ideas.newNoteButton")}
                  </button>
                </div>
              </div>
            );
          })()}

        {/* Favorites */}
        {!isSearching && hasFavorites && (
          <CollapsibleSection
            label={t("ideas.favorites")}
            icon={<Heart size={15} />}
            isOpen={sections.favorites}
            onToggle={() => toggleSection("favorites")}
          >
            {pinnedNotes.map((note) => (
              <div
                key={note.id}
                className={`group flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors ${
                  sidebarSelectedItemId === note.id
                    ? "bg-notion-accent/10"
                    : "hover:bg-notion-hover"
                }`}
              >
                <button
                  onClick={() => handleItemClick(note.id)}
                  className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                >
                  <Heart
                    size={15}
                    className="text-red-500 fill-current shrink-0"
                  />
                  <span className="flex-1 text-sm text-notion-text truncate">
                    {note.title || t("notes.untitled")}
                  </span>
                </button>
                {onNavigateToNote && (
                  <button
                    onClick={() => onNavigateToNote(note.id)}
                    className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-notion-text transition-opacity shrink-0"
                    title={t("ideas.materials")}
                  >
                    <Package size={12} />
                  </button>
                )}
              </div>
            ))}
            {pinnedMemos.map((memo) => (
              <div
                key={memo.id}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  sidebarSelectedItemId === memo.id
                    ? "bg-notion-accent/10"
                    : "hover:bg-notion-hover"
                }`}
              >
                <button
                  onClick={() => handleItemClick(memo.id)}
                  className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                >
                  <BookOpen
                    size={15}
                    className="text-notion-text-secondary shrink-0"
                  />
                  <span className="flex-1 text-sm text-notion-text truncate">
                    {formatDisplayDate(memo.date)}
                  </span>
                  {renderTagDots(memo.id)}
                </button>
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* Notes */}
        {!isSearching && (
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
                      sidebarFilterTagIds.length > 0
                        ? "text-notion-accent"
                        : "text-notion-text-secondary hover:text-notion-text"
                    }`}
                    title="Filter by tag"
                  >
                    <Filter size={14} />
                    {sidebarFilterTagIds.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-notion-accent text-white text-[8px] font-bold">
                        {sidebarFilterTagIds.length}
                      </span>
                    )}
                  </button>
                  {showNoteFilter && (
                    <div className="absolute right-0 top-full mt-1 z-20">
                      <TagFilterOverlay
                        tags={tags}
                        selectedTagIds={sidebarFilterTagIds}
                        onToggle={toggleSidebarFilterTag}
                        onClose={() => setShowNoteFilter(false)}
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCreateNote}
                  className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                  title={t("notes.newNote")}
                >
                  <Plus size={14} />
                </button>
              </div>
            }
          >
            {filteredNotes.length === 0 ? (
              <p className="text-xs text-notion-text-secondary px-2 py-2">
                {sidebarFilterTagIds.length > 0
                  ? t("ideas.noSearchResults")
                  : t("notes.noNotes")}
              </p>
            ) : (
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className={`group flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors ${
                    sidebarSelectedItemId === note.id
                      ? "bg-notion-accent/10"
                      : "hover:bg-notion-hover"
                  }`}
                >
                  <button
                    onClick={() => handleItemClick(note.id)}
                    className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                  >
                    {note.isPinned ? (
                      <Heart
                        size={15}
                        className="text-red-500 fill-current shrink-0"
                      />
                    ) : (
                      <StickyNote
                        size={15}
                        className="text-notion-text-secondary shrink-0"
                      />
                    )}
                    <span className="flex-1 text-sm text-notion-text truncate">
                      {note.title || t("notes.untitled")}
                    </span>
                    {renderTagDots(note.id)}
                  </button>
                  <button
                    ref={(el) => {
                      if (el) editButtonRefs.current.set(note.id, el);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingEntityId(
                        editingEntityId === note.id ? null : note.id,
                      );
                    }}
                    className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-notion-text transition-opacity shrink-0"
                    title={t("ideas.editItem")}
                  >
                    <Pencil size={12} />
                  </button>
                  {onNavigateToNote && (
                    <button
                      onClick={() => onNavigateToNote(note.id)}
                      className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-notion-text transition-opacity shrink-0"
                      title={t("ideas.materials")}
                    >
                      <Package size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
          </CollapsibleSection>
        )}

        {/* Daily */}
        {!isSearching && (
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
              memos.map((memo) => (
                <div
                  key={memo.id}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                    sidebarSelectedItemId === memo.id
                      ? "bg-notion-accent/10"
                      : "hover:bg-notion-hover"
                  }`}
                >
                  <button
                    onClick={() => handleItemClick(memo.id)}
                    className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                  >
                    {memo.isPinned ? (
                      <Heart
                        size={15}
                        className="text-red-500 fill-current shrink-0"
                      />
                    ) : (
                      <BookOpen
                        size={15}
                        className="text-notion-text-secondary shrink-0"
                      />
                    )}
                    <span className="flex-1 text-sm text-notion-text truncate">
                      {formatDisplayDate(memo.date)}
                    </span>
                    {renderTagDots(memo.id)}
                  </button>
                  <button
                    ref={(el) => {
                      if (el) editButtonRefs.current.set(memo.id, el);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingEntityId(
                        editingEntityId === memo.id ? null : memo.id,
                      );
                    }}
                    className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-notion-text transition-opacity shrink-0"
                    title={t("ideas.editItem")}
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              ))
            )}
          </CollapsibleSection>
        )}
      </div>

      {editingEntityId && editButtonRefs.current.get(editingEntityId) && (
        <ItemEditPopover
          entityId={editingEntityId}
          entityType={getEntityType(editingEntityId)}
          title={getEntityTitle(editingEntityId)}
          onTitleChange={
            getEntityType(editingEntityId) === "note" && onUpdateNoteTitle
              ? (title) => onUpdateNoteTitle(editingEntityId, title)
              : undefined
          }
          onClose={() => setEditingEntityId(null)}
          anchorEl={editButtonRefs.current.get(editingEntityId)!}
        />
      )}
    </div>
  );
}
