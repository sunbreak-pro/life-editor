import { useState, useMemo, useCallback } from "react";
import { Plus, Pencil, Trash2, Archive, X, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineTag } from "../../../../types/routineTag";
import { RoutineEditDialog } from "./RoutineEditDialog";
import { getTextColorForBg } from "../../../../constants/folderColors";
import { UnifiedColorPicker } from "../../../shared/UnifiedColorPicker";
import { DEFAULT_PRESET_COLORS } from "../../../../constants/folderColors";

interface RoutineManagementOverlayProps {
  routines: RoutineNode[];
  routineTags: RoutineTag[];
  tagAssignments: Map<string, number[]>;
  onCreateRoutine: (
    title: string,
    startTime?: string,
    endTime?: string,
  ) => string;
  onUpdateRoutine: (
    id: string,
    updates: Partial<
      Pick<RoutineNode, "title" | "startTime" | "endTime" | "isArchived">
    >,
  ) => void;
  onDeleteRoutine: (id: string) => void;
  setTagsForRoutine: (routineId: string, tagIds: number[]) => void;
  getCompletionRate: (routineId: string) => {
    completed: number;
    total: number;
  };
  onCreateRoutineTag: (name: string, color: string) => Promise<RoutineTag>;
  onUpdateRoutineTag: (
    id: number,
    updates: Partial<Pick<RoutineTag, "name" | "color">>,
  ) => void;
  onDeleteRoutineTag: (id: number) => void;
  onClose: () => void;
}

export function RoutineManagementOverlay({
  routines,
  routineTags,
  tagAssignments,
  onCreateRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  setTagsForRoutine,
  getCompletionRate,
  onCreateRoutineTag,
  onUpdateRoutineTag,
  onDeleteRoutineTag,
  onClose,
}: RoutineManagementOverlayProps) {
  const { t } = useTranslation();
  const [editDialog, setEditDialog] = useState<RoutineNode | "new" | null>(
    null,
  );

  // Tag manager state
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");
  const [deleteConfirmTagId, setDeleteConfirmTagId] = useState<number | null>(
    null,
  );
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(
    DEFAULT_PRESET_COLORS[0],
  );

  const activeRoutines = useMemo(
    () =>
      routines
        .filter((r) => !r.isArchived)
        .sort((a, b) =>
          (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"),
        ),
    [routines],
  );

  const archivedRoutines = useMemo(
    () => routines.filter((r) => r.isArchived),
    [routines],
  );

  const handleEditSubmit = useCallback(
    (
      title: string,
      startTime?: string,
      endTime?: string,
      tagIds?: number[],
    ) => {
      if (editDialog === "new") {
        const id = onCreateRoutine(title, startTime, endTime);
        if (tagIds && tagIds.length > 0) {
          setTagsForRoutine(id, tagIds);
        }
      } else if (editDialog) {
        onUpdateRoutine(editDialog.id, { title, startTime, endTime });
        if (tagIds !== undefined) {
          setTagsForRoutine(editDialog.id, tagIds);
        }
      }
    },
    [editDialog, onCreateRoutine, onUpdateRoutine, setTagsForRoutine],
  );

  const startEditTag = (tag: RoutineTag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  };

  const saveEditTag = () => {
    if (editingTagId === null || !editTagName.trim()) return;
    onUpdateRoutineTag(editingTagId, {
      name: editTagName.trim(),
      color: editTagColor,
    });
    setEditingTagId(null);
  };

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    try {
      await onCreateRoutineTag(trimmed, newTagColor);
      setNewTagName("");
    } catch (err) {
      console.error("Failed to create tag:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-notion-bg border border-notion-border rounded-lg shadow-xl w-[820px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border shrink-0">
          <h3 className="text-base font-semibold text-notion-text">
            {t("dayFlow.routineManagement", "Routine Management")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content - 2 columns */}
        <div className="flex flex-1 min-h-0">
          {/* Left column: Routine list */}
          <div className="flex-1 border-r border-notion-border overflow-y-auto p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-notion-text-secondary uppercase tracking-wide font-medium">
                Routines
              </span>
              <button
                onClick={() => setEditDialog("new")}
                className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>

            {activeRoutines.length === 0 && (
              <p className="text-[11px] text-notion-text-secondary py-1">
                No routines yet.
              </p>
            )}

            <div className="space-y-0.5">
              {activeRoutines.map((routine) => {
                const rate = getCompletionRate(routine.id);
                const routineTagIds = tagAssignments.get(routine.id) ?? [];
                return (
                  <div
                    key={routine.id}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-notion-border hover:bg-notion-hover group transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm text-notion-text truncate">
                          {routine.title}
                        </span>
                        {routineTagIds.map((tagId) => {
                          const tag = routineTags.find((t) => t.id === tagId);
                          return tag ? (
                            <span
                              key={tag.id}
                              className="inline-flex items-center px-1.5 py-0 text-[10px] rounded-full shrink-0"
                              style={{
                                backgroundColor: tag.color,
                                color: getTextColorForBg(tag.color),
                              }}
                            >
                              {tag.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <div className="text-[11px] text-notion-text-secondary">
                        {routine.startTime && routine.endTime
                          ? `${routine.startTime} - ${routine.endTime}`
                          : routine.startTime
                            ? routine.startTime
                            : "No time set"}
                        {rate.total > 0 && (
                          <span className="ml-2">
                            {rate.completed}/{rate.total}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditDialog(routine)}
                        className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() =>
                          onUpdateRoutine(routine.id, { isArchived: true })
                        }
                        className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                        title="Archive"
                      >
                        <Archive size={12} />
                      </button>
                      <button
                        onClick={() => onDeleteRoutine(routine.id)}
                        className="p-0.5 text-notion-text-secondary hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Archived */}
            {archivedRoutines.length > 0 && (
              <details className="mt-2">
                <summary className="text-[11px] text-notion-text-secondary cursor-pointer hover:text-notion-text transition-colors">
                  Archived ({archivedRoutines.length})
                </summary>
                <div className="mt-1 space-y-0.5">
                  {archivedRoutines.map((routine) => (
                    <div
                      key={routine.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-notion-hover group opacity-50"
                    >
                      <span className="flex-1 text-sm text-notion-text-secondary truncate">
                        {routine.title}
                      </span>
                      <button
                        onClick={() =>
                          onUpdateRoutine(routine.id, { isArchived: false })
                        }
                        className="opacity-0 group-hover:opacity-100 text-[11px] text-notion-text-secondary hover:text-notion-text transition-all"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Right column: Tag management */}
          <div className="w-[320px] overflow-y-auto p-3">
            <span className="text-[11px] text-notion-text-secondary uppercase tracking-wide font-medium block mb-2">
              {t("schedule.manageTags", "Manage Tags")}
            </span>

            <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
              {routineTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-notion-hover group"
                >
                  {editingTagId === tag.id ? (
                    <>
                      <UnifiedColorPicker
                        color={editTagColor}
                        onChange={setEditTagColor}
                        mode="preset-only"
                      />
                      <input
                        value={editTagName}
                        onChange={(e) => setEditTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.nativeEvent.isComposing) return;
                          if (e.key === "Enter") saveEditTag();
                          if (e.key === "Escape") setEditingTagId(null);
                        }}
                        className="flex-1 text-sm px-1.5 py-0.5 rounded bg-notion-hover text-notion-text outline-none"
                        autoFocus
                      />
                      <button
                        onClick={saveEditTag}
                        className="p-0.5 text-green-500"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setEditingTagId(null)}
                        className="p-0.5 text-notion-text-secondary"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : deleteConfirmTagId === tag.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[11px] text-notion-text-secondary flex-1">
                        {t("schedule.deleteTagConfirm", 'Delete "{{name}}"?', {
                          name: tag.name,
                        })}
                      </span>
                      <button
                        onClick={() => {
                          onDeleteRoutineTag(tag.id);
                          setDeleteConfirmTagId(null);
                        }}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-red-500 text-white"
                      >
                        {t("common.delete", "Delete")}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmTagId(null)}
                        className="text-[11px] text-notion-text-secondary"
                      >
                        {t("common.cancel", "Cancel")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-sm text-notion-text">
                        {tag.name}
                      </span>
                      <button
                        onClick={() => startEditTag(tag)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-notion-text-secondary hover:text-notion-text transition-opacity"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmTagId(tag.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-notion-text-secondary hover:text-red-500 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {routineTags.length === 0 && (
                <p className="text-[11px] text-notion-text-secondary px-2 py-1">
                  No tags yet.
                </p>
              )}
            </div>

            {/* Create new tag */}
            <div className="border-t border-notion-border pt-2">
              <div className="mb-1">
                <UnifiedColorPicker
                  color={newTagColor}
                  onChange={setNewTagColor}
                  mode="preset-only"
                />
              </div>
              <div className="flex items-center gap-1">
                <input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter") handleCreateTag();
                  }}
                  placeholder={t("schedule.tagName", "Tag name...")}
                  className="flex-1 text-sm px-2 py-1 rounded bg-notion-hover text-notion-text outline-none"
                />
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className="text-sm px-2 py-1 rounded bg-notion-accent text-white disabled:opacity-40"
                >
                  {t("schedule.createTag", "Create")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editDialog && (
        <RoutineEditDialog
          routine={editDialog === "new" ? undefined : editDialog}
          tags={routineTags}
          initialTagIds={
            editDialog !== "new"
              ? (tagAssignments.get(editDialog.id) ?? [])
              : []
          }
          onSubmit={handleEditSubmit}
          onCreateTag={onCreateRoutineTag}
          onClose={() => setEditDialog(null)}
        />
      )}
    </div>
  );
}
