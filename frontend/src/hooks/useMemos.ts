import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
  const memosRef = useRef(memos);
  const deletedMemosRef = useRef(deletedMemos);
  useEffect(() => {
    memosRef.current = memos;
  }, [memos]);
  useEffect(() => {
    deletedMemosRef.current = deletedMemos;
  }, [deletedMemos]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getDataService().fetchAllMemos();
        if (!cancelled) setMemos(loaded);
      } catch (e) {
        logServiceError("Memo", "fetch", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upsertMemo = useCallback(
    (date: string, content: string, options?: { skipUndo?: boolean }) => {
      const existing = memosRef.current.find((m) => m.date === date);
      const now = new Date().toISOString();

      if (existing) {
        setMemos((prev) =>
          prev.map((m) =>
            m.date === date ? { ...m, content, updatedAt: now } : m,
          ),
        );
      } else {
        const newMemo: MemoNode = {
          id: `memo-${date}`,
          date,
          content,
          createdAt: now,
          updatedAt: now,
        };
        setMemos((prev) => [newMemo, ...prev]);
        if (!options?.skipUndo) {
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
        }
      }

      getDataService()
        .upsertMemo(date, content)
        .catch((e) => logServiceError("Memo", "sync", e));
    },
    [push],
  );

  const deleteMemo = useCallback(
    (date: string, options?: { skipUndo?: boolean }) => {
      const target = memosRef.current.find((m) => m.date === date);
      setMemos((prev) => prev.filter((m) => m.date !== date));
      getDataService()
        .deleteMemo(date)
        .catch((e) => logServiceError("Memo", "delete", e));

      if (target) {
        const deleted: MemoNode = {
          ...target,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        };
        setDeletedMemos((d) => [deleted, ...d]);

        if (!options?.skipUndo) {
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
      }
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
    const target = deletedMemosRef.current.find((m) => m.date === date);
    if (target) {
      const restored: MemoNode = {
        ...target,
        isDeleted: false,
        deletedAt: null,
      };
      setMemos((m) => [restored, ...m]);
    }
    setDeletedMemos((prev) => prev.filter((m) => m.date !== date));
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
      const memo = memosRef.current.find((m) => m.date === date);
      if (!memo) return;

      const newPinned = !memo.isPinned;

      setMemos((prev) =>
        prev.map((m) => (m.date === date ? { ...m, isPinned: newPinned } : m)),
      );
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
            p.map((m) => (m.date === date ? { ...m, isPinned: newPinned } : m)),
          );
          getDataService()
            .toggleMemoPin(date)
            .catch((e) => logServiceError("Memo", "redoPin", e));
        },
      });
    },
    [push],
  );

  const selectedMemo = useMemo(
    () => memos.find((m) => m.date === selectedDate),
    [memos, selectedDate],
  );

  const getMemoForDate = useCallback((date: string): MemoNode | undefined => {
    return memosRef.current.find((m) => m.date === date);
  }, []);

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
