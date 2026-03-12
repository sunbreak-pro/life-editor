import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../../../hooks/useClickOutside";

interface NoteCreatePopoverProps {
  position: { x: number; y: number };
  date: Date;
  existingDailyDate?: boolean;
  onCreateNote: (title: string) => void;
  onCreateDaily: (dateKey: string) => void;
  onOpenExistingDaily?: () => void;
  onClose: () => void;
}

export function NoteCreatePopover({
  position,
  date,
  existingDailyDate,
  onCreateNote,
  onCreateDaily,
  onOpenExistingDaily,
  onClose,
}: NoteCreatePopoverProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<"note" | "daily">("note");
  const [title, setTitle] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useClickOutside(ref, onClose, true);

  useEffect(() => {
    if (kind === "note") {
      inputRef.current?.focus();
    }
  }, [kind]);

  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const handleSubmit = () => {
    if (kind === "note") {
      onCreateNote(title.trim() || "Untitled");
    } else {
      if (existingDailyDate) {
        onOpenExistingDaily?.();
      } else {
        onCreateDaily(dateKey);
      }
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const popoverWidth = 260;
  const popoverHeight = 180;
  const margin = 16;
  const left = Math.min(position.x, window.innerWidth - popoverWidth - margin);
  const spaceBelow = window.innerHeight - position.y - margin;
  const top =
    spaceBelow >= popoverHeight ? position.y : position.y - popoverHeight;

  return (
    <div
      ref={ref}
      className="fixed z-50 w-65 bg-notion-bg border border-notion-border rounded-lg shadow-xl p-3"
      style={{ left, top }}
    >
      {/* Radio buttons */}
      <div className="flex gap-3 mb-3">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="radio"
            name="noteKind"
            checked={kind === "note"}
            onChange={() => setKind("note")}
            className="accent-notion-accent"
          />
          {t("calendar.note", "Note")}
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="radio"
            name="noteKind"
            checked={kind === "daily"}
            onChange={() => setKind("daily")}
            className="accent-notion-accent"
          />
          {t("calendar.daily", "Daily")}
        </label>
      </div>

      {/* Title input (Note only) */}
      {kind === "note" && (
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("calendar.noteNamePlaceholder")}
          className="w-full px-2 py-1.5 text-sm bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary mb-3"
        />
      )}

      {/* Daily: show date or existing info */}
      {kind === "daily" && (
        <div className="text-xs text-notion-text-secondary mb-3 px-1">
          {existingDailyDate
            ? t("calendar.dailyExists", "Daily already exists for this date")
            : dateKey}
        </div>
      )}

      {/* Action button */}
      <button
        onClick={handleSubmit}
        className="w-full px-3 py-1.5 text-xs font-medium rounded-md bg-notion-accent text-white hover:opacity-90 transition-opacity"
      >
        {kind === "daily" && existingDailyDate
          ? t("calendar.openDetail", "Open detail")
          : t("schedule.create", "Create")}
      </button>
    </div>
  );
}
