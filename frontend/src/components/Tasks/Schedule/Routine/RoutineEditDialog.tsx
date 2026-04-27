import { useState, useEffect, useRef } from "react";
import { X, Plus, Check, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode, FrequencyType } from "../../../../types/routine";
import type { RoutineGroup } from "../../../../types/routineGroup";
import { TimeDropdown } from "../../../shared/TimeDropdown";
import { FrequencySelector } from "./FrequencySelector";
import { useConfirmableSubmit } from "../../../../hooks/useConfirmableSubmit";
import {
  formatTime,
  adjustEndTimeForStartChange,
  clampEndTimeAfterStart,
} from "../../../../utils/timeGridUtils";
import { getTodayKey } from "../../../../utils/dateKey";
import { ReminderToggle } from "../../../shared/ReminderToggle";
import { UnifiedColorPicker } from "../../../shared/UnifiedColorPicker";
import { getTextColorForBg } from "../../../../constants/folderColors";

interface RoutineEditDialogProps {
  routine?: RoutineNode;
  routineGroups: RoutineGroup[];
  initialGroupIds?: string[];
  onSubmit: (
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
  ) => void;
  /**
   * Inline-create a Group from inside the dialog. The created group is added
   * to the dialog's selected set so the routine immediately joins it.
   */
  onCreateGroup?: (
    name: string,
    color: string,
    frequencyType: FrequencyType,
    frequencyDays: number[],
    frequencyInterval: number | null,
    frequencyStartDate: string | null,
  ) => Promise<RoutineGroup>;
  /**
   * Optional: navigate to the full Routine management overlay. When provided,
   * the dialog renders a header button that closes itself and opens the panel.
   */
  onOpenManagement?: () => void;
  onClose: () => void;
}

export function RoutineEditDialog({
  routine,
  routineGroups,
  initialGroupIds,
  onSubmit,
  onCreateGroup,
  onOpenManagement,
  onClose,
}: RoutineEditDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(routine?.title ?? "");
  const [startTime, setStartTime] = useState(routine?.startTime ?? "");
  const [endTime, setEndTime] = useState(routine?.endTime ?? "");
  const prevStartRef = useRef(startTime);
  const [frequencyType, setFrequencyType] = useState<FrequencyType>(
    routine?.frequencyType ?? "daily",
  );
  const [frequencyDays, setFrequencyDays] = useState<number[]>(
    routine?.frequencyDays ?? [],
  );
  const [frequencyInterval, setFrequencyInterval] = useState(
    routine?.frequencyInterval ?? 2,
  );
  const [frequencyStartDate, setFrequencyStartDate] = useState(
    routine?.frequencyStartDate ?? getTodayKey(),
  );
  const [reminderEnabled, setReminderEnabled] = useState(
    !!routine?.reminderEnabled,
  );
  const [reminderOffset, setReminderOffset] = useState(
    routine?.reminderOffset ?? 30,
  );
  const [groupIds, setGroupIds] = useState<string[]>(initialGroupIds ?? []);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#6B7280");
  const [newGroupFrequencyType, setNewGroupFrequencyType] =
    useState<FrequencyType>("daily");
  const [newGroupFrequencyDays, setNewGroupFrequencyDays] = useState<number[]>(
    [],
  );
  const [newGroupFrequencyInterval, setNewGroupFrequencyInterval] = useState(2);
  const [newGroupFrequencyStartDate, setNewGroupFrequencyStartDate] =
    useState(getTodayKey());
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [creatingError, setCreatingError] = useState<string | null>(null);

  const toggleGroup = (groupId: string) => {
    setGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((g) => g !== groupId)
        : [...prev, groupId],
    );
  };

  const handleCreateGroupSubmit = async () => {
    if (!onCreateGroup || !newGroupName.trim()) return;
    setCreatingError(null);
    try {
      const created = await onCreateGroup(
        newGroupName.trim(),
        newGroupColor,
        newGroupFrequencyType,
        newGroupFrequencyType === "weekdays" ? newGroupFrequencyDays : [],
        newGroupFrequencyType === "interval" ? newGroupFrequencyInterval : null,
        newGroupFrequencyType === "interval"
          ? newGroupFrequencyStartDate
          : null,
      );
      setGroupIds((prev) =>
        prev.includes(created.id) ? prev : [...prev, created.id],
      );
      setCreatingGroup(false);
      setNewGroupName("");
      setNewGroupColor("#6B7280");
      setNewGroupFrequencyType("daily");
      setNewGroupFrequencyDays([]);
    } catch (e) {
      setCreatingError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    // For frequencyType="group" the routine inherits day-of evaluation from
    // its assigned Groups — its own frequencyDays/Interval/StartDate become
    // moot. Persist them as null/[] so re-opening doesn't show stale values.
    const isGroup = frequencyType === "group";
    onSubmit(
      title.trim(),
      startTime || undefined,
      endTime || undefined,
      groupIds,
      frequencyType,
      isGroup ? [] : frequencyType === "weekdays" ? frequencyDays : [],
      isGroup ? null : frequencyType === "interval" ? frequencyInterval : null,
      isGroup ? null : frequencyType === "interval" ? frequencyStartDate : null,
      reminderEnabled,
      reminderOffset,
    );
    onClose();
  };

  const { inputRef, handleKeyDown, handleBlur, handleFocus, readyToSubmit } =
    useConfirmableSubmit(handleSubmit, onClose);

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-notion-bg border border-notion-border rounded-lg shadow-xl p-4 w-96 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-notion-text">
            {routine
              ? t("schedule.editRoutine", "Edit Routine")
              : t("schedule.newRoutine", "New Routine")}
          </h3>
          <div className="flex items-center gap-1">
            {onOpenManagement && (
              <button
                type="button"
                onClick={() => {
                  onOpenManagement();
                  onClose();
                }}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
                title={t("common.openManagement", "Open Management")}
              >
                <Settings size={12} />
                <span>{t("common.openManagement", "Open Management")}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
              {t("schedule.routineTitle", "Title")}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onFocus={handleFocus}
              placeholder={t(
                "schedule.routineTitlePlaceholder",
                "Routine name",
              )}
              className="w-full px-2 py-1.5 text-base bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
                {t("schedule.start", "Start")}
              </label>
              <TimeDropdown
                hour={parseInt(startTime.split(":")[0] || "0", 10)}
                minute={parseInt(startTime.split(":")[1] || "0", 10)}
                onChange={(h, m) => {
                  const newStart = formatTime(h, m);
                  if (prevStartRef.current && endTime) {
                    setEndTime(
                      adjustEndTimeForStartChange(
                        prevStartRef.current,
                        newStart,
                        endTime,
                      ),
                    );
                  }
                  prevStartRef.current = newStart;
                  setStartTime(newStart);
                }}
                minuteStep={1}
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
                {t("schedule.end", "End")}
              </label>
              <TimeDropdown
                hour={parseInt(endTime.split(":")[0] || "0", 10)}
                minute={parseInt(endTime.split(":")[1] || "0", 10)}
                onChange={(h, m) => {
                  const newEnd = formatTime(h, m);
                  setEndTime(
                    startTime
                      ? clampEndTimeAfterStart(startTime, newEnd)
                      : newEnd,
                  );
                }}
                minuteStep={1}
              />
            </div>
          </div>

          <FrequencySelector
            frequencyType={frequencyType}
            frequencyDays={frequencyDays}
            frequencyInterval={frequencyInterval}
            frequencyStartDate={frequencyStartDate}
            onFrequencyTypeChange={setFrequencyType}
            onFrequencyDaysChange={setFrequencyDays}
            onFrequencyIntervalChange={setFrequencyInterval}
            onFrequencyStartDateChange={setFrequencyStartDate}
          />

          {frequencyType === "group" && (
            <div className="space-y-2 rounded-md border border-notion-border bg-notion-bg-secondary p-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-notion-text-secondary uppercase tracking-wide">
                  {t("routineGroup.assignToGroup", "Assigned Groups")}
                </label>
                {onCreateGroup && !creatingGroup && (
                  <button
                    type="button"
                    onClick={() => setCreatingGroup(true)}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors"
                  >
                    <Plus size={11} />
                    {t("routineGroup.createNew", "New Group")}
                  </button>
                )}
              </div>

              {routineGroups.length === 0 && !creatingGroup && (
                <p className="text-[11px] text-notion-text-secondary py-1">
                  {t(
                    "routineGroup.noGroupsHint",
                    "No groups yet — create one above.",
                  )}
                </p>
              )}

              <div className="flex flex-wrap gap-1">
                {routineGroups.map((g) => {
                  const selected = groupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-full border transition-colors ${
                        selected
                          ? "border-transparent"
                          : "border-notion-border bg-notion-bg hover:bg-notion-hover"
                      }`}
                      style={
                        selected
                          ? {
                              backgroundColor: g.color,
                              color: getTextColorForBg(g.color),
                            }
                          : undefined
                      }
                    >
                      {selected && <Check size={10} />}
                      {g.name || t("routineGroup.untitled", "Untitled")}
                    </button>
                  );
                })}
              </div>

              {creatingGroup && (
                <div className="space-y-2 rounded-md border border-notion-border bg-notion-bg p-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder={t(
                      "routineGroup.namePlaceholder",
                      "e.g. Morning Routine",
                    )}
                    className="w-full px-2 py-1 text-sm bg-notion-bg-secondary border border-notion-border rounded focus:outline-none focus:ring-1 focus:ring-notion-accent text-notion-text"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowColorPicker((v) => !v)}
                      className="w-6 h-6 rounded-md border border-notion-border"
                      style={{ backgroundColor: newGroupColor }}
                    />
                    <span className="text-[11px] text-notion-text-secondary">
                      {newGroupColor}
                    </span>
                  </div>
                  {showColorPicker && (
                    <UnifiedColorPicker
                      color={newGroupColor}
                      onChange={setNewGroupColor}
                      mode="preset-only"
                      inline
                    />
                  )}
                  <FrequencySelector
                    frequencyType={newGroupFrequencyType}
                    frequencyDays={newGroupFrequencyDays}
                    frequencyInterval={newGroupFrequencyInterval}
                    frequencyStartDate={newGroupFrequencyStartDate}
                    onFrequencyTypeChange={(type) => {
                      // Group itself cannot recurse to "group", so coerce.
                      setNewGroupFrequencyType(
                        type === "group" ? "daily" : type,
                      );
                    }}
                    onFrequencyDaysChange={setNewGroupFrequencyDays}
                    onFrequencyIntervalChange={setNewGroupFrequencyInterval}
                    onFrequencyStartDateChange={setNewGroupFrequencyStartDate}
                  />
                  {creatingError && (
                    <p className="text-[11px] text-red-500">{creatingError}</p>
                  )}
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingGroup(false);
                        setNewGroupName("");
                        setCreatingError(null);
                      }}
                      className="px-2 py-1 text-[11px] text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                    >
                      {t("common.cancel", "Cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateGroupSubmit}
                      disabled={!newGroupName.trim()}
                      className="px-2 py-1 text-[11px] bg-notion-accent text-white rounded hover:bg-notion-accent/90 transition-colors disabled:opacity-50"
                    >
                      {t("routineGroup.create", "Create Group")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
              {t("reminders.itemReminderToggle", "Reminder")}
            </label>
            <ReminderToggle
              enabled={reminderEnabled}
              offset={reminderOffset}
              onEnabledChange={setReminderEnabled}
              onOffsetChange={setReminderOffset}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-notion-danger hover:bg-notion-danger/10 rounded-md transition-colors"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className={`px-3 py-1.5 text-sm bg-notion-accent text-white rounded-md hover:bg-notion-accent/90 transition-colors disabled:opacity-50 ${readyToSubmit ? "ring-2 ring-notion-accent/50 animate-pulse" : ""}`}
          >
            {routine
              ? t("common.save", "Save")
              : t("schedule.create", "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}
