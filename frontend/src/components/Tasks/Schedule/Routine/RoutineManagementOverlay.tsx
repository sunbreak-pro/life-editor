import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Pencil, Trash2, Archive, X, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineTag } from "../../../../types/routineTag";
import { RoutineEditDialog } from "./RoutineEditDialog";
import { RoutineTagEditPopover } from "./RoutineTagEditPopover";
import { getTextColorForBg } from "../../../../constants/folderColors";

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

  // Tag popover state
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editTagAnchorEl, setEditTagAnchorEl] = useState<HTMLElement | null>(
    null,
  );
  const [showAllTags, setShowAllTags] = useState(false);
  const allTagsButtonRef = useRef<HTMLButtonElement>(null);
  const allTagsPopoverRef = useRef<HTMLDivElement>(null);

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

  const openTagPopover = useCallback((tagId: number, el: HTMLElement) => {
    setEditingTagId(tagId);
    setEditTagAnchorEl(el);
  }, []);

  const closeTagPopover = useCallback(() => {
    setEditingTagId(null);
    setEditTagAnchorEl(null);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-notion-bg border border-notion-border rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border shrink-0">
          <h3 className="text-base font-semibold text-notion-text">
            {t("dayFlow.routineManagement", "Routine Management")}
          </h3>
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                ref={allTagsButtonRef}
                onClick={() => setShowAllTags((v) => !v)}
                className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                title={t("schedule.manageTags", "Manage Tags")}
              >
                <Tag size={16} />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-3">
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
                    data-sidebar-item
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
                              className="inline-flex items-center px-1.5 py-0 text-[10px] rounded-full shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              style={{
                                backgroundColor: tag.color,
                                color: getTextColorForBg(tag.color),
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openTagPopover(tag.id, e.currentTarget);
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
                      data-sidebar-item
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
        </div>
      </div>

      {/* All Tags dropdown */}
      {showAllTags && allTagsButtonRef.current && (
        <AllTagsDropdown
          anchorEl={allTagsButtonRef.current}
          popoverRef={allTagsPopoverRef}
          tags={routineTags}
          onTagClick={(tag, el) => {
            setShowAllTags(false);
            openTagPopover(tag.id, el);
          }}
          onClose={() => setShowAllTags(false)}
        />
      )}

      {/* Tag edit popover */}
      {editingTagId !== null &&
        editTagAnchorEl &&
        (() => {
          const tag = routineTags.find((t) => t.id === editingTagId);
          return tag ? (
            <RoutineTagEditPopover
              tag={tag}
              anchorEl={editTagAnchorEl}
              onUpdate={onUpdateRoutineTag}
              onDelete={onDeleteRoutineTag}
              onClose={closeTagPopover}
            />
          ) : null;
        })()}

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

// --- All Tags Dropdown ---

interface AllTagsDropdownProps {
  anchorEl: HTMLElement;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  tags: RoutineTag[];
  onTagClick: (tag: RoutineTag, el: HTMLElement) => void;
  onClose: () => void;
}

function AllTagsDropdown({
  anchorEl,
  popoverRef,
  tags,
  onTagClick,
  onClose,
}: AllTagsDropdownProps) {
  const { t } = useTranslation();
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const dropdownWidth = 200;
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 8) {
      left = window.innerWidth - dropdownWidth - 8;
    }
    setPosition({ top: rect.bottom + 4, left: Math.max(8, left) });
  }, [anchorEl]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose, popoverRef]);

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-notion-bg border border-notion-border rounded-lg shadow-lg w-50 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-1.5 border-b border-notion-border">
        <span className="text-[11px] text-notion-text-secondary uppercase tracking-wide font-medium px-1">
          {t("schedule.manageTags", "Manage Tags")}
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={(e) => onTagClick(tag, e.currentTarget)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-notion-hover text-notion-text transition-colors"
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="truncate">{tag.name}</span>
          </button>
        ))}
        {tags.length === 0 && (
          <p className="text-[11px] text-notion-text-secondary px-2 py-1 text-center">
            No tags yet.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
