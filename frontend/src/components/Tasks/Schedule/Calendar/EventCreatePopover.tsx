import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { useClampedPosition } from "../../../../hooks/useClampedPosition";
import { TimeSettingsInline } from "../../../shared/TaskSchedulePanel/TimeSettingsInline";
import type { CalendarTag } from "../../../../types/calendarTag";

interface EventCreatePopoverProps {
  position: { x: number; y: number };
  date: Date;
  calendarTags: CalendarTag[];
  onCreateEvent: (
    title: string,
    startTime: string,
    endTime: string,
    memo: string,
    tagIds: number[],
    isAllDay: boolean,
  ) => void;
  onClose: () => void;
}

export function EventCreatePopover({
  position,
  date,
  calendarTags,
  onCreateEvent,
  onClose,
}: EventCreatePopoverProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const adjusted = useClampedPosition(ref, position);
  useClickOutside(ref, onClose, true);

  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isAllDay, setIsAllDay] = useState(false);
  const [hasEndTime, setHasEndTime] = useState(true);
  const [memo, setMemo] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const dateLabel = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

  const handleSubmit = () => {
    if (!title.trim()) return;
    onCreateEvent(
      title.trim(),
      isAllDay ? "00:00" : startTime,
      isAllDay ? "23:59" : hasEndTime ? endTime : startTime,
      memo.trim(),
      selectedTagIds,
      isAllDay,
    );
    onClose();
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  return (
    <div
      ref={ref}
      className="fixed z-[60] bg-notion-bg border border-notion-border rounded-lg shadow-lg p-3 w-[280px]"
      style={{ left: adjusted.x, top: adjusted.y }}
    >
      <div className="text-xs text-notion-text-secondary mb-2">
        {t("calendar.createEvent")} — {dateLabel}
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("calendar.eventTitle")}
        className="w-full px-2 py-1.5 text-sm border border-notion-border rounded bg-notion-bg text-notion-text placeholder-notion-text-secondary focus:outline-none focus:border-notion-accent mb-2"
        autoFocus
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") onClose();
        }}
      />

      <div className="mb-2">
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

      {calendarTags.length > 0 && (
        <div className="mb-2">
          <label className="text-[10px] text-notion-text-secondary">
            {t("calendar.calendarTags")}
          </label>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {calendarTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  selectedTagIds.includes(tag.id)
                    ? "border-transparent text-white"
                    : "border-notion-border text-notion-text-secondary hover:bg-notion-hover"
                }`}
                style={
                  selectedTagIds.includes(tag.id)
                    ? {
                        backgroundColor: tag.color,
                        color: tag.textColor ?? "#fff",
                      }
                    : undefined
                }
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder={t("calendar.eventMemo")}
        className="w-full px-2 py-1.5 text-sm border border-notion-border rounded bg-notion-bg text-notion-text placeholder-notion-text-secondary focus:outline-none focus:border-notion-accent mb-2 resize-none"
        rows={2}
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs text-notion-text-secondary hover:bg-notion-hover rounded transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="px-3 py-1 text-xs bg-notion-accent text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {t("common.create")}
        </button>
      </div>
    </div>
  );
}
