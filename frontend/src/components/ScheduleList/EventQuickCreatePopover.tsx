import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MiniCalendarGrid } from "../shared/MiniCalendarGrid";
import { TimeSettingsInline } from "../shared/TaskSchedulePanel/TimeSettingsInline";
import { useScheduleItemsContext } from "../../hooks/useScheduleItemsContext";
import { formatDateKey } from "../../utils/dateKey";
import { defaultEndTimeForStart } from "../../utils/timeGridUtils";

interface EventQuickCreatePopoverProps {
  onClose: () => void;
}

function roundToNearest5Min(): string {
  const now = new Date();
  const minutes = Math.ceil(now.getMinutes() / 5) * 5;
  const h = minutes === 60 ? now.getHours() + 1 : now.getHours();
  const m = minutes === 60 ? 0 : minutes;
  return `${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function EventQuickCreatePopover({
  onClose,
}: EventQuickCreatePopoverProps) {
  const { t } = useTranslation();
  const { createScheduleItem, bumpEventsVersion } = useScheduleItemsContext();
  const popoverRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const today = formatDateKey(new Date());
  const defaultStart = roundToNearest5Min();
  const defaultEnd = defaultEndTimeForStart(defaultStart);

  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string | undefined>(today);
  const [scheduledEndAt, setScheduledEndAt] = useState<string | undefined>(
    undefined,
  );
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState(defaultStart);
  const [hasEndTime, setHasEndTime] = useState(true);
  const [endTime, setEndTime] = useState(defaultEnd);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleCreate = useCallback(() => {
    const date = scheduledAt ?? today;
    const eventTitle = title.trim() || t("events.untitled", "Untitled");
    const st = isAllDay ? "00:00" : startTime;
    const et = isAllDay ? "23:59" : hasEndTime ? endTime : startTime;

    createScheduleItem(
      date,
      eventTitle,
      st,
      et,
      undefined,
      undefined,
      undefined,
      isAllDay,
    );
    bumpEventsVersion();
    onClose();
  }, [
    scheduledAt,
    today,
    title,
    isAllDay,
    startTime,
    hasEndTime,
    endTime,
    createScheduleItem,
    bumpEventsVersion,
    onClose,
    t,
  ]);

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-1 z-50 w-72 bg-notion-bg border border-notion-border rounded-lg shadow-lg p-3 space-y-3"
    >
      {/* Title */}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") handleCreate();
        }}
        placeholder={t("events.titlePlaceholder", "Event title")}
        className="w-full px-2 py-1.5 text-sm bg-transparent border border-notion-border rounded-md outline-none text-notion-text placeholder:text-notion-text-secondary/50 focus:border-notion-accent"
      />

      {/* Calendar */}
      <MiniCalendarGrid
        startValue={scheduledAt}
        endValue={scheduledEndAt}
        isAllDay={isAllDay}
        controlsPosition="bottom"
        onStartChange={(val) => setScheduledAt(val)}
        onEndChange={(val) => setScheduledEndAt(val)}
        onAllDayChange={(val) => {
          setIsAllDay(val);
          if (val) setScheduledEndAt(undefined);
        }}
      />

      {/* Time Settings */}
      <TimeSettingsInline
        isAllDay={isAllDay}
        onAllDayChange={(val) => {
          setIsAllDay(val);
          if (val) setScheduledEndAt(undefined);
        }}
        startTime={startTime}
        onStartTimeChange={setStartTime}
        hasEndTime={hasEndTime}
        onHasEndTimeChange={setHasEndTime}
        endTime={endTime}
        onEndTimeChange={setEndTime}
      />

      {/* Create button */}
      <button
        onClick={handleCreate}
        className="w-full py-1.5 text-sm font-medium text-white bg-notion-accent rounded-md hover:opacity-90 transition-opacity"
      >
        {t("events.createEvent")}
      </button>
    </div>
  );
}
