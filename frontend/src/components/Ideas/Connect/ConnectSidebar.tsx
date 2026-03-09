import { useState, useCallback, useMemo } from "react";
import {
  Search,
  StickyNote,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Merge,
  ChevronRight,
  ChevronDown,
  Link2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
} from "../../../types/wikiTag";
import type { NoteNode } from "../../../types/note";
import { WikiTagChip } from "../../WikiTags/WikiTagChip";
import { UnifiedColorPicker } from "../../shared/UnifiedColorPicker";
import { DEFAULT_PRESET_COLORS } from "../../../constants/folderColors";

interface ConnectSidebarProps {
  query: string;
  onQueryChange: (query: string) => void;
  matchingTags: WikiTag[];
  matchingNotes: NoteNode[];
  selectedTagId: string | null;
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  notes: NoteNode[];
  connections: WikiTagConnection[];
  onSelectTag: (tagId: string | null) => void;
  onNavigateToNote?: (noteId: string) => void;
  onCreateNote: (title: string, tagId?: string) => void;
  onCreateTag: (name: string, color: string) => Promise<WikiTag>;
  onUpdateTag: (
    id: string,
    updates: Partial<Pick<WikiTag, "name" | "color">>,
  ) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
  onMergeTags: (sourceId: string, targetId: string) => Promise<void>;
  onCreateConnection: (
    sourceTagId: string,
    targetTagId: string,
  ) => Promise<void>;
  onDeleteConnection: (
    sourceTagId: string,
    targetTagId: string,
  ) => Promise<void>;
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
  connections,
  onSelectTag,
  onNavigateToNote,
  onCreateNote,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onMergeTags,
  onCreateConnection,
  onDeleteConnection,
}: ConnectSidebarProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(DEFAULT_PRESET_COLORS[0]);
  const [expandedTagIds, setExpandedTagIds] = useState<Set<string>>(new Set());
  const [relationSourceId, setRelationSourceId] = useState<string | null>(null);

  const startEdit = (tag: WikiTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await onUpdateTag(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await onCreateTag(trimmed, newColor);
    setNewName("");
    setShowCreate(false);
  };

  const handleMerge = async (targetId: string) => {
    if (!mergeSourceId || mergeSourceId === targetId) return;
    await onMergeTags(mergeSourceId, targetId);
    setMergeSourceId(null);
  };

  const toggleExpanded = (tagId: string) => {
    setExpandedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const getUsageCount = (tagId: string) =>
    assignments.filter((a) => a.tagId === tagId).length;

  // Notes for a given tag
  const getNotesForTag = useCallback(
    (tagId: string): NoteNode[] => {
      const noteIds = assignments
        .filter((a) => a.tagId === tagId && a.entityType === "note")
        .map((a) => a.entityId);
      return notes.filter((n) => noteIds.includes(n.id));
    },
    [assignments, notes],
  );

  // Connected tags for selected tag
  const connectedTags = useMemo(() => {
    if (!selectedTagId) return [];
    return connections
      .filter(
        (c) =>
          c.sourceTagId === selectedTagId || c.targetTagId === selectedTagId,
      )
      .map((c) => {
        const otherId =
          c.sourceTagId === selectedTagId ? c.targetTagId : c.sourceTagId;
        return tags.find((t) => t.id === otherId);
      })
      .filter((t): t is WikiTag => !!t);
  }, [selectedTagId, connections, tags]);

  // Check if two tags are connected
  const isConnected = useCallback(
    (tagId1: string, tagId2: string) =>
      connections.some(
        (c) =>
          (c.sourceTagId === tagId1 && c.targetTagId === tagId2) ||
          (c.sourceTagId === tagId2 && c.targetTagId === tagId1),
      ),
    [connections],
  );

  const handleToggleRelation = async (targetId: string) => {
    if (!relationSourceId || relationSourceId === targetId) return;
    if (isConnected(relationSourceId, targetId)) {
      await onDeleteConnection(relationSourceId, targetId);
    } else {
      await onCreateConnection(relationSourceId, targetId);
    }
  };

  const handleCreateNote = useCallback(() => {
    const selectedTag = tags.find((t) => t.id === selectedTagId);
    const title = selectedTag ? selectedTag.name : "Untitled";
    onCreateNote(title, selectedTagId ?? undefined);
  }, [tags, selectedTagId, onCreateNote]);

  const selectedTag = selectedTagId
    ? tags.find((t) => t.id === selectedTagId)
    : null;

  // Notes associated with selected tag
  const tagNotes = selectedTag
    ? matchingNotes.length > 0
      ? matchingNotes
      : (() => {
          const noteIds = assignments
            .filter(
              (a) => a.tagId === selectedTag.id && a.entityType === "note",
            )
            .map((a) => a.entityId);
          return matchingNotes.filter((n) => noteIds.includes(n.id));
        })()
    : matchingNotes;

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-notion-border">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-notion-text-secondary"
          />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("ideas.searchTagsAndNotes")}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-notion-hover text-notion-text outline-none border border-transparent focus:border-notion-accent/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Selected tag info */}
        {selectedTag && (
          <div className="p-3 border-b border-notion-border">
            <div className="flex items-center justify-between mb-2">
              <WikiTagChip tag={selectedTag} size="md" />
              <button
                onClick={handleCreateNote}
                className="text-[10px] px-2 py-1 rounded bg-notion-accent text-white hover:opacity-90"
              >
                {t("ideas.newNoteButton")}
              </button>
            </div>

            {/* Relations section */}
            {connectedTags.length > 0 && (
              <div className="mt-2">
                <h4 className="text-[10px] font-semibold text-notion-text-secondary uppercase tracking-wider mb-1">
                  {t("ideas.relations")}
                </h4>
                <div className="space-y-0.5">
                  {connectedTags.map((ct) => (
                    <div
                      key={ct.id}
                      className="flex items-center gap-2 px-1 py-1 rounded hover:bg-notion-hover group"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: ct.color }}
                      />
                      <span
                        className="flex-1 text-xs text-notion-text truncate cursor-pointer"
                        onClick={() => onSelectTag(ct.id)}
                      >
                        {ct.name}
                      </span>
                      <button
                        onClick={() =>
                          onDeleteConnection(selectedTagId!, ct.id)
                        }
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-notion-text-secondary hover:text-red-500 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Note search results */}
        {(query.trim() || selectedTag) && tagNotes.length > 0 && (
          <div className="p-3 border-b border-notion-border">
            <h4 className="text-[10px] font-semibold text-notion-text-secondary uppercase tracking-wider mb-2">
              {t("ideas.notes")}
            </h4>
            <div className="space-y-1">
              {tagNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => onNavigateToNote?.(note.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-notion-hover text-left transition-colors"
                >
                  <StickyNote
                    size={12}
                    className="text-notion-text-secondary shrink-0"
                  />
                  <span className="text-xs text-notion-text truncate">
                    {note.title || "Untitled"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tag management section */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-semibold text-notion-text-secondary uppercase tracking-wider">
              {t("wikiTags.title")}
            </h4>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="p-1 rounded text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Create new tag */}
          {showCreate && (
            <div className="mb-3 p-2 rounded-md bg-notion-hover/50 border border-notion-border">
              <div className="mb-1.5">
                <UnifiedColorPicker
                  color={newColor}
                  onChange={setNewColor}
                  mode="preset-only"
                />
              </div>
              <div className="flex items-center gap-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setShowCreate(false);
                  }}
                  placeholder={t("wikiTags.tagNamePlaceholder")}
                  className="flex-1 text-xs px-2 py-1 rounded bg-notion-bg text-notion-text outline-none border border-notion-border focus:border-notion-accent/50"
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="text-xs px-2 py-1 rounded bg-notion-accent text-white disabled:opacity-40"
                >
                  {t("wikiTags.create")}
                </button>
              </div>
            </div>
          )}

          {/* Relation mode banner */}
          {relationSourceId && (
            <div className="mb-2 px-2 py-1.5 rounded bg-notion-accent/10 border border-notion-accent/30 flex items-center gap-2">
              <Link2 size={12} className="text-notion-accent shrink-0" />
              <span className="text-[10px] text-notion-accent flex-1">
                {t("ideas.linkTags")}
              </span>
              <button
                onClick={() => setRelationSourceId(null)}
                className="text-[10px] text-notion-text-secondary hover:text-notion-text"
              >
                {t("common.cancel")}
              </button>
            </div>
          )}

          {/* Tags list */}
          <div className="space-y-0.5">
            {(query.trim() ? matchingTags : tags).map((tag) => {
              const isExpanded = expandedTagIds.has(tag.id);
              const tagNotesForDropdown = getNotesForTag(tag.id);

              return (
                <div key={tag.id}>
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-notion-hover group transition-colors cursor-pointer ${
                      selectedTagId === tag.id ? "bg-notion-hover" : ""
                    }`}
                    onClick={() =>
                      onSelectTag(tag.id === selectedTagId ? null : tag.id)
                    }
                  >
                    {editingId === tag.id ? (
                      <>
                        <UnifiedColorPicker
                          color={editColor}
                          onChange={setEditColor}
                          mode="preset-only"
                        />
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.nativeEvent.isComposing) return;
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="flex-1 text-xs px-1.5 py-0.5 rounded bg-notion-hover text-notion-text outline-none border border-notion-border"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveEdit();
                          }}
                          className="p-0.5 text-green-500 hover:text-green-400"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                          className="p-0.5 text-notion-text-secondary hover:text-notion-text"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : deleteConfirmId === tag.id ? (
                      <div
                        className="flex items-center gap-1.5 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] text-notion-text-secondary flex-1">
                          {t("wikiTags.deleteConfirm", { name: tag.name })}
                        </span>
                        <button
                          onClick={() => {
                            onDeleteTag(tag.id);
                            setDeleteConfirmId(null);
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white"
                        >
                          {t("common.delete")}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-[10px] text-notion-text-secondary"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    ) : mergeSourceId === tag.id ? (
                      <div
                        className="flex items-center gap-1.5 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] text-notion-text-secondary flex-1">
                          {t("wikiTags.mergeSelectTarget")}
                        </span>
                        <button
                          onClick={() => setMergeSourceId(null)}
                          className="text-[10px] text-notion-text-secondary"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Expand/collapse toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(tag.id);
                          }}
                          className="p-0.5 text-notion-text-secondary hover:text-notion-text shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronRight size={12} />
                          )}
                        </button>

                        {/* Relation mode checkbox */}
                        {relationSourceId && relationSourceId !== tag.id ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleRelation(tag.id);
                            }}
                            className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                              isConnected(relationSourceId, tag.id)
                                ? "border-notion-accent bg-notion-accent"
                                : "border-notion-text-secondary"
                            }`}
                          >
                            {isConnected(relationSourceId, tag.id) && (
                              <Check size={8} className="text-white" />
                            )}
                          </button>
                        ) : (
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                        )}

                        <span className="flex-1 text-xs text-notion-text truncate">
                          {tag.name}
                        </span>
                        <span className="text-[10px] text-notion-text-secondary tabular-nums">
                          {getUsageCount(tag.id)}
                        </span>
                        {mergeSourceId && mergeSourceId !== tag.id ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMerge(tag.id);
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-notion-accent text-white"
                          >
                            {t("wikiTags.mergeInto")}
                          </button>
                        ) : !relationSourceId ? (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(tag);
                              }}
                              className="p-0.5 text-notion-text-secondary hover:text-notion-text"
                              title={t("wikiTags.editTag")}
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRelationSourceId(tag.id);
                              }}
                              className="p-0.5 text-notion-text-secondary hover:text-notion-accent"
                              title={t("ideas.linkTags")}
                            >
                              <Link2 size={11} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMergeSourceId(tag.id);
                              }}
                              className="p-0.5 text-notion-text-secondary hover:text-notion-accent"
                              title={t("wikiTags.merge")}
                            >
                              <Merge size={11} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(tag.id);
                              }}
                              className="p-0.5 text-notion-text-secondary hover:text-red-500"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  {/* Expanded dropdown: notes for this tag */}
                  {isExpanded && tagNotesForDropdown.length > 0 && (
                    <div className="pl-6 space-y-0.5">
                      {tagNotesForDropdown.map((note) => (
                        <button
                          key={note.id}
                          onClick={() => onNavigateToNote?.(note.id)}
                          className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-notion-hover text-left transition-colors"
                        >
                          <StickyNote
                            size={10}
                            className="text-notion-text-secondary shrink-0"
                          />
                          <span className="text-[11px] text-notion-text truncate">
                            {note.title || "Untitled"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {isExpanded && tagNotesForDropdown.length === 0 && (
                    <div className="pl-6 px-2 py-1">
                      <span className="text-[10px] text-notion-text-secondary">
                        {t("ideas.noSearchResults")}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {tags.length === 0 && (
              <p className="text-[10px] text-notion-text-secondary px-2 py-4 text-center">
                {t("wikiTags.empty")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
