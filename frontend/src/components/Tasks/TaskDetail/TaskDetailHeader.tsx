import { useState } from "react";
import { EditableTitle } from "../../shared/EditableTitle";
import { Play, Trash2, Clock, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../../types/taskTree";
import type { Priority } from "../../../types/priority";
import { PriorityPicker } from "../../shared/PriorityPicker";
import { DurationPicker } from "../../shared/DurationPicker";
import { formatDuration } from "../../../utils/duration";
import { DateTimeRangePicker } from "../Schedule/shared/DateTimeRangePicker";
import { ReminderToggle } from "../../shared/ReminderToggle";

interface TaskDetailHeaderProps {
  task: TaskNode;
  globalWorkDuration: number;
  onPlay: () => void;
  onDelete: () => void;
  onDurationChange?: (minutes: number) => void;
  onScheduledAtChange?: (scheduledAt: string | undefined) => void;
  onScheduledEndAtChange?: (scheduledEndAt: string | undefined) => void;
  onIsAllDayChange?: (isAllDay: boolean) => void;
  onNodeIconChange?: (nodeId: string, icon: string | undefined) => void;
  onTitleChange?: (newTitle: string) => void;
  onTimeMemoChange?: (value: string | undefined) => void;
  onPriorityChange?: (priority: Priority | null) => void;
  onReminderEnabledChange?: (enabled: boolean) => void;
  onReminderOffsetChange?: (offset: number) => void;
}

export function TaskDetailHeader({
  task,
  globalWorkDuration,
  onPlay,
  onDelete,
  onDurationChange,
  onScheduledAtChange,
  onScheduledEndAtChange,
  onIsAllDayChange,
  onTitleChange,
  onTimeMemoChange,
  onPriorityChange,
  onReminderEnabledChange,
  onReminderOffsetChange,
}: TaskDetailHeaderProps) {
  const { t } = useTranslation();
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [prevTaskId, setPrevTaskId] = useState(task.id);

  if (prevTaskId !== task.id) {
    setPrevTaskId(task.id);
    setIsEditingTitle(false);
  }

  const handleTitleSave = (trimmed: string) => {
    if (trimmed !== task.title) {
      onTitleChange?.(trimmed);
    }
    setIsEditingTitle(false);
  };
  const duration = task.workDurationMinutes ?? globalWorkDuration;
  const isCustomDuration = task.workDurationMinutes != null;

  return (
    <div className="space-y-3 pb-4 border-b border-notion-border">
      {isEditingTitle ? (
        <EditableTitle
          value={task.title}
          onSave={handleTitleSave}
          onCancel={() => setIsEditingTitle(false)}
          className="text-2xl font-bold bg-transparent outline-none border-b border-notion-accent w-full text-notion-text"
        />
      ) : (
        <h1
          className="text-2xl font-bold text-notion-text cursor-pointer hover:bg-notion-hover/50 rounded px-1 -mx-1 transition-colors"
          onClick={() => setIsEditingTitle(true)}
        >
          {task.title}
        </h1>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onPlay}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-notion-accent text-white hover:opacity-90 transition-opacity"
        >
          <Play size={14} />
          <span>{t("taskDetail.start")}</span>
        </button>
        <div className="relative">
          <button
            onClick={() => setShowDurationPicker(!showDurationPicker)}
            className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-md transition-colors ${
              isCustomDuration
                ? "text-notion-accent bg-notion-accent/10"
                : "text-notion-text-secondary hover:bg-notion-hover"
            }`}
          >
            <Clock size={14} />
            <span>{formatDuration(duration)}</span>
          </button>

          {showDurationPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg p-3 w-56">
              <DurationPicker
                value={duration}
                onChange={(min) => onDurationChange?.(min)}
                showResetToDefault={isCustomDuration}
                onResetToDefault={() => {
                  onDurationChange?.(0);
                  setShowDurationPicker(false);
                }}
                defaultLabel={t("taskDetail.useGlobalDefault", {
                  min: globalWorkDuration,
                })}
              />
            </div>
          )}
        </div>

        <PriorityPicker
          value={task.priority}
          onChange={(p) => onPriorityChange?.(p)}
        />

        <DateTimeRangePicker
          startValue={task.scheduledAt}
          endValue={task.scheduledEndAt}
          isAllDay={task.isAllDay}
          onStartChange={(val) => onScheduledAtChange?.(val)}
          onEndChange={(val) => onScheduledEndAtChange?.(val)}
          onAllDayChange={(val) => onIsAllDayChange?.(val)}
        />

        {task.scheduledAt && onReminderEnabledChange && (
          <ReminderToggle
            enabled={!!task.reminderEnabled}
            offset={task.reminderOffset ?? 30}
            onEnabledChange={onReminderEnabledChange}
            onOffsetChange={(offset) => onReminderOffsetChange?.(offset)}
            compact
          />
        )}

        {task.scheduledAt && onTimeMemoChange && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-notion-border">
            <StickyNote
              size={14}
              className="text-notion-text-secondary shrink-0"
            />
            <input
              type="text"
              value={task.timeMemo ?? ""}
              onChange={(e) => onTimeMemoChange(e.target.value || undefined)}
              placeholder={t("taskDetail.timeMemo")}
              className="text-sm bg-transparent outline-none text-notion-text placeholder:text-notion-text-secondary/50 w-28"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <button
          onClick={onDelete}
          className="p-1.5 rounded-md text-notion-text-secondary hover:text-notion-danger hover:bg-notion-hover transition-colors ml-auto"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
