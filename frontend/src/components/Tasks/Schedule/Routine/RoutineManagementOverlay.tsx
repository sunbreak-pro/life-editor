import { useState, useMemo, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  X,
  Layers,
  Eye,
  EyeOff,
} from "lucide-react";
import { IconButton } from "../../../shared/IconButton";
import { useTranslation } from "react-i18next";
import type { RoutineNode, FrequencyType } from "../../../../types/routine";
import type { RoutineGroup } from "../../../../types/routineGroup";
import { RoutineEditDialog } from "./RoutineEditDialog";
import { RoutineGroupEditDialog } from "./RoutineGroupEditDialog";
import { RoutineTimeChangeDialog } from "../shared/RoutineTimeChangeDialog";
import { getTextColorForBg } from "../../../../constants/folderColors";
import {
  minutesToTimeString,
  timeToMinutes,
} from "../../../../utils/timeGridUtils";

interface RoutineManagementOverlayProps {
  routines: RoutineNode[];
  /** V69: Map<routineId, groupId[]> — direct membership replaces tag overlap. */
  routineGroupAssignments: Map<string, string[]>;
  onCreateRoutine: (
    title: string,
    startTime?: string,
    endTime?: string,
    frequencyType?: FrequencyType,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
    reminderEnabled?: boolean,
    reminderOffset?: number,
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
        | "isVisible"
        | "frequencyType"
        | "frequencyDays"
        | "frequencyInterval"
        | "frequencyStartDate"
        | "reminderEnabled"
        | "reminderOffset"
      >
    >,
  ) => void;
  onDeleteRoutine: (id: string) => void;
  setGroupsForRoutine: (routineId: string, groupIds: string[]) => void;
  getCompletionRate: (routineId: string) => {
    completed: number;
    total: number;
  };
  routineGroups: RoutineGroup[];
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
        | "isVisible"
        | "frequencyType"
        | "frequencyDays"
        | "frequencyInterval"
        | "frequencyStartDate"
      >
    >,
  ) => void;
  onDeleteRoutineGroup: (id: string) => void;
  onReconcileRoutineScheduleItems?: (
    routine: RoutineNode,
    group?: RoutineGroup,
  ) => Promise<void>;
  onClose: () => void;
}

export function RoutineManagementOverlay({
  routines,
  routineGroupAssignments,
  onCreateRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  setGroupsForRoutine,
  getCompletionRate,
  routineGroups,
  routinesByGroup,
  groupTimeRange,
  onCreateRoutineGroup,
  onUpdateRoutineGroup,
  onDeleteRoutineGroup,
  onReconcileRoutineScheduleItems,
  onClose,
}: RoutineManagementOverlayProps) {
  const { t } = useTranslation();
  const [editDialog, setEditDialog] = useState<RoutineNode | "new" | null>(
    null,
  );
  const [groupEditDialog, setGroupEditDialog] = useState<
    RoutineGroup | "new" | null
  >(null);

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

  const handleCreateGroupInline = useCallback(
    async (
      name: string,
      color: string,
      frequencyType: FrequencyType,
      frequencyDays: number[],
      frequencyInterval: number | null,
      frequencyStartDate: string | null,
    ): Promise<RoutineGroup> => {
      const id = `rgroup-${crypto.randomUUID()}`;
      return onCreateRoutineGroup(
        id,
        name,
        color,
        frequencyType,
        frequencyDays,
        frequencyInterval,
        frequencyStartDate,
      );
    },
    [onCreateRoutineGroup],
  );

  const handleEditSubmit = useCallback(
    (
      title: string,
      startTime: string | undefined,
      endTime: string | undefined,
      groupIds: string[],
      frequencyType: FrequencyType,
      frequencyDays: number[],
      frequencyInterval: number | null,
      frequencyStartDate: string | null,
      reminderEnabled: boolean,
      reminderOffset: number,
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
          reminderEnabled,
          reminderOffset,
        );
        setGroupsForRoutine(id, groupIds);
      } else if (editDialog) {
        const timeChanged =
          (startTime !== undefined &&
            startTime !== (editDialog.startTime ?? undefined)) ||
          (endTime !== undefined &&
            endTime !== (editDialog.endTime ?? undefined));

        const freqChanged =
          frequencyType !== editDialog.frequencyType ||
          JSON.stringify(frequencyDays) !==
            JSON.stringify(editDialog.frequencyDays) ||
          frequencyInterval !== editDialog.frequencyInterval ||
          frequencyStartDate !== editDialog.frequencyStartDate;

        const freqUpdates = {
          frequencyType,
          frequencyDays,
          frequencyInterval,
          frequencyStartDate,
        };

        const reminderUpdates = {
          reminderEnabled,
          reminderOffset,
        };

        if (timeChanged) {
          onUpdateRoutine(editDialog.id, {
            title,
            ...freqUpdates,
            ...reminderUpdates,
          });
          setGroupsForRoutine(editDialog.id, groupIds);
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
            ...reminderUpdates,
          });
          setGroupsForRoutine(editDialog.id, groupIds);
        }

        if (freqChanged && onReconcileRoutineScheduleItems) {
          const updatedRoutine: RoutineNode = {
            ...editDialog,
            title,
            startTime: startTime ?? editDialog.startTime,
            endTime: endTime ?? editDialog.endTime,
            frequencyType,
            frequencyDays,
            frequencyInterval,
            frequencyStartDate,
            groupIds,
          };
          onReconcileRoutineScheduleItems(updatedRoutine);
        }
      }
    },
    [
      editDialog,
      onCreateRoutine,
      onUpdateRoutine,
      setGroupsForRoutine,
      onReconcileRoutineScheduleItems,
    ],
  );

  const handleGroupSubmit = useCallback(
    async (
      name: string,
      color: string,
      frequencyType: FrequencyType,
      frequencyDays: number[],
      frequencyInterval: number | null,
      frequencyStartDate: string | null,
    ) => {
      if (groupEditDialog === "new") {
        await handleCreateGroupInline(
          name,
          color,
          frequencyType,
          frequencyDays,
          frequencyInterval,
          frequencyStartDate,
        );
      } else if (groupEditDialog) {
        const freqChanged =
          frequencyType !== groupEditDialog.frequencyType ||
          JSON.stringify(frequencyDays) !==
            JSON.stringify(groupEditDialog.frequencyDays) ||
          frequencyInterval !== groupEditDialog.frequencyInterval ||
          frequencyStartDate !== groupEditDialog.frequencyStartDate;

        onUpdateRoutineGroup(groupEditDialog.id, {
          name,
          color,
          frequencyType,
          frequencyDays,
          frequencyInterval,
          frequencyStartDate,
        });

        if (freqChanged && onReconcileRoutineScheduleItems) {
          const updatedGroup = {
            ...groupEditDialog,
            name,
            color,
            frequencyType,
            frequencyDays,
            frequencyInterval,
            frequencyStartDate,
          };
          const members = routinesByGroup.get(groupEditDialog.id) ?? [];
          for (const routine of members) {
            await onReconcileRoutineScheduleItems(routine, updatedGroup);
          }
        }
      }
    },
    [
      groupEditDialog,
      handleCreateGroupInline,
      onUpdateRoutineGroup,
      onReconcileRoutineScheduleItems,
      routinesByGroup,
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

  const handleSlideGroupEndTime = useCallback(
    (groupId: string, offsetMinutes: number) => {
      const members = routinesByGroup.get(groupId) ?? [];
      for (const routine of members) {
        if (!routine.endTime) continue;
        const oldEnd = timeToMinutes(routine.endTime);
        const newEnd = Math.max(
          0,
          Math.min(23 * 60 + 59, oldEnd + offsetMinutes),
        );
        onUpdateRoutine(routine.id, {
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border shrink-0">
          <h3 className="text-base font-semibold text-notion-text">
            {t("dayFlow.routineManagement", "Routine Management")}
          </h3>
          <div className="flex items-center gap-1">
            <IconButton
              icon={<X size={16} />}
              label="Close"
              onClick={onClose}
            />
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
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
                const memberGroupIds =
                  routineGroupAssignments.get(routine.id) ?? [];
                return (
                  <div
                    key={routine.id}
                    data-sidebar-item
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-notion-border hover:bg-notion-hover group transition-colors ${!routine.isVisible ? "opacity-40" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm text-notion-text truncate">
                          {routine.title}
                        </span>
                        {memberGroupIds.map((gid) => {
                          const g = routineGroups.find((rg) => rg.id === gid);
                          return g ? (
                            <span
                              key={g.id}
                              className="inline-flex items-center px-1.5 py-0 text-[10px] rounded-full shrink-0"
                              style={{
                                backgroundColor: g.color,
                                color: getTextColorForBg(g.color),
                              }}
                            >
                              {g.name}
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
                        onClick={() =>
                          onUpdateRoutine(routine.id, {
                            isVisible: !routine.isVisible,
                          })
                        }
                        className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                        title={
                          routine.isVisible
                            ? t("routine.hide", "Hide")
                            : t("routine.show", "Show")
                        }
                      >
                        {routine.isVisible ? (
                          <Eye size={12} />
                        ) : (
                          <EyeOff size={12} />
                        )}
                      </button>
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

          <div className="w-[280px] shrink-0 overflow-y-auto p-3">
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
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-notion-border hover:bg-notion-hover group transition-colors ${!group.isVisible ? "opacity-40" : ""}`}
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
                          onClick={() =>
                            onUpdateRoutineGroup(group.id, {
                              isVisible: !group.isVisible,
                            })
                          }
                          className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                          title={
                            group.isVisible
                              ? t("routine.hide", "Hide")
                              : t("routine.show", "Show")
                          }
                        >
                          {group.isVisible ? (
                            <Eye size={12} />
                          ) : (
                            <EyeOff size={12} />
                          )}
                        </button>
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
          routineGroups={routineGroups}
          initialGroupIds={
            editDialog !== "new"
              ? (routineGroupAssignments.get(editDialog.id) ?? [])
              : []
          }
          onSubmit={handleEditSubmit}
          onCreateGroup={handleCreateGroupInline}
          onClose={() => setEditDialog(null)}
        />
      )}

      {groupEditDialog && (
        <RoutineGroupEditDialog
          group={groupEditDialog === "new" ? undefined : groupEditDialog}
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
          onSlideGroupEndTime={
            groupEditDialog !== "new"
              ? (offset) => handleSlideGroupEndTime(groupEditDialog.id, offset)
              : undefined
          }
          onUpdateRoutine={(id, updates) => onUpdateRoutine(id, updates)}
          onClose={() => setGroupEditDialog(null)}
        />
      )}

      {pendingTimeChange && (
        <RoutineTimeChangeDialog
          routineTitle={pendingTimeChange.routineTitle}
          newStartTime={pendingTimeChange.startTime ?? "?"}
          newEndTime={pendingTimeChange.endTime ?? "?"}
          zIndex={60}
          onThisOnly={() => {
            onUpdateRoutine(pendingTimeChange.routineId, {
              startTime: pendingTimeChange.startTime,
              endTime: pendingTimeChange.endTime,
            });
            setPendingTimeChange(null);
          }}
          onApplyToRoutine={() => {
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
