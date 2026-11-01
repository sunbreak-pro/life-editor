import { dateKeyOfInstant } from "@life-editor/shared";
import type { TFunction } from "i18next";
import type { ItemLinkPreview } from "../notes/useItemLinkPreview";
import { formatLongDate, formatShortDate } from "../schedule/scheduleCopy";

/*
 * The line under a link panel's title, by the kind of its target (#2392, Claude
 * Design B3). Separate from the read, so what a kind says can be checked without
 * a DataService.
 */

/** "10/31", or the whole date when the day is in another year. */
function formatDay(language: string, dateKey: string): string {
  return dateKey.slice(0, 4) === String(new Date().getFullYear())
    ? formatShortDate(language, dateKey)
    : formatLongDate(language, dateKey);
}

function formatClock(language: string, instant: string): string {
  return new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}

/** A day with its time span, or with 「終日」. Same en dash as the todo detail. */
function formatSpan(
  language: string,
  allDayLabel: string,
  slot: {
    date: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
  },
): string {
  const day = formatDay(language, slot.date);
  return slot.isAllDay
    ? `${day} ${allDayLabel}`
    : `${day} ${slot.startTime} – ${slot.endTime}`;
}

export function describeLinkPreview(
  preview: ItemLinkPreview,
  t: TFunction,
  language: string,
): string | undefined {
  const allDay = t("scheduleScreen.allDay");
  switch (preview.kind) {
    case "note": {
      const day = dateKeyOfInstant(preview.updatedAt);
      if (!day) return undefined;
      const when = `${formatDay(language, day)} ${formatClock(language, preview.updatedAt)}`;
      return t("materials.links.noteUpdated", { when });
    }
    case "daily": {
      const date = formatDay(language, preview.date);
      return preview.mood === null
        ? date
        : t("materials.links.dailyMood", { date, mood: preview.mood });
    }
    case "task": {
      const status = preview.done
        ? t("materials.links.todoDone")
        : t("materials.links.todoNotStarted");
      if (!preview.slot) return status;
      return t("materials.links.todoWhen", {
        status,
        when: formatSpan(language, allDay, preview.slot),
      });
    }
    case "event":
      return formatSpan(language, allDay, preview);
  }
}
