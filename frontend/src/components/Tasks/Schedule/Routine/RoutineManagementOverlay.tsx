import { useState, useMemo, useCallback } from "react";
import { Plus, Pencil, Trash2, Archive, X, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode, FrequencyType } from "../../../../types/routine";
import type { RoutineTag } from "../../../../types/routineTag";
import type { RoutineGroup } from "../../../../types/routineGroup";
import { RoutineEditDialog } from "./RoutineEditDialog";
import { RoutineGroupEditDialog } from "./RoutineGroupEditDialog";
import { RoutineEditTimeChangeDialog } from "./RoutineEditTimeChangeDialog";
import { getTextColorForBg } from "../../../../constants/folderColors";
import {
  minutesToTimeString,
  timeToMinutes,
} from "../../../../utils/timeGridUtils";

interface RoutineManagementOverlayProps {
  routines: RoutineNode[];
  routineTags: RoutineTag[];
  tagAssignments: Map<string, number[]>;
  onCreateRoutine: (
    title: string,
    startTime?: string,
    endTime?: string,
    frequencyType?: FrequencyType,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
  ) => string;
  onUpdateRoutine: (
    id: string,
    updates: Partial<
      Pick<
        RoutineNode,
        | "title"
        | "startTime"
        | "endTime"
        | "isArchived"
        | "frequencyType"
        | "frequencyDays"
        | "frequencyInterval"
        | "frequencyStartDate"
      >
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
  // Routine Groups
  routineGroups: RoutineGroup[];
  groupTagAssignments: Map<string, number[]>;
  routinesByGroup: Map<string, RoutineNode[]>;
  groupTimeRange: Map<string, { startTime: string; endTime: string }>;
  onCreateRoutineGroup: (
    id: string,
    name: string,
    color: string,
    frequencyType?: FrequencyType,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
  ) => Promise<RoutineGroup>;
  onUpdateRoutineGroup: (
    id: string,
    updates: Partial<
      Pick<
        RoutineGroup,
        | "name"
        | "color"
        | "order"
        | "frequencyType"
        | "frequencyDays"
        | "frequencyInterval"
        | "frequencyStartDate"
      >
    >,
  ) => void;
  onDeleteRoutineGroup: (id: string) => void;
  setTagsForGroup: (groupId: string, tagIds: number[]) => void;
  onSkipNextSync?: () => void;
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
  routineGroups,
  groupTagAssignments,
  routinesByGroup,
  groupTimeRange,
  onCreateRoutineGroup,
  onUpdateRoutineGroup,
  onDeleteRoutineGroup,
  setTagsForGroup,
  onSkipNextSync,
  onClose,
}: RoutineManagementOverlayProps) {
  const { t } = useTranslation();
  const [editDialog, setEditDialog] = useState<RoutineNode | "new" | null>(
    null,
  );
  const [groupEditDialog, setGroupEditDialog] = useState<
    RoutineGroup | "new" | null
  >(null);

  // Pending time change confirmation
  const [pendingTimeChange, setPendingTimeChange] = useState<{
    routineId: string;
    routineTitle: string;
    startTime?: string;
    endTime?: string;
  } | null>(null);

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
      frequencyType?: FrequencyType,
      frequencyDays?: number[],
      frequencyInterval?: number | null,
      frequencyStartDate?: string | null,
    ) => {
      if (editDialog === "new") {
        const id = onCreateRoutine(
          title,
          startTime,
          endTime,
          frequencyType,
          frequencyDays,
          frequencyInterval,
          frequencyStartDate,
        );
        if (tagIds && tagIds.length > 0) {
          setTagsForRoutine(id, tagIds);
        }
      } else if (editDialog) {
        const timeChanged =
          (startTime !== undefined &&
            startTime !== (editDialog.startTime ?? undefined)) ||
          (endTime !== undefined &&
            endTime !== (editDialog.endTime ?? undefined));

        const freqUpdates = {
          frequencyType,
          frequencyDays,
          frequencyInterval,
          frequencyStartDate,
        };

        if (timeChanged) {
          // Update title, frequency, and tags immediately
          onUpdateRoutine(editDialog.id, { title, ...freqUpdates });
          if (tagIds !== undefined) {
            setTagsForRoutine(editDialog.id, tagIds);
          }
          // Defer time update to confirmation dialog
          setPendingTimeChange({
            routineId: editDialog.id,
            routineTitle: title,
            startTime,
            endTime,
          });
        } else {
          onUpdateRoutine(editDialog.id, {
            title,
            startTime,
            endTime,
            ...freqUpdates,
          });
          if (tagIds !== undefined) {
            setTagsForRoutine(editDialog.id, tagIds);
          }
        }
      }
    },
    [editDialog, onCreateRoutine, onUpdateRoutine, setTagsForRoutine],
  );

  const handleGroupSubmit = useCallback(
    async (
      name: string,
      color: string,
      tagIds: number[],
      frequencyType?: FrequencyType,
      frequencyDays?: number[],
      frequencyInterval?: number | null,
      frequencyStartDate?: string | null,
    ) => {
      if (groupEditDialog === "new") {
        const id = `rgroup-${crypto.randomUUID()}`;
        const group = await onCreateRoutineGroup(
          id,
          name,
          color,
          frequencyType,
          frequencyDays,
          frequencyInterval,
          frequencyStartDate,
        );
        if (tagIds.length > 0) {
          setTagsForGroup(group.id, tagIds);
        }
      } else if (groupEditDialog) {
        onUpdateRoutineGroup(groupEditDialog.id, {
          name,
          color,
          frequencyType,
          frequencyDays,
          frequencyInterval,
          frequencyStartDate,
        });
        setTagsForGroup(groupEditDialog.id, tagIds);
      }
    },
    [
      groupEditDialog,
      onCreateRoutineGroup,
      onUpdateRoutineGroup,
      setTagsForGroup,
    ],
  );

  const handleSlideGroup = useCallback(
    (groupId: string, offsetMinutes: number) => {
      const members = routinesByGroup.get(groupId) ?? [];
      for (const routine of members) {
        if (!routine.startTime || !routine.endTime) continue;
        const oldStart = timeToMinutes(routine.startTime);
        const oldEnd = timeToMinutes(routine.endTime);
        const newStart = Math.max(
          0,
          Math.min(23 * 60 + 59, oldStart + offsetMinutes),
        );
        const newEnd = Math.max(
          0,
          Math.min(23 * 60 + 59, oldEnd + offsetMinutes),
        );
        onUpdateRoutine(routine.id, {
          startTime: minutesToTimeString(newStart),
          endTime: minutesToTimeString(newEnd),
        });
      }
    },
    [routinesByGroup, onUpdateRoutine],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-notion-bg border border-notion-border rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
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
          {/* Left column: Routines */}
          <div className="flex-1 overflow-y-auto p-3 border-r border-notion-border">
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
          </div>

          {/* Right column: Groups + Archived */}
          <div className="w-[280px] shrink-0 overflow-y-auto p-3">
            {/* Groups */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-notion-text-secondary uppercase tracking-wide font-medium flex items-center gap-1">
                  <Layers size={12} />
                  {t("routineGroup.groups", "Groups")}
                </span>
                <button
                  onClick={() => setGroupEditDialog("new")}
                  className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>

              {routineGroups.length === 0 && (
                <p className="text-[11px] text-notion-text-secondary py-1">
                  {t("routineGroup.noGroups", "No groups yet.")}
                </p>
              )}

              <div className="space-y-0.5">
                {routineGroups.map((group) => {
                  const memberCount = (routinesByGroup.get(group.id) ?? [])
                    .length;
                  const timeRange = groupTimeRange.get(group.id);
                  return (
                    <div
                      key={group.id}
                      data-sidebar-item
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-notion-border hover:bg-notion-hover group transition-colors"
                    >
                      <span
                        className="w-3 h-3 rounded shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-notion-text truncate block">
                          {group.name}
                        </span>
                        <div className="text-[11px] text-notion-text-secondary">
                          {memberCount} {t("routineGroup.members", "routines")}
                          {timeRange && (
                            <span className="ml-2">
                              {timeRange.startTime} - {timeRange.endTime}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setGroupEditDialog(group)}
                          className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => onDeleteRoutineGroup(group.id)}
                          className="p-0.5 text-notion-text-secondary hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Archived */}
            {archivedRoutines.length > 0 && (
              <details className="mt-3">
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

      {groupEditDialog && (
        <RoutineGroupEditDialog
          group={groupEditDialog === "new" ? undefined : groupEditDialog}
          tags={routineTags}
          initialTagIds={
            groupEditDialog !== "new"
              ? (groupTagAssignments.get(groupEditDialog.id) ?? [])
              : []
          }
          memberRoutines={
            groupEditDialog !== "new"
              ? (routinesByGroup.get(groupEditDialog.id) ?? [])
              : []
          }
          groupTimeRange={
            groupEditDialog !== "new"
              ? groupTimeRange.get(groupEditDialog.id)
              : undefined
          }
          onSubmit={handleGroupSubmit}
          onSlideGroup={
            groupEditDialog !== "new"
              ? (offset) => handleSlideGroup(groupEditDialog.id, offset)
              : undefined
          }
          onClose={() => setGroupEditDialog(null)}
        />
      )}

      {pendingTimeChange && (
        <RoutineEditTimeChangeDialog
          routineTitle={pendingTimeChange.routineTitle}
          newTime={`${pendingTimeChange.startTime ?? "?"} - ${pendingTimeChange.endTime ?? "?"}`}
          onTemplateOnly={() => {
            // Update routine time but skip sync to existing schedule items
            onSkipNextSync?.();
            onUpdateRoutine(pendingTimeChange.routineId, {
              startTime: pendingTimeChange.startTime,
              endTime: pendingTimeChange.endTime,
            });
            setPendingTimeChange(null);
          }}
          onApplyToAll={() => {
            // Update routine time and let sync propagate to schedule items
            onUpdateRoutine(pendingTimeChange.routineId, {
              startTime: pendingTimeChange.startTime,
              endTime: pendingTimeChange.endTime,
            });
            setPendingTimeChange(null);
          }}
          onCancel={() => {
            setPendingTimeChange(null);
          }}
        />
      )}
    </div>
  );
}
