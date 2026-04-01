import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { ScheduleItem } from "../../types/schedule";

interface MobileScheduleItemFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ScheduleItemFormData) => void;
  onDelete?: () => void;
  editingItem?: ScheduleItem | null;
  defaultDate: string;
}

export interface ScheduleItemFormData {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  memo: string;
}

function roundToNext15(time?: string): string {
  if (time) return time;
  const now = new Date();
  const minutes = Math.ceil(now.getMinutes() / 15) * 15;
  now.setMinutes(minutes, 0, 0);
  if (minutes >= 60) {
    now.setHours(now.getHours() + 1, 0, 0, 0);
  }
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function addHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const newH = Math.min(23, h + 1);
  return `${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function MobileScheduleItemForm({
  open,
  onClose,
  onSave,
  onDelete,
  editingItem,
  defaultDate,
}: MobileScheduleItemFormProps) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(() => roundToNext15());
  const [endTime, setEndTime] = useState(() => addHour(roundToNext15()));
  const [isAllDay, setIsAllDay] = useState(false);
  const [memo, setMemo] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      if (editingItem) {
        setTitle(editingItem.title);
        setDate(editingItem.date);
        setStartTime(editingItem.startTime);
        setEndTime(editingItem.endTime);
        setIsAllDay(editingItem.isAllDay ?? false);
        setMemo(editingItem.memo ?? "");
      } else {
        setTitle("");
        setDate(defaultDate);
        const start = roundToNext15();
        setStartTime(start);
        setEndTime(addHour(start));
        setIsAllDay(false);
        setMemo("");
      }
      setShowDeleteConfirm(false);
      // Focus title input after animation
      setTimeout(() => titleRef.current?.focus(), 300);
    }
  }, [open, editingItem, defaultDate]);

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), date, startTime, endTime, isAllDay, memo });
  }, [title, date, startTime, endTime, isAllDay, memo, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const isEditing = !!editingItem;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up rounded-t-2xl bg-notion-bg shadow-lg">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-notion-text-secondary/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className="text-base font-semibold text-notion-text">
            {isEditing
              ? t("mobile.schedule.edit", "Edit Item")
              : t("mobile.schedule.create", "New Item")}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full active:bg-notion-hover"
          >
            <X size={18} className="text-notion-text-secondary" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 px-4 pb-2">
          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("mobile.schedule.titlePlaceholder", "Title")}
            className="w-full rounded-lg border border-notion-border bg-notion-bg-secondary px-3 py-2.5 text-sm text-notion-text placeholder:text-notion-text-secondary/50 focus:border-notion-accent focus:outline-none"
          />

          {/* Date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-notion-text-secondary">
              {t("mobile.schedule.date", "Date")}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-notion-border bg-notion-bg-secondary px-3 py-2.5 text-sm text-notion-text focus:border-notion-accent focus:outline-none"
            />
          </div>

          {/* All-day toggle */}
          <label className="flex items-center gap-3">
            <div
              role="switch"
              aria-checked={isAllDay}
              onClick={() => setIsAllDay(!isAllDay)}
              className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${
                isAllDay ? "bg-notion-accent" : "bg-notion-text-secondary/30"
              }`}
            >
              <div
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  isAllDay ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-sm text-notion-text">
              {t("mobile.schedule.allDay", "All day")}
            </span>
          </label>

          {/* Time pickers */}
          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-notion-text-secondary">
                  {t("mobile.schedule.startTime", "Start")}
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-notion-border bg-notion-bg-secondary px-3 py-2.5 text-sm text-notion-text focus:border-notion-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-notion-text-secondary">
                  {t("mobile.schedule.endTime", "End")}
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-notion-border bg-notion-bg-secondary px-3 py-2.5 text-sm text-notion-text focus:border-notion-accent focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Memo */}
          <div>
            <label className="mb-1 block text-xs font-medium text-notion-text-secondary">
              {t("mobile.schedule.memo", "Memo")}
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder={t(
                "mobile.schedule.memoPlaceholder",
                "Add a note...",
              )}
              className="w-full resize-none rounded-lg border border-notion-border bg-notion-bg-secondary px-3 py-2.5 text-sm text-notion-text placeholder:text-notion-text-secondary/50 focus:border-notion-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pt-2 pb-8">
          {isEditing && onDelete && (
            <>
              {showDeleteConfirm ? (
                <button
                  onClick={onDelete}
                  className="rounded-lg bg-notion-danger px-4 py-2.5 text-sm font-medium text-white active:opacity-80"
                >
                  {t("mobile.schedule.confirmDelete", "Confirm")}
                </button>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-lg border border-notion-danger px-4 py-2.5 text-sm font-medium text-notion-danger active:opacity-80"
                >
                  {t("common.delete", "Delete")}
                </button>
              )}
            </>
          )}
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="ml-auto rounded-lg bg-notion-accent px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40 active:opacity-80"
          >
            {isEditing
              ? t("common.save", "Save")
              : t("mobile.schedule.add", "Add")}
          </button>
        </div>
      </div>
    </>
  );
}
