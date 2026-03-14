import { useState, useCallback, useMemo } from "react";
import {
  StickyNote,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Layers,
  Heart,
  BookOpen,
  Package,
  Filter,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagGroup,
  WikiTagGroupMember,
} from "../../../types/wikiTag";
import type { NoteNode } from "../../../types/note";
import type { MemoNode } from "../../../types/memo";
import { WikiTagChip } from "../../WikiTags/WikiTagChip";
import { SearchBar } from "../../shared/SearchBar";
import { CollapsibleSection } from "../../shared/CollapsibleSection";
import { TagFilterOverlay } from "../../shared/TagFilterOverlay";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { formatDisplayDate } from "../../../utils/dateKey";

interface SectionsState {
  favorites: boolean;
  notes: boolean;
  daily: boolean;
  groups: boolean;
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
  onFocusNote?: (noteId: string) => void;
  onCreateNote: (title: string, tagId?: string) => void;
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
  onSetGroupMembers?: (groupId: string, noteIds: string[]) => Promise<void>;
}

function loadSectionsState(): SectionsState {
  try {
    const saved = localStorage.getItem(
      STORAGE_KEYS.MATERIALS_SECTIONS_STATE + "-connect",
    );
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
  onFocusNote,
  onCreateNote,
  groups,
  groupMembers,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onSetGroupMembers,
}: ConnectSidebarProps) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<SectionsState>(loadSectionsState);

  // Group state
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

  // Note filter state
  const [sidebarFilterTagIds, setSidebarFilterTagIds] = useState<string[]>([]);
  const [showNoteFilter, setShowNoteFilter] = useState(false);

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

  // Build tag color dots lookup
  const entityTagColors = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assignments) {
      if (a.entityType !== "note") continue;
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

  // Pinned items
  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => n.isPinned),
    [filteredNotes],
  );
  const pinnedMemos = useMemo(() => memos.filter((m) => m.isPinned), [memos]);
  const hasFavorites = pinnedNotes.length > 0 || pinnedMemos.length > 0;

  // Group handlers
  const handleToggleGroupTag = useCallback(
    (tagId: string) => {
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
        // Merge with existing manual selections (keep previously selected)
        setSelectedGroupNoteIds((prevNotes) => {
          const merged = new Set(prevNotes);
          for (const id of noteIds) merged.add(id);
          return merged;
        });
        return next;
      });
    },
    [assignments],
  );

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
    // Save member changes if editing members
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

  const isSearching = query.trim().length > 0;

  return (
    <div className="h-full flex flex-col">
      <SearchBar
        value={query}
        onChange={onQueryChange}
        placeholder={t("ideas.searchTagsAndNotes")}
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
                      className="group flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-notion-hover transition-colors"
                    >
                      <button
                        onClick={() => onFocusNote?.(note.id)}
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
                className="group flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-notion-hover transition-colors"
              >
                <button
                  onClick={() => onFocusNote?.(note.id)}
                  className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                >
                  <StickyNote
                    size={15}
                    className="text-notion-text-secondary shrink-0"
                  />
                  <span className="flex-1 text-sm text-notion-text truncate">
                    {note.title || t("notes.untitled")}
                  </span>
                  <Heart
                    size={12}
                    className="text-red-500 fill-current shrink-0"
                  />
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
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-notion-hover text-left transition-colors"
              >
                <BookOpen
                  size={15}
                  className="text-notion-text-secondary shrink-0"
                />
                <span className="flex-1 text-sm text-notion-text truncate">
                  {formatDisplayDate(memo.date)}
                </span>
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
                  className="group flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-notion-hover transition-colors"
                >
                  <button
                    onClick={() => onFocusNote?.(note.id)}
                    className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                  >
                    <StickyNote
                      size={15}
                      className="text-notion-text-secondary shrink-0"
                    />
                    <span className="flex-1 text-sm text-notion-text truncate">
                      {note.title || t("notes.untitled")}
                    </span>
                    {renderTagDots(note.id)}
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
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-notion-hover text-left transition-colors"
                >
                  <BookOpen
                    size={15}
                    className="text-notion-text-secondary shrink-0"
                  />
                  <span className="flex-1 text-sm text-notion-text truncate">
                    {formatDisplayDate(memo.date)}
                  </span>
                </div>
              ))
            )}
          </CollapsibleSection>
        )}

        {/* Groups */}
        {!isSearching && (
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
                        onChange={() => {
                          setSelectedGroupNoteIds((prev) => {
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
                          <span className="flex-1 text-sm text-notion-text truncate">
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
                                setEditingGroupMemberIds(
                                  new Set(memberNoteIds),
                                );
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
                            <div
                              key={note.id}
                              className="group/member flex items-center gap-1.5 px-2 py-1 rounded hover:bg-notion-hover transition-colors"
                            >
                              <button
                                onClick={() => onFocusNote?.(note.id)}
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
                                  className="p-0.5 opacity-0 group-hover/member:opacity-100 text-notion-text-secondary hover:text-notion-text transition-opacity shrink-0"
                                  title={t("ideas.materials")}
                                >
                                  <Package size={12} />
                                </button>
                              )}
                            </div>
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
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
