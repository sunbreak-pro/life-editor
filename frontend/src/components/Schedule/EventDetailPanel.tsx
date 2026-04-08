import { useState, useCallback } from "react";
import { Trash2, Clock, CalendarDays, StickyNote } from "lucide-react";
import { RoundedCheckbox } from "../shared/RoundedCheckbox";
import { useTranslation } from "react-i18next";
import { useScheduleItemsContext } from "../../hooks/useScheduleItemsContext";
import { TimeInput } from "../shared/TimeInput";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import {
  formatTime,
  clampEndTimeAfterStart,
  adjustEndTimeForStartChange,
} from "../../utils/timeGridUtils";
import { RoleSwitcher } from "../Tasks/Schedule/shared/RoleSwitcher";
import {
  useRoleConversion,
  type ConversionSource,
  type ConversionRole,
} from "../../hooks/useRoleConversion";

interface EventDetailPanelProps {
  selectedEventId: string | null;
}

export function EventDetailPanel({ selectedEventId }: EventDetailPanelProps) {
  const { t } = useTranslation();
  const {
    events,
    updateScheduleItem,
    deleteScheduleItem,
    bumpEventsVersion,
    toggleComplete,
  } = useScheduleItemsContext();

  const event = selectedEventId
    ? events.find((e) => e.id === selectedEventId)
    : null;

  if (!event) {
    return (
      <div className="h-full flex items-center justify-center text-notion-text-secondary text-sm">
        {t("events.emptyState", "Select an event to view details")}
      </div>
    );
  }

  return (
    <EventDetailContent
      key={event.id}
      event={event}
      onUpdate={(updates) => {
        updateScheduleItem(event.id, updates);
        bumpEventsVersion();
      }}
      onToggleComplete={() => toggleComplete(event.id)}
      onDelete={() => {
        deleteScheduleItem(event.id);
        bumpEventsVersion();
      }}
    />
  );
}

function EventDetailContent({
  event,
  onUpdate,
  onToggleComplete,
  onDelete,
}: {
  event: NonNullable<
    ReturnType<typeof useScheduleItemsContext>["events"][number]
  >;
  onUpdate: (updates: Record<string, unknown>) => void;
  onToggleComplete: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(event.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editStartTime, setEditStartTime] = useState(event.startTime);
  const [editEndTime, setEditEndTime] = useState(event.endTime);

  const commitTitle = useCallback(() => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== event.title) {
      onUpdate({ title: trimmed });
    }
    setIsEditingTitle(false);
  }, [titleValue, event.title, onUpdate]);

  const handleStartTimeChange = (h: number, m: number) => {
    const newStart = formatTime(h, m);
    const adjusted = adjustEndTimeForStartChange(
      editStartTime,
      newStart,
      editEndTime,
    );
    setEditStartTime(newStart);
    setEditEndTime(adjusted);
    onUpdate({ startTime: newStart, endTime: adjusted });
  };

  const handleEndTimeChange = (h: number, m: number) => {
    const newEnd = formatTime(h, m);
    const clamped = clampEndTimeAfterStart(editStartTime, newEnd);
    setEditEndTime(clamped);
    onUpdate({ endTime: clamped });
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Title + Completion */}
        <div className="flex items-center gap-2">
          <RoundedCheckbox
            checked={event.completed}
            onChange={() => onToggleComplete()}
            size={18}
          />
          {isEditingTitle ? (
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitleValue(event.title);
                  setIsEditingTitle(false);
                }
              }}
              className="text-lg font-bold text-notion-text w-full bg-transparent border-b-2 border-notion-accent outline-none"
            />
          ) : (
            <h2
              className={`text-lg font-bold cursor-text hover:bg-notion-hover/50 rounded px-1 -mx-1 flex-1 min-w-0 ${
                event.completed
                  ? "text-notion-text-secondary line-through opacity-60"
                  : "text-notion-text"
              }`}
              onDoubleClick={() => {
                setTitleValue(event.title);
                setIsEditingTitle(true);
              }}
            >
              {event.title}
            </h2>
          )}
        </div>

        {/* Role Switcher */}
        <EventRoleSwitcherInline event={event} />

        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-notion-text-secondary">
          <CalendarDays size={14} />
          <span>{event.date}</span>
          {event.isAllDay && (
            <span className="text-xs bg-notion-bg-secondary px-1.5 py-0.5 rounded">
              {t("calendar.allDay", "All day")}
            </span>
          )}
        </div>

        {/* Time */}
        {!event.isAllDay && (
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-notion-text-secondary shrink-0" />
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
        )}

        {/* Memo */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-notion-border">
          <StickyNote
            size={12}
            className="text-notion-text-secondary shrink-0"
          />
          <input
            type="text"
            defaultValue={event.memo ?? ""}
            onBlur={(e) => {
              const val = e.target.value;
              if (val !== (event.memo ?? "")) {
                onUpdate({ memo: val || null });
              }
            }}
            placeholder={t(
              "eventDetail.memoPlaceholder",
              "Add a quick memo...",
            )}
            className="text-xs bg-transparent outline-none text-notion-text placeholder:text-notion-text-secondary/50 w-full"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Delete */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors"
        >
          <Trash2 size={12} />
          {t("eventDetail.delete", "Delete event")}
        </button>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title={t("eventDetail.deleteTitle", "Delete Event")}
          message={t(
            "eventDetail.deleteMessage",
            "Are you sure you want to delete this event?",
          )}
          onConfirm={onDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function EventRoleSwitcherInline({
  event,
}: {
  event: { id: string; date: string; routineId: string | null };
}) {
  const { convert, canConvert } = useRoleConversion();
  if (event.routineId) return null;

  const { events } = useScheduleItemsContext();
  const fullEvent = events.find((e) => e.id === event.id);
  if (!fullEvent) return null;

  const source: ConversionSource = {
    role: "event",
    scheduleItem: fullEvent,
    date: fullEvent.date,
  };
  const roles: ConversionRole[] = ["task", "event", "note", "daily"];
  const disabledRoles = roles.filter((r) => !canConvert(source, r));

  return (
    <RoleSwitcher
      currentRole="event"
      disabledRoles={disabledRoles}
      onSelectRole={(targetRole) => convert(source, targetRole)}
    />
  );
}
