import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { useConfirmableSubmit } from "../../../../hooks/useConfirmableSubmit";
import { toLocalISOString } from "../../../../utils/dateKey";
import { flattenFolders } from "../../../../utils/flattenFolders";
import { FolderList } from "../../Folder/FolderList";
import { MiniCalendarGrid } from "../../../shared/MiniCalendarGrid";
import type { TaskNode } from "../../../../types/taskTree";

interface TaskCreatePopoverProps {
  position: { x: number; y: number };
  date: Date;
  onSubmitTask: (
    title: string,
    parentId: string | null,
    schedule: {
      scheduledAt: string;
      scheduledEndAt?: string;
      isAllDay?: boolean;
    },
  ) => void;
  onSubmitNote?: (title: string) => void;
  folders?: TaskNode[];
  onClose: () => void;
}

export function TaskCreatePopover({
  position,
  date,
  onSubmitTask,
  folders,
  onClose,
}: TaskCreatePopoverProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;

  const initialStart = toLocalISOString(
    (() => {
      const dt = new Date(date);
      if (!hasTime) dt.setHours(9, 0, 0, 0);
      return dt;
    })(),
  );
  const initialEnd = toLocalISOString(
    (() => {
      const dt = new Date(date);
      if (!hasTime) {
        dt.setHours(10, 0, 0, 0);
      } else {
        dt.setHours(dt.getHours() + 1, dt.getMinutes(), 0, 0);
      }
      return dt;
    })(),
  );

  const [isAllDay, setIsAllDay] = useState(!hasTime);
  const [startValue, setStartValue] = useState<string | undefined>(
    initialStart,
  );
  const [endValue, setEndValue] = useState<string | undefined>(
    hasTime ? initialEnd : undefined,
  );

  useClickOutside(ref, onClose, true);

  const flatFolders = useMemo(
    () => (folders ? flattenFolders(folders) : []),
    [folders],
  );

  const buildSchedule = () => ({
    scheduledAt: startValue ?? toLocalISOString(date),
    ...(endValue && !isAllDay ? { scheduledEndAt: endValue } : {}),
    ...(isAllDay ? { isAllDay: true as const } : {}),
  });

  const handleSubmit = () => {
    onSubmitTask(title.trim() || "Untitled", selectedFolderId, buildSchedule());
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

  const popoverWidth = 600;
  const popoverHeight = 400;
  const margin = 16;
  const left = Math.min(position.x, window.innerWidth - popoverWidth - margin);
  const spaceBelow = window.innerHeight - position.y - margin;
  const spaceAbove = position.y - margin;
  const top =
    spaceBelow >= popoverHeight
      ? position.y
      : spaceAbove >= popoverHeight
        ? position.y - popoverHeight
        : margin;

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-notion-bg border border-notion-border rounded-lg shadow-xl p-2 max-h-[calc(100vh-32px)] overflow-y-auto"
      style={{ left, top, width: popoverWidth }}
    >
      <div className="flex gap-3">
        {/* Left column: Title + Folder */}
        <div className="flex-1 min-w-0 flex flex-col">
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

          {/* Folder selector */}
          {flatFolders.length > 0 && (
            <div className="mt-2 flex-1 min-h-0">
              <label className="text-[10px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
                {t("calendar.selectFolder")}
              </label>
              <FolderList
                folders={flatFolders}
                selectedId={selectedFolderId}
                onSelect={setSelectedFolderId}
                rootLabel="Root"
                bordered
                maxHeightClass="max-h-48"
              />
            </div>
          )}
        </div>

        {/* Right column: MiniCalendarGrid */}
        <div className="w-[280px] shrink-0">
          <MiniCalendarGrid
            startValue={startValue}
            endValue={endValue}
            isAllDay={isAllDay}
            onStartChange={setStartValue}
            onEndChange={setEndValue}
            onAllDayChange={setIsAllDay}
            initialDate={date}
          />
        </div>
      </div>
    </div>
  );
}
