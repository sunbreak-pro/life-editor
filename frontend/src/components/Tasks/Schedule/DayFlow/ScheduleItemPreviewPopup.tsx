import { useRef, useState } from "react";
import { Check, Trash2, Pencil, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScheduleItem } from "../../../../types/schedule";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { TimeInput } from "../../../shared/TimeInput";
import { Button } from "../../../shared/Button";
import {
  formatTime,
  clampEndTimeAfterStart,
  adjustEndTimeForStartChange,
} from "../../../../utils/timeGridUtils";

interface ScheduleItemPreviewPopupProps {
  item: ScheduleItem;
  position: { x: number; y: number };
  onToggleComplete: () => void;
  onUpdateTime?: (startTime: string, endTime: string) => void;
  onEditRoutine?: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ScheduleItemPreviewPopup({
  item,
  position,
  onToggleComplete,
  onUpdateTime,
  onEditRoutine,
  onDelete,
  onClose,
}: ScheduleItemPreviewPopupProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editStartTime, setEditStartTime] = useState(item.startTime);
  const [editEndTime, setEditEndTime] = useState(item.endTime);
  const prevStartRef = useRef(editStartTime);

  useClickOutside(ref, onClose, !isEditingTime);

  const left = Math.min(position.x, window.innerWidth - 260 - 16);
  const top = Math.min(position.y, window.innerHeight - 280 - 16);

  const handleStartTimeChange = (h: number, m: number) => {
    const newStart = formatTime(h, m);
    const adjusted = adjustEndTimeForStartChange(
      prevStartRef.current,
      newStart,
      editEndTime,
    );
    prevStartRef.current = newStart;
    setEditStartTime(newStart);
    setEditEndTime(adjusted);
  };

  const handleEndTimeChange = (h: number, m: number) => {
    const newEnd = formatTime(h, m);
    setEditEndTime(clampEndTimeAfterStart(editStartTime, newEnd));
  };

  const handleTimeSave = () => {
    if (onUpdateTime) {
      onUpdateTime(editStartTime, editEndTime);
    }
    setIsEditingTime(false);
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 bg-notion-bg border border-notion-border rounded-lg shadow-xl"
      style={{ left, top }}
    >
      <div className="p-3 space-y-2">
        <div className="font-medium text-sm text-notion-text truncate">
          {item.title}
        </div>

        {/* Time display / edit */}
        {isEditingTime && onUpdateTime ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <TimeInput
                hour={parseInt(editStartTime.split(":")[0], 10)}
                minute={parseInt(editStartTime.split(":")[1], 10)}
                onChange={handleStartTimeChange}
                minuteStep={5}
                size="sm"
              />
              <span className="text-xs text-notion-text-secondary">-</span>
              <TimeInput
                hour={parseInt(editEndTime.split(":")[0], 10)}
                minute={parseInt(editEndTime.split(":")[1], 10)}
                onChange={handleEndTimeChange}
                minuteStep={5}
                size="sm"
              />
            </div>
            <div className="flex gap-1">
              <Button variant="primary" size="sm" onClick={handleTimeSave}>
                {t("common.save", "Save")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditStartTime(item.startTime);
                  setEditEndTime(item.endTime);
                  setIsEditingTime(false);
                }}
              >
                {t("common.cancel", "Cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onUpdateTime && setIsEditingTime(true)}
            className={`text-xs text-notion-text-secondary flex items-center gap-1 ${
              onUpdateTime
                ? "hover:text-notion-text cursor-pointer"
                : "cursor-default"
            } transition-colors`}
          >
            <Clock size={10} />
            {item.startTime} - {item.endTime}
          </button>
        )}

        <div className="flex items-center gap-2">
          <span
            className={`inline-block px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
              item.completed
                ? "bg-green-100 text-green-700"
                : item.routineId
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-purple-100 text-purple-700"
            }`}
          >
            {item.completed ? "DONE" : item.routineId ? "Routine" : "Event"}
          </span>
        </div>
      </div>
      <div className="border-t border-notion-border flex">
        <button
          onClick={onToggleComplete}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs transition-colors ${
            item.completed
              ? "text-green-600 hover:bg-green-50"
              : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
          }`}
        >
          <Check size={12} />
          {item.completed ? "DONE" : "Complete"}
        </button>
        {item.routineId && onEditRoutine && (
          <>
            <div className="w-px bg-notion-border" />
            <button
              onClick={() => {
                onClose();
                onEditRoutine();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors"
            >
              <Pencil size={12} />
              {t("common.edit", "Edit")}
            </button>
          </>
        )}
      </div>
      <div className="border-t border-notion-border flex">
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-500 hover:bg-red-500/5 transition-colors"
        >
          <Trash2 size={12} />
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}
