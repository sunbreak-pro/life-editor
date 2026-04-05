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
import { useUndoRedo } from "../components/shared/UndoRedo";
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

const SKIP = { skipUndo: true } as const;

export function useRoleConversion(
  options?: UseRoleConversionOptions,
): UseRoleConversionReturn {
  const { t } = useTranslation();
  const { addNode, softDelete, restoreNode } = useTaskTreeContext();
  const {
    createScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    bumpEventsVersion,
  } = useScheduleContext();
  const { memos, upsertMemo, deleteMemo } = useMemoContext();
  const { createNote, updateNote, softDeleteNote } = useNoteContext();
  const { showToast } = useToast();
  const { push } = useUndoRedo();
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

      // --- Task → Event ---
      if (source.role === "task" && source.task && targetRole === "event") {
        const task = source.task;
        const date = source.date;
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
          SKIP,
        );
        if (task.timeMemo) updateScheduleItem(id, { memo: task.timeMemo });
        softDelete(task.id, SKIP);
        bumpEventsVersion();

        push("scheduleItem", {
          label: "convertTaskToEvent",
          undo: () => {
            deleteScheduleItem(id, SKIP);
            restoreNode(task.id, SKIP);
            bumpEventsVersion();
          },
          redo: () => {
            createScheduleItem(
              date,
              task.title,
              startTime,
              endTime,
              undefined,
              undefined,
              undefined,
              task.isAllDay,
              task.content ?? undefined,
              SKIP,
            );
            if (task.timeMemo) updateScheduleItem(id, { memo: task.timeMemo });
            softDelete(task.id, SKIP);
            bumpEventsVersion();
          },
        });

        showSuccessToast("event", id);
        return { success: true, targetId: id, targetRole: "event" };
      }

      // --- Task → Note ---
      if (source.role === "task" && source.task && targetRole === "note") {
        const task = source.task;
        const noteId = createNote(task.title, SKIP);
        const merged = mergeContentWithMemo(task.content, task.timeMemo);
        if (merged) updateNote(noteId, { content: merged });
        softDelete(task.id, SKIP);

        push("scheduleItem", {
          label: "convertTaskToNote",
          undo: () => {
            softDeleteNote(noteId, SKIP);
            restoreNode(task.id, SKIP);
          },
          redo: () => {
            createNote(task.title, SKIP);
            if (merged) updateNote(noteId, { content: merged });
            softDelete(task.id, SKIP);
          },
        });

        showSuccessToast("note", noteId);
        return { success: true, targetId: noteId, targetRole: "note" };
      }

      // --- Task → Daily ---
      if (source.role === "task" && source.task && targetRole === "daily") {
        const task = source.task;
        const date = source.date;
        const merged = mergeContentWithMemo(task.content, task.timeMemo);
        upsertMemo(date, merged || "", SKIP);
        softDelete(task.id, SKIP);

        push("scheduleItem", {
          label: "convertTaskToDaily",
          undo: () => {
            deleteMemo(date, SKIP);
            restoreNode(task.id, SKIP);
          },
          redo: () => {
            upsertMemo(date, merged || "", SKIP);
            softDelete(task.id, SKIP);
          },
        });

        showSuccessToast("daily", date);
        return { success: true, targetId: date, targetRole: "daily" };
      }

      // --- Event → Task ---
      if (
        source.role === "event" &&
        source.scheduleItem &&
        targetRole === "task"
      ) {
        const item = source.scheduleItem;
        const date = item.date;
        const scheduledAt = buildISOFromDateAndTime(date, item.startTime);
        const scheduledEndAt = buildISOFromDateAndTime(date, item.endTime);
        const taskNode = addNode("task", null, item.title, {
          scheduledAt,
          scheduledEndAt,
          isAllDay: item.isAllDay,
          skipUndo: true,
        });
        deleteScheduleItem(item.id, SKIP);
        bumpEventsVersion();
        const taskId = taskNode?.id ?? "";

        push("scheduleItem", {
          label: "convertEventToTask",
          undo: () => {
            if (taskId) softDelete(taskId, SKIP);
            createScheduleItem(
              date,
              item.title,
              item.startTime,
              item.endTime,
              item.routineId ?? undefined,
              item.templateId ?? undefined,
              item.noteId ?? undefined,
              item.isAllDay,
              item.content ?? undefined,
              SKIP,
            );
            bumpEventsVersion();
          },
          redo: () => {
            if (taskId) restoreNode(taskId, SKIP);
            deleteScheduleItem(item.id, SKIP);
            bumpEventsVersion();
          },
        });

        showSuccessToast("task", taskId);
        return { success: true, targetId: taskId, targetRole: "task" };
      }

      // --- Event → Note ---
      if (
        source.role === "event" &&
        source.scheduleItem &&
        targetRole === "note"
      ) {
        const item = source.scheduleItem;
        const noteId = createNote(item.title, SKIP);
        const content =
          item.content || (item.memo ? wrapTextAsTipTap(item.memo) : null);
        if (content) updateNote(noteId, { content });
        deleteScheduleItem(item.id, SKIP);
        bumpEventsVersion();

        push("scheduleItem", {
          label: "convertEventToNote",
          undo: () => {
            softDeleteNote(noteId, SKIP);
            createScheduleItem(
              item.date,
              item.title,
              item.startTime,
              item.endTime,
              item.routineId ?? undefined,
              item.templateId ?? undefined,
              item.noteId ?? undefined,
              item.isAllDay,
              item.content ?? undefined,
              SKIP,
            );
            bumpEventsVersion();
          },
          redo: () => {
            createNote(item.title, SKIP);
            if (content) updateNote(noteId, { content });
            deleteScheduleItem(item.id, SKIP);
            bumpEventsVersion();
          },
        });

        showSuccessToast("note", noteId);
        return { success: true, targetId: noteId, targetRole: "note" };
      }

      // --- Event → Daily ---
      if (
        source.role === "event" &&
        source.scheduleItem &&
        targetRole === "daily"
      ) {
        const item = source.scheduleItem;
        const date = item.date;
        const content =
          item.content || (item.memo ? wrapTextAsTipTap(item.memo) : "");
        upsertMemo(date, content, SKIP);
        deleteScheduleItem(item.id, SKIP);
        bumpEventsVersion();

        push("scheduleItem", {
          label: "convertEventToDaily",
          undo: () => {
            deleteMemo(date, SKIP);
            createScheduleItem(
              date,
              item.title,
              item.startTime,
              item.endTime,
              item.routineId ?? undefined,
              item.templateId ?? undefined,
              item.noteId ?? undefined,
              item.isAllDay,
              item.content ?? undefined,
              SKIP,
            );
            bumpEventsVersion();
          },
          redo: () => {
            upsertMemo(date, content, SKIP);
            deleteScheduleItem(item.id, SKIP);
            bumpEventsVersion();
          },
        });

        showSuccessToast("daily", date);
        return { success: true, targetId: date, targetRole: "daily" };
      }

      // --- Note → Task ---
      if (source.role === "note" && source.note && targetRole === "task") {
        const note = source.note;
        const date = source.date;
        const scheduledAt = buildISOFromDateAndTime(date, "09:00");
        const taskNode = addNode("task", null, note.title, {
          scheduledAt,
          isAllDay: true,
          skipUndo: true,
        });
        softDeleteNote(note.id, SKIP);
        const taskId = taskNode?.id ?? "";

        push("scheduleItem", {
          label: "convertNoteToTask",
          undo: () => {
            if (taskId) softDelete(taskId, SKIP);
            // Restore note by creating it back
            createNote(note.title, SKIP);
          },
          redo: () => {
            if (taskId) restoreNode(taskId, SKIP);
            softDeleteNote(note.id, SKIP);
          },
        });

        showSuccessToast("task", taskId);
        return { success: true, targetId: taskId, targetRole: "task" };
      }

      // --- Note → Event ---
      if (source.role === "note" && source.note && targetRole === "event") {
        const note = source.note;
        const date = source.date;
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
          SKIP,
        );
        softDeleteNote(note.id, SKIP);
        bumpEventsVersion();

        push("scheduleItem", {
          label: "convertNoteToEvent",
          undo: () => {
            deleteScheduleItem(id, SKIP);
            createNote(note.title, SKIP);
            bumpEventsVersion();
          },
          redo: () => {
            createScheduleItem(
              date,
              note.title,
              "09:00",
              "10:00",
              undefined,
              undefined,
              undefined,
              undefined,
              note.content ?? undefined,
              SKIP,
            );
            softDeleteNote(note.id, SKIP);
            bumpEventsVersion();
          },
        });

        showSuccessToast("event", id);
        return { success: true, targetId: id, targetRole: "event" };
      }

      // --- Note → Daily ---
      if (source.role === "note" && source.note && targetRole === "daily") {
        const note = source.note;
        const date = source.date;
        upsertMemo(date, note.content || "", SKIP);
        softDeleteNote(note.id, SKIP);

        push("scheduleItem", {
          label: "convertNoteToDaily",
          undo: () => {
            deleteMemo(date, SKIP);
            createNote(note.title, SKIP);
          },
          redo: () => {
            upsertMemo(date, note.content || "", SKIP);
            softDeleteNote(note.id, SKIP);
          },
        });

        showSuccessToast("daily", date);
        return { success: true, targetId: date, targetRole: "daily" };
      }

      // --- Daily → Task ---
      if (source.role === "daily" && source.memo && targetRole === "task") {
        const memo = source.memo;
        const date = memo.date;
        const scheduledAt = buildISOFromDateAndTime(date, "09:00");
        const taskNode = addNode("task", null, memo.date, {
          scheduledAt,
          isAllDay: true,
          skipUndo: true,
        });
        deleteMemo(memo.date, SKIP);
        const taskId = taskNode?.id ?? "";

        push("scheduleItem", {
          label: "convertDailyToTask",
          undo: () => {
            if (taskId) softDelete(taskId, SKIP);
            upsertMemo(date, memo.content || "", SKIP);
          },
          redo: () => {
            if (taskId) restoreNode(taskId, SKIP);
            deleteMemo(memo.date, SKIP);
          },
        });

        showSuccessToast("task", taskId);
        return { success: true, targetId: taskId, targetRole: "task" };
      }

      // --- Daily → Event ---
      if (source.role === "daily" && source.memo && targetRole === "event") {
        const memo = source.memo;
        const date = memo.date;
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
          SKIP,
        );
        deleteMemo(memo.date, SKIP);
        bumpEventsVersion();

        push("scheduleItem", {
          label: "convertDailyToEvent",
          undo: () => {
            deleteScheduleItem(id, SKIP);
            upsertMemo(date, memo.content || "", SKIP);
            bumpEventsVersion();
          },
          redo: () => {
            createScheduleItem(
              date,
              memo.date,
              "09:00",
              "10:00",
              undefined,
              undefined,
              undefined,
              undefined,
              memo.content ?? undefined,
              SKIP,
            );
            deleteMemo(memo.date, SKIP);
            bumpEventsVersion();
          },
        });

        showSuccessToast("event", id);
        return { success: true, targetId: id, targetRole: "event" };
      }

      // --- Daily → Note ---
      if (source.role === "daily" && source.memo && targetRole === "note") {
        const memo = source.memo;
        const noteId = createNote(memo.date, SKIP);
        if (memo.content) updateNote(noteId, { content: memo.content });
        deleteMemo(memo.date, SKIP);

        push("scheduleItem", {
          label: "convertDailyToNote",
          undo: () => {
            softDeleteNote(noteId, SKIP);
            upsertMemo(memo.date, memo.content || "", SKIP);
          },
          redo: () => {
            createNote(memo.date, SKIP);
            if (memo.content) updateNote(noteId, { content: memo.content });
            deleteMemo(memo.date, SKIP);
          },
        });

        showSuccessToast("note", noteId);
        return { success: true, targetId: noteId, targetRole: "note" };
      }

      return { success: false };
    },
    [
      canConvert,
      hasDailyForDate,
      showToast,
      showSuccessToast,
      t,
      push,
      addNode,
      softDelete,
      restoreNode,
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
