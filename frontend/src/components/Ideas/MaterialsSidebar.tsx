import { useState, useMemo, useRef, useEffect } from "react";
import {
  Heart,
  StickyNote,
  BookOpen,
  Trash2,
  Plus,
  Layers,
  ChevronRight,
  ChevronDown,
  Pencil,
  Check,
  X,
  Network,
  Filter,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MemoNode } from "../../types/memo";
import type { NoteNode } from "../../types/note";
import type {
  WikiTagAssignment,
  WikiTag,
  WikiTagGroup,
  WikiTagGroupMember,
} from "../../types/wikiTag";
import { formatDisplayDate } from "../../utils/dateKey";
import { getContentPreview } from "../../utils/tiptapText";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { SearchBar } from "../shared/SearchBar";
import { CollapsibleSection } from "../shared/CollapsibleSection";
import { TagFilterOverlay } from "../shared/TagFilterOverlay";

type MaterialsView =
  | { type: "note"; noteId: string }
  | { type: "daily"; date: string };

interface SectionsState {
  favorites: boolean;
  notes: boolean;
  daily: boolean;
  groups: boolean;
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
  groups: WikiTagGroup[];
  groupMembers: WikiTagGroupMember[];
  onCreateGroup: (
    name: string,
    noteIds: string[],
    filterTags?: string[],
  ) => Promise<WikiTagGroup>;
  onUpdateGroup: (
    id: string,
    updates: { name?: string; filterTags?: string[] },
  ) => Promise<WikiTagGroup>;
  onDeleteGroup: (id: string) => Promise<void>;
  onNavigateToConnect?: (noteId: string) => void;
  onSetGroupMembers?: (groupId: string, noteIds: string[]) => Promise<void>;
}

function loadSectionsState(): SectionsState {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MATERIALS_SECTIONS_STATE);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return {
    favorites: true,
    notes: true,
    daily: true,
    groups: true,
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
  groups,
  groupMembers,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onNavigateToConnect,
  onSetGroupMembers,
}: MaterialsSidebarProps) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<SectionsState>(loadSectionsState);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<number | null>(null);

  // Group UI state
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupNoteIds, setSelectedGroupNoteIds] = useState<Set<string>>(
    new Set(),
  );
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    new Set(),
  );

  // Group editing state
  const [editingGroupMemberIds, setEditingGroupMemberIds] =
    useState<Set<string> | null>(null);
  // Tag selection for group creation
  const [selectedGroupTagIds, setSelectedGroupTagIds] = useState<Set<string>>(
    new Set(),
  );

  // Tag filter state
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set());
  const [showNoteFilter, setShowNoteFilter] = useState(false);

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

  // Group handlers
  const handleCreateGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed || selectedGroupNoteIds.size === 0) return;
    await onCreateGroup(
      trimmed,
      Array.from(selectedGroupNoteIds),
      selectedGroupTagIds.size > 0
        ? Array.from(selectedGroupTagIds)
        : undefined,
    );
    setNewGroupName("");
    setSelectedGroupNoteIds(new Set());
    setSelectedGroupTagIds(new Set());
    setShowGroupCreate(false);
  };

  const saveGroupEdit = async () => {
    if (!editingGroupId || !editGroupName.trim()) return;
    await onUpdateGroup(editingGroupId, { name: editGroupName.trim() });
    if (editingGroupMemberIds && onSetGroupMembers) {
      await onSetGroupMembers(
        editingGroupId,
        Array.from(editingGroupMemberIds),
      );
    }
    setEditingGroupId(null);
    setEditingGroupMemberIds(null);
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleGroupNoteSelection = (noteId: string) => {
    setSelectedGroupNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const handleToggleGroupTag = (tagId: string) => {
    setSelectedGroupTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      // Auto-select notes with any of the selected tags
      const noteIds = new Set<string>();
      for (const tid of next) {
        for (const a of assignments) {
          if (a.tagId === tid && a.entityType === "note") {
            noteIds.add(a.entityId);
          }
        }
      }
      setSelectedGroupNoteIds((prevNotes) => {
        const merged = new Set(prevNotes);
        for (const id of noteIds) merged.add(id);
        return merged;
      });
      return next;
    });
  };

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

        {/* Groups */}
        <CollapsibleSection
          label={t("ideas.groups")}
          icon={<Layers size={15} />}
          isOpen={sections.groups}
          onToggle={() => toggleSection("groups")}
          rightAction={
            <button
              onClick={() => setShowGroupCreate(!showGroupCreate)}
              className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
            >
              <Plus size={14} />
            </button>
          }
        >
          {/* Create new group form */}
          {showGroupCreate && (
            <div className="mx-1 mb-2 p-2 rounded-md bg-notion-hover/50 border border-notion-border">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === "Enter") handleCreateGroup();
                  if (e.key === "Escape") {
                    setShowGroupCreate(false);
                    setSelectedGroupTagIds(new Set());
                  }
                }}
                placeholder={t("ideas.groupName")}
                className="w-full text-xs px-2 py-1 rounded bg-notion-bg text-notion-text outline-none border border-notion-border focus:border-notion-accent/50 mb-2"
                autoFocus
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleToggleGroupTag(tag.id)}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                        selectedGroupTagIds.has(tag.id)
                          ? "text-white border-transparent"
                          : "text-notion-text-secondary border-notion-border hover:border-notion-text-secondary"
                      }`}
                      style={
                        selectedGroupTagIds.has(tag.id)
                          ? { backgroundColor: tag.color }
                          : undefined
                      }
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-32 overflow-y-auto space-y-0.5 mb-2">
                {notes.map((note) => (
                  <label
                    key={note.id}
                    className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-notion-hover cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroupNoteIds.has(note.id)}
                      onChange={() => toggleGroupNoteSelection(note.id)}
                      className="rounded"
                    />
                    <StickyNote
                      size={12}
                      className="text-notion-text-secondary shrink-0"
                    />
                    <span className="text-xs text-notion-text truncate">
                      {note.title || t("notes.untitled")}
                    </span>
                  </label>
                ))}
              </div>
              <button
                onClick={handleCreateGroup}
                disabled={
                  !newGroupName.trim() || selectedGroupNoteIds.size === 0
                }
                className="w-full text-xs px-2 py-1 rounded bg-notion-accent text-white disabled:opacity-40"
              >
                {t("ideas.createGroup")} ({selectedGroupNoteIds.size})
              </button>
            </div>
          )}

          {/* Groups list */}
          <div className="space-y-0.5">
            {groups.map((group) => {
              const isGroupExpanded = expandedGroupIds.has(group.id);
              const memberNoteIds = groupMembers
                .filter((m) => m.groupId === group.id)
                .map((m) => m.noteId);
              const memberNotes = notes.filter((n) =>
                memberNoteIds.includes(n.id),
              );

              return (
                <div key={group.id}>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-notion-hover group transition-colors">
                    <button
                      onClick={() => toggleGroupExpanded(group.id)}
                      className="p-0.5 text-notion-text-secondary hover:text-notion-text shrink-0"
                    >
                      {isGroupExpanded ? (
                        <ChevronDown size={15} />
                      ) : (
                        <ChevronRight size={15} />
                      )}
                    </button>

                    {editingGroupId === group.id ? (
                      <>
                        <input
                          value={editGroupName}
                          onChange={(e) => setEditGroupName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.nativeEvent.isComposing) return;
                            if (e.key === "Enter") saveGroupEdit();
                            if (e.key === "Escape") {
                              setEditingGroupId(null);
                              setEditingGroupMemberIds(null);
                            }
                          }}
                          className="flex-1 text-xs px-1.5 py-0.5 rounded bg-notion-hover text-notion-text outline-none border border-notion-border"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={saveGroupEdit}
                          className="p-0.5 text-green-500 hover:text-green-400"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingGroupId(null);
                            setEditingGroupMemberIds(null);
                          }}
                          className="p-0.5 text-notion-text-secondary hover:text-notion-text"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex flex-1 text-sm text-notion-text justify-start truncate">
                          {group.name}
                        </span>
                        <span className="text-xs text-notion-text-secondary tabular-nums">
                          {memberNotes.length}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingGroupId(group.id);
                              setEditGroupName(group.name);
                              setEditingGroupMemberIds(new Set(memberNoteIds));
                            }}
                            className="p-0.5 text-notion-text-secondary hover:text-notion-text"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteGroup(group.id);
                            }}
                            className="p-0.5 text-notion-text-secondary hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Member editing or viewing */}
                  {editingGroupId === group.id && editingGroupMemberIds ? (
                    <div className="pl-6 max-h-32 overflow-y-auto space-y-0.5">
                      {notes.map((note) => (
                        <label
                          key={note.id}
                          className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-notion-hover cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={editingGroupMemberIds.has(note.id)}
                            onChange={() => {
                              setEditingGroupMemberIds((prev) => {
                                if (!prev) return prev;
                                const next = new Set(prev);
                                if (next.has(note.id)) next.delete(note.id);
                                else next.add(note.id);
                                return next;
                              });
                            }}
                            className="rounded"
                          />
                          <StickyNote
                            size={12}
                            className="text-notion-text-secondary shrink-0"
                          />
                          <span className="text-xs text-notion-text truncate">
                            {note.title || t("notes.untitled")}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    isGroupExpanded && (
                      <div className="pl-6 space-y-0.5">
                        {memberNotes.map((note) => (
                          <button
                            key={note.id}
                            onClick={() =>
                              onSelectView({ type: "note", noteId: note.id })
                            }
                            className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-notion-hover text-left transition-colors"
                          >
                            <StickyNote
                              size={12}
                              className="text-notion-text-secondary shrink-0"
                            />
                            <span className="text-xs text-notion-text truncate">
                              {note.title || t("notes.untitled")}
                            </span>
                          </button>
                        ))}
                        {memberNotes.length === 0 && (
                          <span className="text-xs text-notion-text-secondary px-2 py-1">
                            {t("ideas.noSearchResults")}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })}
            {groups.length === 0 && !showGroupCreate && (
              <p className="text-[10px] text-notion-text-secondary px-2 py-2 text-center">
                {t("ideas.noSearchResults")}
              </p>
            )}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
