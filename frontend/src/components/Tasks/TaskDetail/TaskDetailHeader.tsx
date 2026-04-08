import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";
import { Play, Trash2, Clock, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../../types/taskTree";
import type { Priority } from "../../../types/priority";
import { PriorityPicker } from "../../shared/PriorityPicker";
import { getAncestors } from "../../../utils/breadcrumb";
import { DurationPicker } from "../../shared/DurationPicker";
import { formatDuration } from "../../../utils/duration";
import { DateTimeRangePicker } from "../Schedule/shared/DateTimeRangePicker";
import { FolderTag } from "../Folder/FolderTag";
import { UnifiedColorPicker } from "../../shared/UnifiedColorPicker";

interface TaskDetailHeaderProps {
  task: TaskNode;
  allNodes: TaskNode[];
  globalWorkDuration: number;
  onPlay: () => void;
  onDelete: () => void;
  onDurationChange?: (minutes: number) => void;
  onScheduledAtChange?: (scheduledAt: string | undefined) => void;
  onScheduledEndAtChange?: (scheduledEndAt: string | undefined) => void;
  onIsAllDayChange?: (isAllDay: boolean) => void;
  onFolderColorChange?: (folderId: string, color: string) => void;
  onTitleChange?: (newTitle: string) => void;
  onTimeMemoChange?: (value: string | undefined) => void;
  onPriorityChange?: (priority: Priority | null) => void;
  folderTag?: string;
  taskColor?: string;
}

export function TaskDetailHeader({
  task,
  allNodes,
  globalWorkDuration,
  onPlay,
  onDelete,
  onDurationChange,
  onScheduledAtChange,
  onScheduledEndAtChange,
  onIsAllDayChange,
  onFolderColorChange,
  onTitleChange,
  onTimeMemoChange,
  onPriorityChange,
  folderTag,
  taskColor,
}: TaskDetailHeaderProps) {
  const { t } = useTranslation();
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [colorPickerAncestorId, setColorPickerAncestorId] = useState<
    string | null
  >(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(task.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [prevTaskId, setPrevTaskId] = useState(task.id);

  if (prevTaskId !== task.id) {
    setPrevTaskId(task.id);
    setIsEditingTitle(false);
    setEditTitleValue(task.title);
  }

  const startEditing = () => {
    setEditTitleValue(task.title);
    setIsEditingTitle(true);
  };

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSave = () => {
    const trimmed = editTitleValue.trim();
    if (trimmed && trimmed !== task.title) {
      onTitleChange?.(trimmed);
    } else {
      setEditTitleValue(task.title);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") handleTitleSave();
    if (e.key === "Escape") {
      setEditTitleValue(task.title);
      setIsEditingTitle(false);
    }
  };
  const ancestors = getAncestors(task.id, allNodes);
  const duration = task.workDurationMinutes ?? globalWorkDuration;
  const isCustomDuration = task.workDurationMinutes != null;

  return (
    <div className="space-y-3 pb-4 border-b border-notion-border">
      {ancestors.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-notion-text-secondary">
            {ancestors.map((ancestor, i) => (
              <span
                key={ancestor.id}
                className="flex items-center gap-1.5 relative"
              >
                {i > 0 && <span>/</span>}
                {ancestor.type === "folder" && onFolderColorChange ? (
                  <>
                    <button
                      onClick={() =>
                        setColorPickerAncestorId(
                          colorPickerAncestorId === ancestor.id
                            ? null
                            : ancestor.id,
                        )
                      }
                      className="hover:text-notion-text transition-colors cursor-pointer"
                    >
                      <FolderTag tag={ancestor.title} color={ancestor.color} />
                    </button>
                    {colorPickerAncestorId === ancestor.id && (
                      <UnifiedColorPicker
                        color={ancestor.color ?? ""}
                        onChange={(color) =>
                          onFolderColorChange(ancestor.id, color)
                        }
                        onClose={() => setColorPickerAncestorId(null)}
                      />
                    )}
                  </>
                ) : (
                  <span>{ancestor.title}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
      {!ancestors.length && folderTag && (
        <div className="flex items-center">
          <FolderTag tag={folderTag} color={taskColor} />
        </div>
      )}
      {isEditingTitle ? (
        <input
          ref={titleInputRef}
          type="text"
          value={editTitleValue}
          onChange={(e) => setEditTitleValue(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={handleTitleKeyDown}
          maxLength={255}
          className="text-2xl font-bold bg-transparent outline-none border-b border-notion-accent w-full text-notion-text"
        />
      ) : (
        <h1
          className="text-2xl font-bold text-notion-text cursor-pointer hover:bg-notion-hover/50 rounded px-1 -mx-1 transition-colors"
          onClick={() => startEditing()}
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
