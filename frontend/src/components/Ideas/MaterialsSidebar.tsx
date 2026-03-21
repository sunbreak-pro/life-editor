import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Heart,
  StickyNote,
  Trash2,
  Plus,
  Network,
  Filter,
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NoteNode } from "../../types/note";
import type { WikiTagAssignment, WikiTag } from "../../types/wikiTag";
import { getContentPreview } from "../../utils/tiptapText";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { SearchBar, type SearchSuggestion } from "../shared/SearchBar";
import { CollapsibleSection } from "../shared/CollapsibleSection";
import { TagFilterOverlay } from "../shared/TagFilterOverlay";
import { ItemEditPopover } from "./Connect/ItemEditPopover";

interface SectionsState {
  favorites: boolean;
  notes: boolean;
}

interface MaterialsSidebarProps {
  notes: NoteNode[];
  assignments: WikiTagAssignment[];
  tags: WikiTag[];
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onDeleteNote?: (noteId: string) => void;
  onNavigateToNode?: (noteId: string) => void;
  onUpdateNoteTitle?: (noteId: string, title: string) => void;
}

function loadSectionsState(): SectionsState {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MATERIALS_SECTIONS_STATE);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        favorites: parsed.favorites ?? true,
        notes: parsed.notes ?? true,
      };
    }
  } catch {
    // ignore
  }
  return {
    favorites: true,
    notes: true,
  };
}

function saveSectionsState(state: SectionsState): void {
  localStorage.setItem(
    STORAGE_KEYS.MATERIALS_SECTIONS_STATE,
    JSON.stringify(state),
  );
}

export function MaterialsSidebar({
  notes,
  assignments,
  tags,
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onNavigateToNode,
  onUpdateNoteTitle,
}: MaterialsSidebarProps) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<SectionsState>(loadSectionsState);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<number | null>(null);

  // Tag filter state
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set());
  const [showNoteFilter, setShowNoteFilter] = useState(false);

  // Entity editing state
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const editButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const getEntityTitle = (id: string): string | undefined => {
    const note = notes.find((n) => n.id === id);
    return note?.title;
  };

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

  const isSearching = debouncedQuery.trim().length > 0;
  const lowerQuery = debouncedQuery.toLowerCase();

  // Search suggestions: recent notes
  const suggestions = useMemo<SearchSuggestion[]>(() => {
    const items: SearchSuggestion[] = [];
    const sortedNotes = [...notes]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 10);
    for (const n of sortedNotes) {
      items.push({
        id: n.id,
        label: n.title || t("notes.untitled"),
        icon: "note",
      });
    }
    if (isSearching) {
      return items.filter((i) => i.label.toLowerCase().includes(lowerQuery));
    }
    return items;
  }, [notes, isSearching, lowerQuery, t]);

  const handleSuggestionSelect = useCallback(
    (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (note) {
        onSelectNote(note.id);
      }
    },
    [notes, onSelectNote],
  );

  // Tag dot lookup
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

  // Pinned notes only
  const pinnedNotes = useMemo(() => notes.filter((n) => n.isPinned), [notes]);
  const hasFavorites = pinnedNotes.length > 0;

  const filteredNotes = useMemo(() => {
    if (!isSearching) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(lowerQuery) ||
        getContentPreview(n.content, 200).toLowerCase().includes(lowerQuery),
    );
  }, [notes, isSearching, lowerQuery]);

  const isNoteSelected = (noteId: string) => selectedNoteId === noteId;

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

  const renderNoteItem = (note: NoteNode) => (
    <div
      key={note.id}
      data-sidebar-item
      data-sidebar-active={isNoteSelected(note.id) || undefined}
      className={`group flex items-center gap-1.5 px-2 py-1 rounded text-left transition-colors ${
        isNoteSelected(note.id)
          ? "bg-notion-accent/10 text-notion-accent"
          : "hover:bg-notion-hover"
      }`}
      onClick={() => onSelectNote(note.id)}
    >
      <button
        onClick={() => onSelectNote(note.id)}
        className="flex-1 flex items-center gap-1.5 min-w-0"
      >
        {note.isPinned ? (
          <Heart size={12} className="text-red-500 fill-current shrink-0" />
        ) : (
          <StickyNote size={12} className="text-yellow-500 shrink-0" />
        )}
        <span className="flex flex-1 text-xs text-notion-text justify-start truncate">
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
          setEditingEntityId(editingEntityId === note.id ? null : note.id);
        }}
        className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-notion-text transition-opacity shrink-0"
        title={t("ideas.editItem")}
      >
        <Pencil size={10} />
      </button>
      {onNavigateToNode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToNode(note.id);
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-notion-text transition-opacity shrink-0"
          title={t("ideas.node")}
        >
          <Network size={10} />
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
          <Trash2 size={10} />
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

  const displayNotes = hasTagFilter ? tagFilteredNotes : notes;
  const displayPinnedNotes = hasTagFilter
    ? tagFilteredNotes.filter((n) => n.isPinned)
    : pinnedNotes;
  const displayHasFavorites = displayPinnedNotes.length > 0;

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
          {filteredNotes.length === 0 && (
            <p className="text-xs text-notion-text-secondary text-center py-4">
              {t("ideas.noSearchResults")}
            </p>
          )}
          {filteredNotes.map(renderNoteItem)}
        </div>
        {editingEntityId && editButtonRefs.current.get(editingEntityId) && (
          <ItemEditPopover
            entityId={editingEntityId}
            entityType="note"
            title={getEntityTitle(editingEntityId)}
            onTitleChange={
              onUpdateNoteTitle
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

  return (
    <div className="h-full flex flex-col">
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("ideas.searchMaterials")}
        suggestions={suggestions}
        onSuggestionSelect={handleSuggestionSelect}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Favorites */}
        {displayHasFavorites && (
          <CollapsibleSection
            label={t("ideas.favorites")}
            icon={<Heart size={12} />}
            isOpen={sections.favorites}
            onToggle={() => toggleSection("favorites")}
          >
            {displayPinnedNotes.map(renderNoteItem)}
          </CollapsibleSection>
        )}

        {/* Notes */}
        <CollapsibleSection
          label={t("ideas.notes")}
          icon={<StickyNote size={12} />}
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
      </div>

      {editingEntityId && editButtonRefs.current.get(editingEntityId) && (
        <ItemEditPopover
          entityId={editingEntityId}
          entityType="note"
          title={getEntityTitle(editingEntityId)}
          onTitleChange={
            onUpdateNoteTitle
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
