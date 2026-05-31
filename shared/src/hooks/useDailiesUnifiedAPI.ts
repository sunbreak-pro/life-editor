import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { DailyNode } from "../types/daily";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { formatDateKey } from "../utils/dateKey";
import { createNoopUndoRedo, type UndoRedoLike } from "./useTaskTreeHistory";
import { useSyncContext } from "./useSyncContext";

/**
 * Options the host injects. The shared hook takes the DataService and a
 * host UndoRedo Context by injection so it is host-agnostic (CLAUDE.md
 * §6.4). `undoRedo` defaults to a no-op (web — real UndoRedo lands in S6,
 * same as the tasks domain). `useSyncContext` is read directly because it
 * is itself a shared Context (S1) the Provider order guarantees.
 */
export interface UseDailiesUnifiedAPIOptions {
  dataService: DataService;
  undoRedo?: UndoRedoLike;
}

/**
 * DU-G G4: behaviour-preserving port of the former legacy Daily hook, with the
 * DataService call sites rewritten to the Unified (items_meta +
 * dailies_payload) method names. The legacy Daily Bridge class
 * that mapped legacy → Unified names (and constructed the `daily-${date}`
 * id) has been retired; this hook now calls `*Unified` DataService methods
 * directly. The date→id mapping (`daily-${date}`) and the
 * fetch-then-soft-delete / fetch-flip-write logic that lived in the Bridge
 * are inlined here verbatim.
 *
 * Optimistic local mutation + fire-and-forget persistence + undo/redo
 * commands. Must sit inside a Sync Provider (reads `useSyncContext`) —
 * CLAUDE.md §6.2 order places Daily after Sync.
 */
export function useDailiesUnifiedAPI(options: UseDailiesUnifiedAPIOptions) {
  const ds = options.dataService;
  const { push } = options.undoRedo ?? createNoopUndoRedo();
  const { syncVersion } = useSyncContext();

  const [dailies, setDailies] = useState<DailyNode[]>([]);
  const [deletedDailies, setDeletedDailies] = useState<DailyNode[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    formatDateKey(new Date()),
  );
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
        const loaded = await ds.listDailiesUnified();
        if (!cancelled) setDailies(loaded);
      } catch (e) {
        logServiceError("Daily", "fetch", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  // Soft-delete by date. The retired Bridge resolved date → existing row →
  // softDeleteDailyUnified(id); a missing row is a silent no-op. Inlined
  // verbatim so the date-keyed surface stays identical.
  const softDeleteDailyByDate = useCallback(
    async (date: string): Promise<void> => {
      const existing = await ds.getDailyByDateUnified(date);
      if (!existing) return;
      await ds.softDeleteDailyUnified(existing.id);
    },
    [ds],
  );

  const upsertDaily = useCallback(
    (date: string, content: string, opts?: { skipUndo?: boolean }) => {
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
        if (!opts?.skipUndo) {
          push("daily", {
            label: "createDaily",
            undo: () => {
              setDailies((p) => p.filter((m) => m.date !== date));
              softDeleteDailyByDate(date).catch((e) =>
                logServiceError("Daily", "undoCreate", e),
              );
            },
            redo: () => {
              setDailies((p) => [newDaily, ...p]);
              ds.upsertDailyByDateUnified(date, content).catch((e) =>
                logServiceError("Daily", "redoCreate", e),
              );
            },
          });
        }
      }

      ds.upsertDailyByDateUnified(date, content).catch((e) =>
        logServiceError("Daily", "sync", e),
      );
    },
    [ds, push, softDeleteDailyByDate],
  );

  const deleteDaily = useCallback(
    (date: string, opts?: { skipUndo?: boolean }) => {
      const target = dailiesRef.current.find((m) => m.date === date);
      setDailies((prev) => prev.filter((m) => m.date !== date));
      softDeleteDailyByDate(date).catch((e) =>
        logServiceError("Daily", "delete", e),
      );

      if (target) {
        const deleted: DailyNode = {
          ...target,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        };
        setDeletedDailies((d) => [deleted, ...d]);

        if (!opts?.skipUndo) {
          push("daily", {
            label: "deleteDaily",
            undo: () => {
              setDailies((p) => [target, ...p]);
              setDeletedDailies((d) => d.filter((m) => m.date !== date));
              ds.restoreDailyUnified(`daily-${date}`).catch((e) =>
                logServiceError("Daily", "undoDelete", e),
              );
            },
            redo: () => {
              setDailies((p) => p.filter((m) => m.date !== date));
              setDeletedDailies((d) => [deleted, ...d]);
              softDeleteDailyByDate(date).catch((e) =>
                logServiceError("Daily", "redoDelete", e),
              );
            },
          });
        }
      }
    },
    [ds, push, softDeleteDailyByDate],
  );

  const loadDeletedDailies = useCallback(async () => {
    try {
      const data = await ds.fetchDeletedDailiesUnified();
      setDeletedDailies(data);
    } catch (e) {
      logServiceError("Daily", "fetchDeleted", e);
    }
  }, [ds]);

  const restoreDaily = useCallback(
    (date: string) => {
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
      ds.restoreDailyUnified(`daily-${date}`).catch((e) =>
        logServiceError("Daily", "restore", e),
      );
    },
    [ds],
  );

  const permanentDeleteDaily = useCallback(
    (date: string) => {
      setDeletedDailies((prev) => prev.filter((m) => m.date !== date));
      ds.permanentDeleteDailyUnified(`daily-${date}`).catch((e) =>
        logServiceError("Daily", "permanentDelete", e),
      );
    },
    [ds],
  );

  // Pin toggle. The retired Bridge had no atomic Unified toggle — it
  // resolved date → existing row, threw if absent, then wrote the flipped
  // isPinned via updateDailyUnified. N=1 single-user app so the read+write
  // race is not a concern. Inlined verbatim.
  const toggleDailyPinByDate = useCallback(
    async (date: string): Promise<DailyNode> => {
      const existing = await ds.getDailyByDateUnified(date);
      if (!existing) {
        throw new Error(`toggleDailyPin: no daily for date "${date}"`);
      }
      return ds.updateDailyUnified(existing.id, {
        isPinned: !existing.isPinned,
      });
    },
    [ds],
  );

  const togglePin = useCallback(
    (date: string) => {
      const daily = dailiesRef.current.find((m) => m.date === date);
      if (!daily) return;

      const newPinned = !daily.isPinned;

      setDailies((prev) =>
        prev.map((m) => (m.date === date ? { ...m, isPinned: newPinned } : m)),
      );
      toggleDailyPinByDate(date).catch((e) =>
        logServiceError("Daily", "pin", e),
      );

      push("daily", {
        label: "togglePin",
        undo: () => {
          setDailies((p) =>
            p.map((m) =>
              m.date === date ? { ...m, isPinned: !newPinned } : m,
            ),
          );
          toggleDailyPinByDate(date).catch((e) =>
            logServiceError("Daily", "undoPin", e),
          );
        },
        redo: () => {
          setDailies((p) =>
            p.map((m) => (m.date === date ? { ...m, isPinned: newPinned } : m)),
          );
          toggleDailyPinByDate(date).catch((e) =>
            logServiceError("Daily", "redoPin", e),
          );
        },
      });
    },
    [push, toggleDailyPinByDate],
  );

  const setDailyPassword = useCallback(
    async (date: string, password: string) => {
      const updated = await ds.setDailyPasswordUnified(
        `daily-${date}`,
        password,
      );
      setDailies((prev) =>
        prev.map((m) => (m.date === date ? { ...m, hasPassword: true } : m)),
      );
      return updated;
    },
    [ds],
  );

  const removeDailyPassword = useCallback(
    async (date: string, currentPassword: string) => {
      const updated = await ds.removeDailyPasswordUnified(
        `daily-${date}`,
        currentPassword,
      );
      setDailies((prev) =>
        prev.map((m) => (m.date === date ? { ...m, hasPassword: false } : m)),
      );
      return updated;
    },
    [ds],
  );

  const verifyDailyPassword = useCallback(
    (date: string, password: string): Promise<boolean> => {
      return ds.verifyDailyPasswordUnified(`daily-${date}`, password);
    },
    [ds],
  );

  const toggleEditLock = useCallback(
    async (date: string) => {
      const updated = await ds.toggleDailyEditLockUnified(`daily-${date}`);
      setDailies((prev) =>
        prev.map((m) =>
          m.date === date ? { ...m, isEditLocked: updated.isEditLocked } : m,
        ),
      );
      return updated;
    },
    [ds],
  );

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
