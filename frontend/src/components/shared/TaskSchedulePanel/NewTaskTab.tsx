import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useConfirmableSubmit } from "../../../hooks/useConfirmableSubmit";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import { flattenFolders } from "../../../utils/flattenFolders";
import { FolderList } from "../../Tasks/Folder/FolderList";
import { TimeSettingsInline } from "./TimeSettingsInline";
import type { TaskNode } from "../../../types/taskTree";

interface ScheduleParams {
  scheduledAt: string;
  scheduledEndAt?: string;
  isAllDay?: boolean;
}

interface NewTaskTabProps {
  date: Date;
  defaultStartTime: string;
  defaultEndTime: string;
  folders?: TaskNode[];
  onCreateNewTask: (
    title: string,
    parentId: string | null,
    schedule: ScheduleParams,
  ) => void;
  onClose: () => void;
}

export function NewTaskTab({
  date,
  defaultStartTime,
  defaultEndTime,
  folders: foldersProp,
  onCreateNewTask,
  onClose,
}: NewTaskTabProps) {
  const { t } = useTranslation();
  const { nodes } = useTaskTreeContext();
  const [title, setTitle] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [isAllDay, setIsAllDay] = useState(false);
  const [hasEndTime, setHasEndTime] = useState(true);

  const allFolders =
    foldersProp ?? nodes.filter((n) => n.type === "folder" && !n.isDeleted);
  const flatFolders = useMemo(() => flattenFolders(allFolders), [allFolders]);

  const handleSubmit = () => {
    if (isAllDay) {
      const scheduledDate = new Date(date);
      scheduledDate.setHours(0, 0, 0, 0);
      onCreateNewTask(title.trim() || "Untitled", selectedFolderId, {
        scheduledAt: scheduledDate.toISOString(),
        isAllDay: true,
      });
    } else {
      const [sh, sm] = startTime.split(":").map(Number);
      const scheduledDate = new Date(date);
      scheduledDate.setHours(sh, sm, 0, 0);

      const schedule: ScheduleParams = {
        scheduledAt: scheduledDate.toISOString(),
      };

      if (hasEndTime) {
        const [eh, em] = endTime.split(":").map(Number);
        const scheduledEndDate = new Date(date);
        scheduledEndDate.setHours(eh, em, 0, 0);
        schedule.scheduledEndAt = scheduledEndDate.toISOString();
      }

      onCreateNewTask(title.trim() || "Untitled", selectedFolderId, schedule);
    }
    onClose();
  };

  const {
    inputRef: confirmInputRef,
    handleKeyDown,
    handleBlur,
    handleFocus,
  } = useConfirmableSubmit(handleSubmit, onClose, { singleEnter: true });

  useEffect(() => {
    confirmInputRef.current?.focus();
  }, [confirmInputRef]);

  return (
    <div className="p-3">
      <input
        ref={confirmInputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={t("calendar.taskNamePlaceholder")}
        className="w-full px-2 py-1.5 text-sm bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary"
      />

      <div className="mt-2">
        <TimeSettingsInline
          isAllDay={isAllDay}
          onAllDayChange={setIsAllDay}
          startTime={startTime}
          onStartTimeChange={setStartTime}
          hasEndTime={hasEndTime}
          onHasEndTimeChange={setHasEndTime}
          endTime={endTime}
          onEndTimeChange={setEndTime}
        />
      </div>

      {flatFolders.length > 0 && (
        <div className="mt-2">
          <label className="text-[10px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
            {t("calendar.selectFolder")}
          </label>
          <FolderList
            folders={flatFolders}
            selectedId={selectedFolderId}
            onSelect={setSelectedFolderId}
            rootLabel="Root"
            bordered
            maxHeightClass="max-h-32"
          />
        </div>
      )}

      <button
        onClick={handleSubmit}
        className="w-full mt-2 px-3 py-1.5 text-xs bg-notion-accent text-white rounded-md hover:bg-notion-accent/90 transition-colors"
      >
        {t("schedule.create")}
      </button>
      <button
        onClick={onClose}
        className="w-full mt-1 py-1 text-xs text-notion-text-secondary hover:text-notion-text text-center transition-colors"
      >
        {t("common.cancel")}
      </button>
    </div>
  );
}
