import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { DailyNode } from "../types/daily";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { formatDateKey } from "../utils/dateKey";
import { useUndoRedo } from "../components/shared/UndoRedo";
import { useSyncContext } from "./useSyncContext";

export function useDaily() {
  const { syncVersion } = useSyncContext();
  const [dailies, setDailies] = useState<DailyNode[]>([]);
  const [deletedDailies, setDeletedDailies] = useState<DailyNode[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    formatDateKey(new Date()),
  );
  const { push } = useUndoRedo();
  const dailiesRef = useRef(dailies);
  const deletedDailiesRef = useRef(deletedDailies);
  useEffect(() => {
    dailiesRef.current = dailies;
  }, [dailies]);
  useEffect(() => {
    deletedDailiesRef.current = deletedDailies;
  }, [deletedDailies]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getDataService().fetchAllDailies();
        if (!cancelled) setDailies(loaded);
      } catch (e) {
        logServiceError("Daily", "fetch", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncVersion]);

  const upsertDaily = useCallback(
    (date: string, content: string, options?: { skipUndo?: boolean }) => {
      const existing = dailiesRef.current.find((m) => m.date === date);
      const now = new Date().toISOString();

      if (existing) {
        setDailies((prev) =>
          prev.map((m) =>
            m.date === date ? { ...m, content, updatedAt: now } : m,
          ),
        );
      } else {
        const newDaily: DailyNode = {
          id: `daily-${date}`,
          date,
          content,
          createdAt: now,
          updatedAt: now,
        };
        setDailies((prev) => [newDaily, ...prev]);
        if (!options?.skipUndo) {
          push("daily", {
            label: "createDaily",
            undo: () => {
              setDailies((p) => p.filter((m) => m.date !== date));
              getDataService()
                .deleteDaily(date)
                .catch((e) => logServiceError("Daily", "undoCreate", e));
            },
            redo: () => {
              setDailies((p) => [newDaily, ...p]);
              getDataService()
                .upsertDaily(date, content)
                .catch((e) => logServiceError("Daily", "redoCreate", e));
            },
          });
        }
      }

      getDataService()
        .upsertDaily(date, content)
        .catch((e) => logServiceError("Daily", "sync", e));
    },
    [push],
  );

  const deleteDaily = useCallback(
    (date: string, options?: { skipUndo?: boolean }) => {
      const target = dailiesRef.current.find((m) => m.date === date);
      setDailies((prev) => prev.filter((m) => m.date !== date));
      getDataService()
        .deleteDaily(date)
        .catch((e) => logServiceError("Daily", "delete", e));

      if (target) {
        const deleted: DailyNode = {
          ...target,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        };
        setDeletedDailies((d) => [deleted, ...d]);

        if (!options?.skipUndo) {
          push("daily", {
            label: "deleteDaily",
            undo: () => {
              setDailies((p) => [target, ...p]);
              setDeletedDailies((d) => d.filter((m) => m.date !== date));
              getDataService()
                .restoreDaily(date)
                .catch((e) => logServiceError("Daily", "undoDelete", e));
            },
            redo: () => {
              setDailies((p) => p.filter((m) => m.date !== date));
              setDeletedDailies((d) => [deleted, ...d]);
              getDataService()
                .deleteDaily(date)
                .catch((e) => logServiceError("Daily", "redoDelete", e));
            },
          });
        }
      }
    },
    [push],
  );

  const loadDeletedDailies = useCallback(async () => {
    try {
      const data = await getDataService().fetchDeletedDailies();
      setDeletedDailies(data);
    } catch (e) {
      logServiceError("Daily", "fetchDeleted", e);
    }
  }, []);

  const restoreDaily = useCallback((date: string) => {
    const target = deletedDailiesRef.current.find((m) => m.date === date);
    if (target) {
      const restored: DailyNode = {
        ...target,
        isDeleted: false,
        deletedAt: null,
      };
      setDailies((m) => [restored, ...m]);
    }
    setDeletedDailies((prev) => prev.filter((m) => m.date !== date));
    getDataService()
      .restoreDaily(date)
      .catch((e) => logServiceError("Daily", "restore", e));
  }, []);

  const permanentDeleteDaily = useCallback((date: string) => {
    setDeletedDailies((prev) => prev.filter((m) => m.date !== date));
    getDataService()
      .permanentDeleteDaily(date)
      .catch((e) => logServiceError("Daily", "permanentDelete", e));
  }, []);

  const togglePin = useCallback(
    (date: string) => {
      const daily = dailiesRef.current.find((m) => m.date === date);
      if (!daily) return;

      const newPinned = !daily.isPinned;

      setDailies((prev) =>
        prev.map((m) => (m.date === date ? { ...m, isPinned: newPinned } : m)),
      );
      getDataService()
        .toggleDailyPin(date)
        .catch((e) => logServiceError("Daily", "pin", e));

      push("daily", {
        label: "togglePin",
        undo: () => {
          setDailies((p) =>
            p.map((m) =>
              m.date === date ? { ...m, isPinned: !newPinned } : m,
            ),
          );
          getDataService()
            .toggleDailyPin(date)
            .catch((e) => logServiceError("Daily", "undoPin", e));
        },
        redo: () => {
          setDailies((p) =>
            p.map((m) => (m.date === date ? { ...m, isPinned: newPinned } : m)),
          );
          getDataService()
            .toggleDailyPin(date)
            .catch((e) => logServiceError("Daily", "redoPin", e));
        },
      });
    },
    [push],
  );

  const setDailyPassword = useCallback(
    async (date: string, password: string) => {
      const updated = await getDataService().setDailyPassword(date, password);
      setDailies((prev) =>
        prev.map((m) => (m.date === date ? { ...m, hasPassword: true } : m)),
      );
      return updated;
    },
    [],
  );

  const removeDailyPassword = useCallback(
    async (date: string, currentPassword: string) => {
      const updated = await getDataService().removeDailyPassword(
        date,
        currentPassword,
      );
      setDailies((prev) =>
        prev.map((m) => (m.date === date ? { ...m, hasPassword: false } : m)),
      );
      return updated;
    },
    [],
  );

  const verifyDailyPassword = useCallback(
    (date: string, password: string): Promise<boolean> => {
      return getDataService().verifyDailyPassword(date, password);
    },
    [],
  );

  const toggleEditLock = useCallback(async (date: string) => {
    const updated = await getDataService().toggleDailyEditLock(date);
    setDailies((prev) =>
      prev.map((m) =>
        m.date === date ? { ...m, isEditLocked: updated.isEditLocked } : m,
      ),
    );
    return updated;
  }, []);

  const selectedDaily = useMemo(
    () => dailies.find((m) => m.date === selectedDate),
    [dailies, selectedDate],
  );

  const getDailyForDate = useCallback((date: string): DailyNode | undefined => {
    return dailiesRef.current.find((m) => m.date === date);
  }, []);

  return useMemo(
    () => ({
      dailies,
      deletedDailies,
      selectedDate,
      setSelectedDate,
      selectedDaily,
      upsertDaily,
      deleteDaily,
      togglePin,
      loadDeletedDailies,
      restoreDaily,
      permanentDeleteDaily,
      getDailyForDate,
      setDailyPassword,
      removeDailyPassword,
      verifyDailyPassword,
      toggleEditLock,
    }),
    [
      dailies,
      deletedDailies,
      selectedDate,
      selectedDaily,
      upsertDaily,
      deleteDaily,
      togglePin,
      loadDeletedDailies,
      restoreDaily,
      permanentDeleteDaily,
      getDailyForDate,
      setDailyPassword,
      removeDailyPassword,
      verifyDailyPassword,
      toggleEditLock,
    ],
  );
}
