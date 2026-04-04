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
import {
  wrapTextAsTipTap,
  mergeContentWithMemo,
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

export interface ConversionResult {
  success: boolean;
  targetId?: string;
  targetRole?: ConversionRole;
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
  convert: (
    source: ConversionSource,
    targetRole: ConversionRole,
  ) => ConversionResult;
  canConvert: (source: ConversionSource, targetRole: ConversionRole) => boolean;
}

interface UseRoleConversionOptions {
  onNavigate?: (role: ConversionRole, id: string) => void;
}

export function useRoleConversion(
  options?: UseRoleConversionOptions,
): UseRoleConversionReturn {
  const { t } = useTranslation();
  const { addNode, softDelete } = useTaskTreeContext();
  const {
    createScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    bumpEventsVersion,
  } = useScheduleContext();
  const { memos, upsertMemo, deleteMemo } = useMemoContext();
  const { createNote, updateNote, softDeleteNote } = useNoteContext();
  const { showToast } = useToast();
  const onNavigate = options?.onNavigate;

  const hasDailyForDate = useCallback(
    (date: string): boolean => {
      return memos.some((m) => m.date === date && !m.isDeleted);
    },
    [memos],
  );

  const canConvert = useCallback(
    (source: ConversionSource, targetRole: ConversionRole): boolean => {
      if (source.role === targetRole) return false;
      if (source.role === "event" && source.scheduleItem?.routineId)
        return false;
      if (targetRole === "daily") return !hasDailyForDate(source.date);
      return true;
    },
    [hasDailyForDate],
  );

  const showSuccessToast = useCallback(
    (targetRole: ConversionRole, targetId: string) => {
      const roleLabel = t(
        `calendar.role${targetRole.charAt(0).toUpperCase() + targetRole.slice(1)}`,
      );
      const message = t("calendar.conversionSuccess", { role: roleLabel });
      if (onNavigate) {
        showToast("success", message, {
          actionLabel: t("calendar.goToTarget", { role: roleLabel }),
          onAction: () => onNavigate(targetRole, targetId),
        });
      } else {
        showToast("success", message);
      }
    },
    [t, showToast, onNavigate],
  );

  const convert = useCallback(
    (
      source: ConversionSource,
      targetRole: ConversionRole,
    ): ConversionResult => {
      if (!canConvert(source, targetRole)) {
        if (targetRole === "daily" && hasDailyForDate(source.date)) {
          showToast("error", t("calendar.dailyExists"));
        }
        return { success: false };
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
            task.content ?? undefined,
          );
          if (task.timeMemo) updateScheduleItem(id, { memo: task.timeMemo });
          softDelete(task.id);
          bumpEventsVersion();
          showSuccessToast("event", id);
          return { success: true, targetId: id, targetRole: "event" };
        }

        if (targetRole === "note") {
          const noteId = createNote(task.title);
          const merged = mergeContentWithMemo(task.content, task.timeMemo);
          if (merged) updateNote(noteId, { content: merged });
          softDelete(task.id);
          showSuccessToast("note", noteId);
          return { success: true, targetId: noteId, targetRole: "note" };
        }

        if (targetRole === "daily") {
          const merged = mergeContentWithMemo(task.content, task.timeMemo);
          upsertMemo(date, merged || "");
          softDelete(task.id);
          showSuccessToast("daily", date);
          return { success: true, targetId: date, targetRole: "daily" };
        }
      }

      // --- Event → ... ---
      if (source.role === "event" && source.scheduleItem) {
        const item = source.scheduleItem;
        const date = item.date;

        if (targetRole === "task") {
          const scheduledAt = buildISOFromDateAndTime(date, item.startTime);
          const scheduledEndAt = buildISOFromDateAndTime(date, item.endTime);
          const taskNode = addNode("task", null, item.title, {
            scheduledAt,
            scheduledEndAt,
            isAllDay: item.isAllDay,
          });
          if (item.content && taskNode) {
            // content is carried via addNode options or separate update
          }
          deleteScheduleItem(item.id);
          bumpEventsVersion();
          const taskId = taskNode?.id ?? "";
          showSuccessToast("task", taskId);
          return { success: true, targetId: taskId, targetRole: "task" };
        }

        if (targetRole === "note") {
          const noteId = createNote(item.title);
          const content =
            item.content || (item.memo ? wrapTextAsTipTap(item.memo) : null);
          if (content) updateNote(noteId, { content });
          deleteScheduleItem(item.id);
          bumpEventsVersion();
          showSuccessToast("note", noteId);
          return { success: true, targetId: noteId, targetRole: "note" };
        }

        if (targetRole === "daily") {
          const content =
            item.content || (item.memo ? wrapTextAsTipTap(item.memo) : "");
          upsertMemo(date, content);
          deleteScheduleItem(item.id);
          bumpEventsVersion();
          showSuccessToast("daily", date);
          return { success: true, targetId: date, targetRole: "daily" };
        }
      }

      // --- Note → ... ---
      if (source.role === "note" && source.note) {
        const note = source.note;
        const date = source.date;

        if (targetRole === "task") {
          const scheduledAt = buildISOFromDateAndTime(date, "09:00");
          const taskNode = addNode("task", null, note.title, {
            scheduledAt,
            isAllDay: true,
          });
          softDeleteNote(note.id);
          const taskId = taskNode?.id ?? "";
          showSuccessToast("task", taskId);
          return { success: true, targetId: taskId, targetRole: "task" };
        }

        if (targetRole === "event") {
          const id = createScheduleItem(
            date,
            note.title,
            "09:00",
            "10:00",
            undefined,
            undefined,
            undefined,
            undefined,
            note.content ?? undefined,
          );
          softDeleteNote(note.id);
          bumpEventsVersion();
          showSuccessToast("event", id);
          return { success: true, targetId: id, targetRole: "event" };
        }

        if (targetRole === "daily") {
          upsertMemo(date, note.content || "");
          softDeleteNote(note.id);
          showSuccessToast("daily", date);
          return { success: true, targetId: date, targetRole: "daily" };
        }
      }

      // --- Daily → ... ---
      if (source.role === "daily" && source.memo) {
        const memo = source.memo;
        const date = memo.date;

        if (targetRole === "task") {
          const scheduledAt = buildISOFromDateAndTime(date, "09:00");
          const taskNode = addNode("task", null, memo.date, {
            scheduledAt,
            isAllDay: true,
          });
          deleteMemo(memo.date);
          const taskId = taskNode?.id ?? "";
          showSuccessToast("task", taskId);
          return { success: true, targetId: taskId, targetRole: "task" };
        }

        if (targetRole === "event") {
          const id = createScheduleItem(
            date,
            memo.date,
            "09:00",
            "10:00",
            undefined,
            undefined,
            undefined,
            undefined,
            memo.content ?? undefined,
          );
          deleteMemo(memo.date);
          bumpEventsVersion();
          showSuccessToast("event", id);
          return { success: true, targetId: id, targetRole: "event" };
        }

        if (targetRole === "note") {
          const noteId = createNote(memo.date);
          if (memo.content) updateNote(noteId, { content: memo.content });
          deleteMemo(memo.date);
          showSuccessToast("note", noteId);
          return { success: true, targetId: noteId, targetRole: "note" };
        }
      }

      return { success: false };
    },
    [
      canConvert,
      hasDailyForDate,
      showToast,
      showSuccessToast,
      t,
      addNode,
      softDelete,
      createScheduleItem,
      updateScheduleItem,
      deleteScheduleItem,
      bumpEventsVersion,
      upsertMemo,
      deleteMemo,
      createNote,
      updateNote,
      softDeleteNote,
    ],
  );

  return { convert, canConvert };
}
