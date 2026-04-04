import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../types/taskTree";
import type { ScheduleItem } from "../types/schedule";
import type { NoteNode } from "../types/note";
import type { MemoNode } from "../types/memo";
import { useTaskTreeContext } from "./useTaskTreeContext";
import { useScheduleContext } from "./useScheduleContext";
import { useMemoContext } from "./useMemoContext";
import { useNoteContext } from "./useNoteContext";
import { useToast } from "../context/ToastContext";
import { formatDateKey } from "../utils/dateKey";
import {
  wrapTextAsTipTap,
  mergeContentWithMemo,
  extractPlainText,
} from "../utils/roleConversionContent";

export type ConversionRole = "task" | "event" | "note" | "daily";

export interface ConversionSource {
  role: ConversionRole;
  task?: TaskNode;
  scheduleItem?: ScheduleItem;
  note?: NoteNode;
  memo?: MemoNode;
  date: string; // YYYY-MM-DD
}

function buildISOFromDateAndTime(date: string, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function extractTimeFromISO(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export interface UseRoleConversionReturn {
  convert: (source: ConversionSource, targetRole: ConversionRole) => boolean;
  canConvert: (source: ConversionSource, targetRole: ConversionRole) => boolean;
}

export function useRoleConversion(): UseRoleConversionReturn {
  const { t } = useTranslation();
  const { addNode, softDelete } = useTaskTreeContext();
  const { createScheduleItem, updateScheduleItem, deleteScheduleItem } =
    useScheduleContext();
  const { memos, upsertMemo, deleteMemo } = useMemoContext();
  const { createNote, updateNote, softDeleteNote } = useNoteContext();
  const { showToast } = useToast();

  const hasDailyForDate = useCallback(
    (date: string): boolean => {
      return memos.some((m) => m.date === date && !m.isDeleted);
    },
    [memos],
  );

  const canConvert = useCallback(
    (source: ConversionSource, targetRole: ConversionRole): boolean => {
      if (source.role === targetRole) return false;

      // Routine schedule items cannot be converted
      if (source.role === "event" && source.scheduleItem?.routineId) {
        return false;
      }

      // Daily existence check
      if (targetRole === "daily") {
        return !hasDailyForDate(source.date);
      }

      return true;
    },
    [hasDailyForDate],
  );

  const convert = useCallback(
    (source: ConversionSource, targetRole: ConversionRole): boolean => {
      if (!canConvert(source, targetRole)) {
        if (targetRole === "daily" && hasDailyForDate(source.date)) {
          showToast("error", t("calendar.dailyExists"));
        }
        return false;
      }

      // --- Task → ... ---
      if (source.role === "task" && source.task) {
        const task = source.task;
        const date = source.date;

        if (targetRole === "event") {
          const startTime =
            task.scheduledAt && !task.isAllDay
              ? extractTimeFromISO(task.scheduledAt)
              : "09:00";
          const endTime =
            task.scheduledEndAt && !task.isAllDay
              ? extractTimeFromISO(task.scheduledEndAt)
              : "10:00";
          const id = createScheduleItem(
            date,
            task.title,
            startTime,
            endTime,
            undefined,
            undefined,
            undefined,
            task.isAllDay,
          );
          if (task.content) {
            const text = extractPlainText(task.content);
            if (text) updateScheduleItem(id, { memo: text });
          }
          softDelete(task.id);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleEvent") }),
          );
          return true;
        }

        if (targetRole === "note") {
          const noteId = createNote(task.title);
          const merged = mergeContentWithMemo(task.content, task.timeMemo);
          if (merged) updateNote(noteId, { content: merged });
          softDelete(task.id);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleNote") }),
          );
          return true;
        }

        if (targetRole === "daily") {
          const merged = mergeContentWithMemo(task.content, task.timeMemo);
          upsertMemo(date, merged || "");
          softDelete(task.id);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleDaily") }),
          );
          return true;
        }
      }

      // --- Event → ... ---
      if (source.role === "event" && source.scheduleItem) {
        const item = source.scheduleItem;
        const date = item.date;

        if (targetRole === "task") {
          const scheduledAt = buildISOFromDateAndTime(date, item.startTime);
          const scheduledEndAt = buildISOFromDateAndTime(date, item.endTime);
          addNode("task", null, item.title, {
            scheduledAt,
            scheduledEndAt,
            isAllDay: item.isAllDay,
          });
          deleteScheduleItem(item.id);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleTask") }),
          );
          return true;
        }

        if (targetRole === "note") {
          const noteId = createNote(item.title);
          if (item.memo) {
            updateNote(noteId, { content: wrapTextAsTipTap(item.memo) });
          }
          deleteScheduleItem(item.id);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleNote") }),
          );
          return true;
        }

        if (targetRole === "daily") {
          upsertMemo(date, item.memo ? wrapTextAsTipTap(item.memo) : "");
          deleteScheduleItem(item.id);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleDaily") }),
          );
          return true;
        }
      }

      // --- Note → ... ---
      if (source.role === "note" && source.note) {
        const note = source.note;
        const date = source.date;

        if (targetRole === "task") {
          const scheduledAt = buildISOFromDateAndTime(date, "09:00");
          addNode("task", null, note.title, {
            scheduledAt,
            isAllDay: true,
          });
          softDeleteNote(note.id);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleTask") }),
          );
          return true;
        }

        if (targetRole === "event") {
          createScheduleItem(date, note.title, "09:00", "10:00");
          softDeleteNote(note.id);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleEvent") }),
          );
          return true;
        }

        if (targetRole === "daily") {
          upsertMemo(date, note.content || "");
          softDeleteNote(note.id);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleDaily") }),
          );
          return true;
        }
      }

      // --- Daily → ... ---
      if (source.role === "daily" && source.memo) {
        const memo = source.memo;
        const date = memo.date;

        if (targetRole === "task") {
          const scheduledAt = buildISOFromDateAndTime(date, "09:00");
          addNode("task", null, memo.date, {
            scheduledAt,
            isAllDay: true,
          });
          deleteMemo(memo.date);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleTask") }),
          );
          return true;
        }

        if (targetRole === "event") {
          createScheduleItem(date, memo.date, "09:00", "10:00");
          deleteMemo(memo.date);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleEvent") }),
          );
          return true;
        }

        if (targetRole === "note") {
          const noteId = createNote(memo.date);
          if (memo.content) {
            updateNote(noteId, { content: memo.content });
          }
          deleteMemo(memo.date);
          showToast(
            "success",
            t("calendar.conversionSuccess", { role: t("calendar.roleNote") }),
          );
          return true;
        }
      }

      return false;
    },
    [
      canConvert,
      hasDailyForDate,
      showToast,
      t,
      addNode,
      softDelete,
      createScheduleItem,
      updateScheduleItem,
      deleteScheduleItem,
      memos,
      upsertMemo,
      deleteMemo,
      createNote,
      updateNote,
      softDeleteNote,
    ],
  );

  return { convert, canConvert };
}
