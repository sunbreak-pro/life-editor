import { useState, useMemo, useCallback } from "react";
import { Plus, Pencil, Trash2, Archive, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DayFlowFilterTab } from "./OneDaySchedule";
import { DAY_FLOW_FILTER_TABS } from "./OneDaySchedule";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineTag } from "../../../../types/routineTag";
import type { ScheduleItem } from "../../../../types/schedule";
import { RoutineEditDialog } from "../Routine/RoutineEditDialog";
import { RoutineTagManager } from "../Routine/RoutineTagManager";
import { MiniRoutineFlow } from "../Routine/MiniRoutineFlow";
import { getTextColorForBg } from "../../../../constants/folderColors";

export interface CategoryProgress {
  completed: number;
  total: number;
}

interface DayFlowSidebarContentProps {
  activeFilter: DayFlowFilterTab;
  onFilterChange: (tab: DayFlowFilterTab) => void;
  categoryProgress: Record<DayFlowFilterTab, CategoryProgress>;
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
  onUpdateRoutineTag?: (
    id: number,
    updates: Partial<Pick<RoutineTag, "name" | "color">>,
  ) => void;
  onDeleteRoutineTag?: (id: number) => void;
  scheduleItems: ScheduleItem[];
  onToggleComplete: (id: string) => void;
}

export function DayFlowSidebarContent({
  activeFilter,
  onFilterChange,
  categoryProgress,
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
  scheduleItems,
  onToggleComplete,
}: DayFlowSidebarContentProps) {
  const { t } = useTranslation();
  const [editDialog, setEditDialog] = useState<RoutineNode | "new" | null>(
    null,
  );
  const [showTagManager, setShowTagManager] = useState(false);

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

  return (
    <div className="flex flex-col gap-3">
      {/* Category progress list */}
      <div className="flex flex-col">
        <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium px-3 py-1.5">
          {t("dayFlow.sidebarProgress", "Progress")}
        </span>
        {DAY_FLOW_FILTER_TABS.map((tab) => {
          const progress = categoryProgress[tab.id];
          const isActive = activeFilter === tab.id;
          const pct =
            progress.total > 0
              ? Math.round((progress.completed / progress.total) * 100)
              : 0;

          return (
            <button
              key={tab.id}
              onClick={() => onFilterChange(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                isActive
                  ? "bg-notion-hover border-l-2 border-l-notion-accent"
                  : "hover:bg-notion-hover/50 border-l-2 border-l-transparent"
              }`}
            >
              <span
                className={`flex-1 text-xs ${
                  isActive
                    ? "text-notion-text font-medium"
                    : "text-notion-text-secondary"
                }`}
              >
                {t(tab.labelKey)}
              </span>
              <span
                className={`text-[11px] tabular-nums ${
                  isActive ? "text-notion-text" : "text-notion-text-secondary"
                }`}
              >
                {progress.completed}/{progress.total}
              </span>
              <div className="w-10 h-1 bg-notion-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-notion-accent rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Routine list */}
      <div className="flex flex-col px-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium">
            {t("dayFlow.routineManagement", "Routines")}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTagManager(true)}
              className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
              title={t("schedule.manageTags", "Manage Tags")}
            >
              <Tag size={12} />
            </button>
            <button
              onClick={() => setEditDialog("new")}
              className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
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
                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-notion-hover group transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-notion-text truncate">
                      {routine.title}
                    </span>
                    {routineTagIds.map((tagId) => {
                      const tag = routineTags.find((t) => t.id === tagId);
                      return tag ? (
                        <span
                          key={tag.id}
                          className="inline-flex items-center px-1 py-0 text-[9px] rounded-full shrink-0"
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
                  <div className="text-[10px] text-notion-text-secondary">
                    {routine.startTime && routine.endTime
                      ? `${routine.startTime} - ${routine.endTime}`
                      : routine.startTime
                        ? routine.startTime
                        : "No time set"}
                    {rate.total > 0 && (
                      <span className="ml-1.5">
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
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() =>
                      onUpdateRoutine(routine.id, { isArchived: true })
                    }
                    className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                    title="Archive"
                  >
                    <Archive size={11} />
                  </button>
                  <button
                    onClick={() => onDeleteRoutine(routine.id)}
                    className="p-0.5 text-notion-text-secondary hover:text-red-500 rounded transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Archived */}
        {archivedRoutines.length > 0 && (
          <details className="mt-1">
            <summary className="text-[10px] text-notion-text-secondary cursor-pointer hover:text-notion-text transition-colors">
              Archived ({archivedRoutines.length})
            </summary>
            <div className="mt-0.5 space-y-0.5">
              {archivedRoutines.map((routine) => (
                <div
                  key={routine.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-notion-hover group opacity-50"
                >
                  <span className="flex-1 text-xs text-notion-text-secondary truncate">
                    {routine.title}
                  </span>
                  <button
                    onClick={() =>
                      onUpdateRoutine(routine.id, { isArchived: false })
                    }
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-notion-text-secondary hover:text-notion-text transition-all"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Mini Routine Flow */}
      <div className="px-3">
        <MiniRoutineFlow
          routines={routines}
          scheduleItems={scheduleItems}
          tagAssignments={tagAssignments}
          onToggleComplete={onToggleComplete}
        />
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

      {showTagManager && onUpdateRoutineTag && onDeleteRoutineTag && (
        <RoutineTagManager
          tags={routineTags}
          onCreateTag={onCreateRoutineTag}
          onUpdateTag={onUpdateRoutineTag}
          onDeleteTag={onDeleteRoutineTag}
          onClose={() => setShowTagManager(false)}
        />
      )}
    </div>
  );
}
