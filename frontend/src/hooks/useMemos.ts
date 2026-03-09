import { useState, useCallback, useEffect, useMemo } from "react";
import type { MemoNode } from "../types/memo";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { formatDateKey } from "../utils/dateKey";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useMemos() {
  const [memos, setMemos] = useState<MemoNode[]>([]);
  const [deletedMemos, setDeletedMemos] = useState<MemoNode[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    formatDateKey(new Date()),
  );
  const { push } = useUndoRedo();

  // Load from DataService on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getDataService().fetchAllMemos();
        if (!cancelled) {
          setMemos(loaded);
        }
      } catch (e) {
        logServiceError("Memo", "fetch", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upsertMemo = useCallback(
    (date: string, content: string) => {
      setMemos((prev) => {
        const existing = prev.find((m) => m.date === date);
        const now = new Date().toISOString();
        if (existing) {
          // Content update — silent (TipTap handles undo)
          return prev.map((m) =>
            m.date === date ? { ...m, content, updatedAt: now } : m,
          );
        } else {
          const newMemo: MemoNode = {
            id: `memo-${date}`,
            date,
            content,
            createdAt: now,
            updatedAt: now,
          };
          // Push undo command for new memo creation
          push("memo", {
            label: "createMemo",
            undo: () => {
              setMemos((p) => p.filter((m) => m.date !== date));
              getDataService()
                .deleteMemo(date)
                .catch((e) => logServiceError("Memo", "undoCreate", e));
            },
            redo: () => {
              setMemos((p) => [newMemo, ...p]);
              getDataService()
                .upsertMemo(date, content)
                .catch((e) => logServiceError("Memo", "redoCreate", e));
            },
          });
          return [newMemo, ...prev];
        }
      });
      getDataService()
        .upsertMemo(date, content)
        .catch((e) => logServiceError("Memo", "sync", e));
    },
    [push],
  );

  const deleteMemo = useCallback(
    (date: string) => {
      setMemos((prev) => {
        const target = prev.find((m) => m.date === date);
        if (target) {
          const deleted: MemoNode = {
            ...target,
            isDeleted: true,
            deletedAt: new Date().toISOString(),
          };
          setDeletedMemos((d) => [deleted, ...d]);

          // Push undo command
          push("memo", {
            label: "deleteMemo",
            undo: () => {
              setMemos((p) => [target, ...p]);
              setDeletedMemos((d) => d.filter((m) => m.date !== date));
              getDataService()
                .restoreMemo(date)
                .catch((e) => logServiceError("Memo", "undoDelete", e));
            },
            redo: () => {
              setMemos((p) => p.filter((m) => m.date !== date));
              setDeletedMemos((d) => [deleted, ...d]);
              getDataService()
                .deleteMemo(date)
                .catch((e) => logServiceError("Memo", "redoDelete", e));
            },
          });
        }
        return prev.filter((m) => m.date !== date);
      });
      getDataService()
        .deleteMemo(date)
        .catch((e) => logServiceError("Memo", "delete", e));
    },
    [push],
  );

  const loadDeletedMemos = useCallback(async () => {
    try {
      const data = await getDataService().fetchDeletedMemos();
      setDeletedMemos(data);
    } catch (e) {
      logServiceError("Memo", "fetchDeleted", e);
    }
  }, []);

  const restoreMemo = useCallback((date: string) => {
    setDeletedMemos((prev) => {
      const target = prev.find((m) => m.date === date);
      if (target) {
        const restored: MemoNode = {
          ...target,
          isDeleted: false,
          deletedAt: null,
        };
        setMemos((m) => [restored, ...m]);
      }
      return prev.filter((m) => m.date !== date);
    });
    getDataService()
      .restoreMemo(date)
      .catch((e) => logServiceError("Memo", "restore", e));
  }, []);

  const permanentDeleteMemo = useCallback((date: string) => {
    setDeletedMemos((prev) => prev.filter((m) => m.date !== date));
    getDataService()
      .permanentDeleteMemo(date)
      .catch((e) => logServiceError("Memo", "permanentDelete", e));
  }, []);

  const togglePin = useCallback(
    (date: string) => {
      setMemos((prev) => {
        const memo = prev.find((m) => m.date === date);
        if (!memo) return prev;

        const newPinned = !memo.isPinned;
        getDataService()
          .toggleMemoPin(date)
          .catch((e) => logServiceError("Memo", "pin", e));

        push("memo", {
          label: "togglePin",
          undo: () => {
            setMemos((p) =>
              p.map((m) =>
                m.date === date ? { ...m, isPinned: !newPinned } : m,
              ),
            );
            getDataService()
              .toggleMemoPin(date)
              .catch((e) => logServiceError("Memo", "undoPin", e));
          },
          redo: () => {
            setMemos((p) =>
              p.map((m) =>
                m.date === date ? { ...m, isPinned: newPinned } : m,
              ),
            );
            getDataService()
              .toggleMemoPin(date)
              .catch((e) => logServiceError("Memo", "redoPin", e));
          },
        });

        return prev.map((m) =>
          m.date === date ? { ...m, isPinned: newPinned } : m,
        );
      });
    },
    [push],
  );

  const getMemoForDate = useCallback(
    (date: string): MemoNode | undefined => {
      return memos.find((m) => m.date === date);
    },
    [memos],
  );

  const selectedMemo = getMemoForDate(selectedDate);

  return useMemo(
    () => ({
      memos,
      deletedMemos,
      selectedDate,
      setSelectedDate,
      selectedMemo,
      upsertMemo,
      deleteMemo,
      togglePin,
      loadDeletedMemos,
      restoreMemo,
      permanentDeleteMemo,
      getMemoForDate,
    }),
    [
      memos,
      deletedMemos,
      selectedDate,
      selectedMemo,
      upsertMemo,
      deleteMemo,
      togglePin,
      loadDeletedMemos,
      restoreMemo,
      permanentDeleteMemo,
      getMemoForDate,
    ],
  );
}
