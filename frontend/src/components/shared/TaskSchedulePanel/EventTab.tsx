import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useConfirmableSubmit } from "../../../hooks/useConfirmableSubmit";
import { TimeSettingsInline } from "./TimeSettingsInline";
import type { ScheduleItem } from "../../../types/schedule";

interface EventTabProps {
  date: Date;
  defaultStartTime: string;
  defaultEndTime: string;
  useExisting: boolean;
  recentEvents?: ScheduleItem[];
  onCreateEvent: (
    title: string,
    startTime: string,
    endTime: string,
    memo: string,
  ) => void;
  onDuplicateEvent?: (event: ScheduleItem) => void;
  onClose: () => void;
}

export function EventTab({
  date,
  defaultStartTime,
  defaultEndTime,
  useExisting,
  recentEvents,
  onCreateEvent,
  onDuplicateEvent,
  onClose,
}: EventTabProps) {
  if (useExisting) {
    return (
      <ExistingEventContent
        recentEvents={recentEvents}
        defaultStartTime={defaultStartTime}
        defaultEndTime={defaultEndTime}
        onDuplicate={onDuplicateEvent}
      />
    );
  }

  return (
    <NewEventContent
      date={date}
      defaultStartTime={defaultStartTime}
      defaultEndTime={defaultEndTime}
      onCreateEvent={onCreateEvent}
      onClose={onClose}
    />
  );
}

function NewEventContent({
  defaultStartTime,
  defaultEndTime,
  onCreateEvent,
  onClose,
}: {
  date: Date;
  defaultStartTime: string;
  defaultEndTime: string;
  onCreateEvent: (
    title: string,
    startTime: string,
    endTime: string,
    memo: string,
  ) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [isAllDay, setIsAllDay] = useState(false);
  const [hasEndTime, setHasEndTime] = useState(true);
  const [memo, setMemo] = useState("");

  const handleSubmit = () => {
    const st = isAllDay ? "00:00" : startTime;
    const et = isAllDay ? "23:59" : hasEndTime ? endTime : startTime;
    onCreateEvent(title.trim() || "Untitled", st, et, memo);
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
        placeholder={t("schedule.eventTitlePlaceholder", "Event name")}
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

      <div className="mt-2">
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={t("eventDetail.memoPlaceholder", "Add a quick memo...")}
          className="w-full px-2 py-1.5 text-xs bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary"
        />
      </div>

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

function ExistingEventContent({
  recentEvents,
  onDuplicate,
}: {
  recentEvents?: ScheduleItem[];
  defaultStartTime: string;
  defaultEndTime: string;
  onDuplicate?: (event: ScheduleItem) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const events = (recentEvents ?? []).filter(
    (e) =>
      (!e.routineId && !search) ||
      e.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("schedule.searchEvents", "Search events...")}
        className="w-full px-2 py-1.5 text-xs bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary"
        autoFocus
      />
      <div className="mt-2 max-h-52 overflow-y-auto space-y-0.5">
        {events.length === 0 && (
          <p className="text-[11px] text-notion-text-secondary text-center py-3">
            {t("schedule.noEvents", "No events found")}
          </p>
        )}
        {events.map((event) => (
          <button
            key={event.id}
            onClick={() => onDuplicate?.(event)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-notion-hover text-notion-text transition-colors"
          >
            <span className="flex-1 truncate">{event.title}</span>
            <span className="text-[11px] text-notion-text-secondary shrink-0">
              {event.startTime} - {event.endTime}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
