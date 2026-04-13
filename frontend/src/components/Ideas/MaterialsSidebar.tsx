import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Heart,
  StickyNote,
  Trash2,
  Plus,
  Network,
  Filter,
  Pencil,
  FolderPlus,
  GripVertical,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { NoteNode } from "../../types/note";
import type { WikiTagAssignment, WikiTag } from "../../types/wikiTag";
import { getContentPreview } from "../../utils/tiptapText";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { SearchBar, type SearchSuggestion } from "../shared/SearchBar";
import { CollapsibleSection } from "../shared/CollapsibleSection";
import { TagFilterOverlay } from "../shared/TagFilterOverlay";
import { ItemEditPopover } from "./Connect/ItemEditPopover";
import { NoteTreeNode } from "./NoteTreeNode";
import {
  useNoteTreeDnd,
  NoteDragOverStoreContext,
} from "../../hooks/useNoteTreeDnd";
import { useNoteTreeMovement } from "../../hooks/useNoteTreeMovement";

interface SectionsState {
  favorites: boolean;
  notes: boolean;
}

interface MaterialsSidebarProps {
  notes: NoteNode[];
  flattenedNotes: NoteNode[];
  expandedIds: Set<string>;
  assignments: WikiTagAssignment[];
  tags: WikiTag[];
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onCreateFolder: () => void;
  onDeleteNote?: (noteId: string) => void;
  onNavigateToNode?: (noteId: string) => void;
  onUpdateNoteTitle?: (noteId: string, title: string) => void;
  onUpdateNote?: (id: string, updates: Partial<Pick<NoteNode, "icon">>) => void;
  onTogglePin?: (id: string) => void;
  onCopyToFiles?: (id: string) => void;
  onToggleExpand: (id: string) => void;
  persistWithHistory: (currentNotes: NoteNode[], updated: NoteNode[]) => void;
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
  flattenedNotes,
  expandedIds,
  assignments,
  tags,
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onDeleteNote,
  onNavigateToNode,
  onUpdateNoteTitle,
  onUpdateNote,
  onTogglePin,
  onCopyToFiles,
  onToggleExpand,
  persistWithHistory,
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

  // DnD setup
  const { moveNode, moveNodeInto, moveToRoot } = useNoteTreeMovement(
    notes,
    persistWithHistory,
  );

  const {
    sensors,
    activeNode,
    dragOverStore,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  } = useNoteTreeDnd({
    notes,
    moveNode,
    moveNodeInto,
    moveToRoot,
  });

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
      .filter((n) => n.type === "note")
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
  const pinnedNotes = useMemo(
    () => notes.filter((n) => n.isPinned && n.type === "note"),
    [notes],
  );
  const hasFavorites = pinnedNotes.length > 0;

  const filteredNotes = useMemo(() => {
    if (!isSearching) return notes.filter((n) => n.type === "note");
    return notes.filter(
      (n) =>
        n.type === "note" &&
        (n.title.toLowerCase().includes(lowerQuery) ||
          getContentPreview(n.content, 200).toLowerCase().includes(lowerQuery)),
    );
  }, [notes, isSearching, lowerQuery]);

  const renderNoteItem = (note: NoteNode) => (
    <div
      key={note.id}
      data-sidebar-item
      data-sidebar-active={selectedNoteId === note.id || undefined}
      className={`group flex items-center gap-1.5 px-2 py-1 rounded text-left transition-colors ${
        selectedNoteId === note.id
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
      </button>
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
    if (!hasTagFilter) return flattenedNotes;
    return flattenedNotes.filter((n) => {
      if (n.type === "folder") return true;
      const noteTagSet = entityTagIds.get(n.id);
      if (!noteTagSet) return false;
      return [...filterTagIds].some((tid) => noteTagSet.has(tid));
    });
  }, [flattenedNotes, hasTagFilter, filterTagIds, entityTagIds]);

  const displayPinnedNotes = hasTagFilter
    ? tagFilteredNotes.filter((n) => n.isPinned && n.type === "note")
    : pinnedNotes;
  const displayHasFavorites = displayPinnedNotes.length > 0;

  // Compute depth for each flattened node
  const depthMap = useMemo(() => {
    const map = new Map<string, number>();
    const computeDepth = (id: string): number => {
      if (map.has(id)) return map.get(id)!;
      const node = notes.find((n) => n.id === id);
      if (!node || !node.parentId) {
        map.set(id, 0);
        return 0;
      }
      const d = computeDepth(node.parentId) + 1;
      map.set(id, d);
      return d;
    };
    for (const n of notes) computeDepth(n.id);
    return map;
  }, [notes]);

  const displayTree = hasTagFilter ? tagFilteredNotes : flattenedNotes;
  const sortableIds: UniqueIdentifier[] = displayTree.map((n) => n.id);

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

        {/* Notes tree */}
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
                onClick={onCreateFolder}
                className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                title={t("notes.newFolder")}
              >
                <FolderPlus size={14} />
              </button>
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
          <NoteDragOverStoreContext.Provider value={dragOverStore}>
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                {displayTree.length === 0 ? (
                  <p className="text-xs text-notion-text-secondary px-2 py-2">
                    {hasTagFilter
                      ? t("ideas.noSearchResults")
                      : t("notes.noNotes")}
                  </p>
                ) : (
                  displayTree.map((node) => (
                    <NoteTreeNode
                      key={node.id}
                      node={node}
                      depth={depthMap.get(node.id) ?? 0}
                      isExpanded={expandedIds.has(node.id)}
                      isSelected={selectedNoteId === node.id}
                      onSelect={onSelectNote}
                      onToggleExpand={onToggleExpand}
                      onDelete={onDeleteNote}
                      onRename={
                        onUpdateNoteTitle
                          ? (id, title) => onUpdateNoteTitle(id, title)
                          : undefined
                      }
                      onChangeIcon={
                        onUpdateNote
                          ? (id, icon) => onUpdateNote(id, { icon })
                          : undefined
                      }
                      onTogglePin={onTogglePin}
                      onCopyToFiles={onCopyToFiles}
                    />
                  ))
                )}
              </SortableContext>
              <DragOverlay>
                {activeNode ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-notion-bg border border-notion-border shadow-lg text-[13px] text-notion-text opacity-50">
                    <GripVertical
                      size={14}
                      className="text-notion-text-secondary"
                    />
                    <span>{activeNode.title || "Untitled"}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </NoteDragOverStoreContext.Provider>
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
