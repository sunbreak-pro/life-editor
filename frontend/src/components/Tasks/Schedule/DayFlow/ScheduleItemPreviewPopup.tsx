import {
  ExternalLink,
  Trash2,
  Pencil,
  Clock,
  StickyNote,
  CalendarDays,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScheduleItem } from "../../../../types/schedule";
import { CALENDAR_ITEM_COLORS } from "../../../../types/calendarItem";
import { TimeDropdown } from "../../../shared/TimeDropdown";
import { DateInput } from "../../../shared/DateInput";
import { ToggleSwitch } from "../../../shared/ToggleSwitch";
import { RoundedCheckbox } from "../../../shared/RoundedCheckbox";
import { RoleSwitcher } from "../shared/RoleSwitcher";
import { BasePreviewPopup } from "../shared/BasePreviewPopup";
import { usePreviewTimeEdit } from "../shared/usePreviewTimeEdit";
import type { ConversionRole } from "../../../../hooks/useRoleConversion";
import { ReminderToggle } from "../../../shared/ReminderToggle";

interface ScheduleItemPreviewPopupProps {
  item: ScheduleItem;
  position: { x: number; y: number };
  onToggleComplete: () => void;
  onUpdateTime?: (startTime: string, endTime: string) => void;
  onEditRoutine?: () => void;
  onDelete: () => void;
  onUpdateMemo?: (id: string, memo: string | null) => void;
  onClose: () => void;
  onConvertRole?: (targetRole: ConversionRole) => void;
  disabledRoles?: ConversionRole[];
  onUpdateDate?: (date: string) => void;
  onUpdateAllDay?: (isAllDay: boolean) => void;
  onUpdateTitle?: (title: string) => void;
  onReminderChange?: (enabled: boolean, offset?: number) => void;
  onOpenDetail?: () => void;
}

export function ScheduleItemPreviewPopup({
  item,
  position,
  onToggleComplete,
  onUpdateTime,
  onEditRoutine,
  onDelete,
  onUpdateMemo,
  onClose,
  onConvertRole,
  disabledRoles,
  onUpdateDate,
  onUpdateAllDay,
  onUpdateTitle,
  onReminderChange,
  onOpenDetail,
}: ScheduleItemPreviewPopupProps) {
  const { t } = useTranslation();

  const {
    editStartTime,
    editEndTime,
    handleStartTimeChange,
    handleEndTimeChange,
    isEditingTitle,
    titleDraft,
    setTitleDraft,
    commitTitle,
    startEditingTitle,
    cancelEditingTitle,
  } = usePreviewTimeEdit({
    startTime: item.startTime,
    endTime: item.endTime,
    title: item.title,
    onTimeChange: onUpdateTime,
    onTitleChange: onUpdateTitle,
  });

  const dateParts = item.date.split("-").map(Number);
  const dateYear = dateParts[0];
  const dateMonth = dateParts[1];
  const dateDay = dateParts[2];

  return (
    <BasePreviewPopup
      position={position}
      barColor={
        item.routineId
          ? CALENDAR_ITEM_COLORS.routine
          : CALENDAR_ITEM_COLORS.event
      }
      onClose={onClose}
      disableClickOutside={isEditingTitle}
      bottomClearance={320}
      footer={
        <>
          {onOpenDetail && (
            <>
              <button
                onClick={onOpenDetail}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-blue-500 hover:bg-blue-500/5 transition-colors"
              >
                <ExternalLink size={12} />
                {t("calendar.openDetail")}
              </button>
              <div className="w-px bg-notion-border" />
            </>
          )}
          {item.routineId && onEditRoutine && (
            <>
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
              <div className="w-px bg-notion-border" />
            </>
          )}
          <button
            onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-500 hover:bg-red-500/5 transition-colors"
          >
            <Trash2 size={12} />
            {t("common.delete")}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <RoundedCheckbox
          checked={item.completed}
          onChange={() => onToggleComplete()}
          size={14}
        />
        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  cancelEditingTitle();
                }
              }}
              className="font-medium text-sm text-notion-text w-full bg-transparent border-b border-notion-accent outline-none"
            />
          ) : (
            <div
              className={`font-medium text-sm text-notion-text truncate ${onUpdateTitle ? "cursor-text hover:bg-notion-hover/50 rounded px-0.5 -mx-0.5" : ""}`}
              onClick={() => {
                if (onUpdateTitle) {
                  startEditingTitle();
                }
              }}
            >
              {item.title}
            </div>
          )}
        </div>
      </div>

      {/* Date + All-day */}
      {(onUpdateDate || onUpdateAllDay) && (
        <div className="flex items-center gap-1.5">
          <CalendarDays
            size={10}
            className="text-notion-text-secondary shrink-0"
          />
          {onUpdateDate ? (
            <DateInput
              year={dateYear}
              month={dateMonth}
              day={dateDay}
              onChange={(y, m, d) => {
                const newDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                if (newDate !== item.date) {
                  onUpdateDate(newDate);
                  onClose();
                }
              }}
              size="sm"
            />
          ) : (
            <span className="text-xs text-notion-text-secondary">
              {dateMonth}/{dateDay}
            </span>
          )}
          {onUpdateAllDay && (
            <div className="flex items-center gap-1 ml-auto">
              <ToggleSwitch
                checked={!!item.isAllDay}
                onChange={(v) => onUpdateAllDay(v)}
                size="sm"
              />
              <span className="text-[10px] text-notion-text-secondary">
                {t("calendar.allDay", "All day")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Time (hidden when all-day) */}
      {!item.isAllDay && onUpdateTime && (
        <div className="flex items-center gap-1.5">
          <Clock size={10} className="text-notion-text-secondary shrink-0" />
          <TimeDropdown
            hour={parseInt(editStartTime.split(":")[0], 10)}
            minute={parseInt(editStartTime.split(":")[1], 10)}
            onChange={handleStartTimeChange}
            minuteStep={5}
            size="sm"
          />
          <span className="text-xs text-notion-text-secondary">-</span>
          <TimeDropdown
            hour={parseInt(editEndTime.split(":")[0], 10)}
            minute={parseInt(editEndTime.split(":")[1], 10)}
            onChange={handleEndTimeChange}
            minuteStep={5}
            size="sm"
          />
        </div>
      )}
      {!item.isAllDay && !onUpdateTime && (
        <div className="text-xs text-notion-text-secondary flex items-center gap-1">
          <Clock size={10} />
          {item.startTime} - {item.endTime}
        </div>
      )}

      {/* Memo */}
      {onUpdateMemo && (
        <div className="flex items-center gap-1 px-1 py-0.5 rounded border border-notion-border/50">
          <StickyNote
            size={10}
            className="text-notion-text-secondary shrink-0"
          />
          <input
            type="text"
            defaultValue={item.memo ?? ""}
            onBlur={(e) => {
              const val = e.target.value;
              if (val !== (item.memo ?? "")) {
                onUpdateMemo(item.id, val || null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            placeholder="memo..."
            className="flex-1 text-xs bg-transparent outline-none text-notion-text placeholder:text-notion-text-secondary/50"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {onReminderChange && (
        <ReminderToggle
          enabled={!!item.reminderEnabled}
          offset={item.reminderOffset ?? 30}
          onEnabledChange={(enabled) =>
            onReminderChange(enabled, item.reminderOffset)
          }
          onOffsetChange={(offset) =>
            onReminderChange(!!item.reminderEnabled, offset)
          }
          compact
        />
      )}

      <div className="flex items-center gap-2">
        {onConvertRole && !item.routineId ? (
          <RoleSwitcher
            currentRole="event"
            disabledRoles={disabledRoles}
            onSelectRole={onConvertRole}
          />
        ) : (
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
        )}
      </div>
    </BasePreviewPopup>
  );
}
