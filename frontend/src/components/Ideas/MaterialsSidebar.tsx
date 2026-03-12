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
}

function loadSectionsState(): SectionsState {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MATERIALS_SECTIONS_STATE);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return { favorites: true, notes: true, daily: true, groups: true };
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

  // Group handlers
  const handleCreateGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed || selectedGroupNoteIds.size === 0) return;
    await onCreateGroup(trimmed, Array.from(selectedGroupNoteIds));
    setNewGroupName("");
    setSelectedGroupNoteIds(new Set());
    setShowGroupCreate(false);
  };

  const saveGroupEdit = async () => {
    if (!editingGroupId || !editGroupName.trim()) return;
    await onUpdateGroup(editingGroupId, { name: editGroupName.trim() });
    setEditingGroupId(null);
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
          rightAction={
            <button
              onClick={onCreateNote}
              className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
              title={t("notes.newNote")}
            >
              <Plus size={14} />
            </button>
          }
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
                  if (e.key === "Escape") setShowGroupCreate(false);
                }}
                placeholder={t("ideas.groupName")}
                className="w-full text-xs px-2 py-1 rounded bg-notion-bg text-notion-text outline-none border border-notion-border focus:border-notion-accent/50 mb-2"
                autoFocus
              />
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
                            if (e.key === "Escape") setEditingGroupId(null);
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
                          onClick={() => setEditingGroupId(null)}
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

                  {/* Expanded: member notes */}
                  {isGroupExpanded && (
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
