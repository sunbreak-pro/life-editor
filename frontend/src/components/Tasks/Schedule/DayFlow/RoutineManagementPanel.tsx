import { useState } from "react";
import { Plus, Pencil, Trash2, Archive, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineTag } from "../../../../types/routineTag";
import { RoutineEditDialog } from "../Routine/RoutineEditDialog";
import { RoutineTagManager } from "../Routine/RoutineTagManager";
import { getTextColorForBg } from "../../../../constants/folderColors";

export interface RoutineManagementProps {
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
}

export function RoutineManagementPanel({
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
}: RoutineManagementProps) {
  const { t } = useTranslation();
  const [editDialog, setEditDialog] = useState<RoutineNode | "new" | null>(
    null,
  );
  const [showTagManager, setShowTagManager] = useState(false);
  const [selectedFilterTagId, setSelectedFilterTagId] = useState<number | null>(
    null,
  );

  const activeRoutines = routines
    .filter((r) => !r.isArchived)
    .sort((a, b) =>
      (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"),
    );

  const filteredRoutines =
    selectedFilterTagId != null
      ? activeRoutines.filter((r) => {
          const rTagIds = tagAssignments.get(r.id) ?? [];
          return rTagIds.includes(selectedFilterTagId);
        })
      : activeRoutines;

  const archivedRoutines = routines.filter((r) => r.isArchived);

  return (
    <>
      <div className="h-full overflow-y-auto border border-notion-border rounded-lg p-3 bg-notion-bg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-notion-text-secondary uppercase tracking-wide font-medium">
            {t("dayFlow.routineManagement", "Routine Management")}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTagManager(true)}
              className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
              title={t("schedule.manageTags", "Manage Tags")}
            >
              <Tag size={14} />
            </button>
            <button
              onClick={() => setEditDialog("new")}
              className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Tag filter chips */}
        {routineTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-2">
            <button
              onClick={() => setSelectedFilterTagId(null)}
              className={`text-[11px] px-1.5 py-0.5 rounded-full transition-colors ${
                selectedFilterTagId === null
                  ? "bg-notion-text text-notion-bg"
                  : "bg-notion-hover text-notion-text-secondary hover:text-notion-text"
              }`}
            >
              All
            </button>
            {routineTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() =>
                  setSelectedFilterTagId(
                    selectedFilterTagId === tag.id ? null : tag.id,
                  )
                }
                className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full transition-colors ${
                  selectedFilterTagId === tag.id
                    ? "ring-1 ring-notion-text"
                    : "hover:opacity-80"
                }`}
                style={{
                  backgroundColor: tag.color + "E6",
                  color: getTextColorForBg(tag.color),
                  fontWeight: "bold",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {filteredRoutines.length === 0 && (
          <p className="text-[11px] text-notion-text-secondary py-2">
            {selectedFilterTagId != null
              ? "No routines with this tag."
              : "No routines yet. Create one to get started."}
          </p>
        )}

        <div className="space-y-0.5">
          {filteredRoutines.map((routine) => {
            const rate = getCompletionRate(routine.id);
            const routineTagIds = tagAssignments.get(routine.id) ?? [];
            return (
              <div
                key={routine.id}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-notion-border hover:bg-notion-hover group transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-notion-text truncate">
                      {routine.title}
                    </span>
                    {routineTagIds.map((tagId) => {
                      const tag = routineTags.find((t) => t.id === tagId);
                      return tag ? (
                        <span
                          key={tag.id}
                          className="inline-flex items-center px-1.5 py-0 text-[10px] rounded-full text-white shrink-0"
                          style={{ backgroundColor: tag.color }}
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

      {editDialog && (
        <RoutineEditDialog
          routine={editDialog === "new" ? undefined : editDialog}
          tags={routineTags}
          initialTagIds={
            editDialog !== "new"
              ? (tagAssignments.get(editDialog.id) ?? [])
              : []
          }
          onSubmit={(title, startTime, endTime, tagIds) => {
            if (editDialog === "new") {
              const id = onCreateRoutine(title, startTime, endTime);
              if (tagIds && tagIds.length > 0) {
                setTagsForRoutine(id, tagIds);
              }
            } else {
              onUpdateRoutine(editDialog.id, {
                title,
                startTime,
                endTime,
              });
              if (tagIds !== undefined) {
                setTagsForRoutine(editDialog.id, tagIds);
              }
            }
          }}
          onCreateTag={onCreateRoutineTag}
          onClose={() => setEditDialog(null)}
        />
      )}

      {showTagManager && (
        <RoutineTagManager
          tags={routineTags}
          onCreateTag={onCreateRoutineTag}
          onUpdateTag={onUpdateRoutineTag}
          onDeleteTag={onDeleteRoutineTag}
          onClose={() => setShowTagManager(false)}
        />
      )}
    </>
  );
}
