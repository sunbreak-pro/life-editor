import { useState, useCallback, useEffect, useMemo } from "react";
import type { MemoNode } from "../types/memo";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { formatDateKey } from "../utils/dateKey";

export function useMemos() {
  const [memos, setMemos] = useState<MemoNode[]>([]);
  const [deletedMemos, setDeletedMemos] = useState<MemoNode[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    formatDateKey(new Date()),
  );

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

  const upsertMemo = useCallback((date: string, content: string) => {
    setMemos((prev) => {
      const existing = prev.find((m) => m.date === date);
      const now = new Date().toISOString();
      if (existing) {
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
        return [newMemo, ...prev];
      }
    });
    getDataService()
      .upsertMemo(date, content)
      .catch((e) => logServiceError("Memo", "sync", e));
  }, []);

  const deleteMemo = useCallback((date: string) => {
    setMemos((prev) => {
      const target = prev.find((m) => m.date === date);
      if (target) {
        const deleted: MemoNode = {
          ...target,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        };
        setDeletedMemos((d) => [deleted, ...d]);
      }
      return prev.filter((m) => m.date !== date);
    });
    getDataService()
      .deleteMemo(date)
      .catch((e) => logServiceError("Memo", "delete", e));
  }, []);

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
      loadDeletedMemos,
      restoreMemo,
      permanentDeleteMemo,
      getMemoForDate,
    ],
  );
}
