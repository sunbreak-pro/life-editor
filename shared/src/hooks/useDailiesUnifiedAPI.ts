import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { DailyNode } from "../types/daily";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { todayDateKey } from "../utils/dateKey";
import { afterSettled } from "../utils/undoRedo/pendingWrite";
import { createNoopUndoRedo, type UndoRedoLike } from "./useTodoTreeHistory";
import { useSyncDomains } from "./useSyncDomains";
import { useDomainLoad } from "./useDomainLoad";
import {
  fillDailyBodies,
  mergeDailySummaries,
  rowsWithoutHead,
} from "./dailyListMerge";
import {
  getDailySelection,
  setDailySelection,
  clearDailySelection,
} from "../state/materialsSelectionStore";

/**
 * Options the host injects. The shared hook takes the DataService and a
 * host UndoRedo Context by injection so it is host-agnostic (CLAUDE.md
 * §6.4). `undoRedo` defaults to a no-op (web — real UndoRedo lands in S6,
 * same as the todos domain). `useSyncContext` is read directly because it
 * is itself a shared Context (S1) the Provider order guarantees.
 */
/** Pause before a failed body read of the open day is tried again (#2325). */
const BODY_RETRY_MS = 3000;

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
  const syncVersion = useSyncDomains("dailies");

  const [dailies, setDailies] = useState<DailyNode[]>([]);
  const [deletedDailies, setDeletedDailies] = useState<DailyNode[]>([]);
  const [selectedDate, setSelectedDateState] = useState<string>(
    // #282: seed from the module-level store so a Materials tab/section switch
    // returns to the date the user was on. Falls back to today when the store
    // is empty (fresh session). Day-start-hour aware: before the configured
    // rollover hour this is still "yesterday" (#218), so a 2 AM entry lands on
    // the right daily.
    () => getDailySelection() ?? todayDateKey(),
  );
  // #282: write-through wrapper. Every PUBLIC setSelectedDate call is
  // user-driven, so persist it to the store. The today-default initializer
  // above deliberately does NOT write (an untouched default must not pin the
  // store to today and mask a later restore). Picking TODAY clears the store
  // instead of pinning today's concrete date — a pinned date would reopen
  // yesterday after midnight in a long-lived session, while an empty store
  // already means "today" on restore.
  const setSelectedDate = useCallback((date: string): void => {
    setSelectedDateState(date);
    if (date === todayDateKey()) clearDailySelection();
    else setDailySelection(date);
  }, []);
  const dailiesRef = useRef(dailies);
  const deletedDailiesRef = useRef(deletedDailies);
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);
  /*
   * #2325 — bodies. The list holds light rows (`bodyLoaded: false`); the open
   * day's body is fetched here. `staleDatesRef` names an open day whose row
   * moved while its body stayed on screen (see mergeDailySummaries), and
   * `writeGenRef` counts local writes per date, so a body read that a local
   * write overtook is dropped instead of putting the older text back.
   */
  const staleDatesRef = useRef(new Set<string>());
  const writeGenRef = useRef(new Map<string, number>());
  const hydratingRef = useRef(new Set<string>());
  /** Light rows whose whole body was fetched for the excerpt, by updatedAt. */
  const bodyFetchedAtRef = useRef(new Map<string, string>());
  // A body read that failed is tried again after a pause rather than leaving
  // the day behind its skeleton until something else moves (#2325).
  const [bodyRetry, setBodyRetry] = useState(0);
  const bodyRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (bodyRetryTimerRef.current !== null)
        clearTimeout(bodyRetryTimerRef.current);
    },
    [],
  );
  useEffect(() => {
    dailiesRef.current = dailies;
  }, [dailies]);
  useEffect(() => {
    deletedDailiesRef.current = deletedDailies;
  }, [deletedDailies]);

  /*
   * Load on mount and on every dailies bump, through the shared load effect
   * (#672 / #891). The hand-written effect this replaces logged a failure and
   * then said nothing: it had no loading flag and no error state at all, so a
   * failed read was indistinguishable from "you have no dailies yet" — an
   * empty list, silently, for the rest of the session.
   *
   * `isLoading` / `error` are therefore NEW on this hook's surface rather than
   * a rename of something that was already there. Nothing renders them yet;
   * wiring a loading state or an error card into the Daily UI is a visible
   * change and does not belong in a behaviour-preserving refactor. What they
   * do buy now is that #296's un-latch (an error clears on the next successful
   * read) is in place before any surface starts reading them, which is the
   * thing the four hand-written copies each got wrong differently.
   *
   * `refetchReportsLoading: false` for the same reason as todos and notes:
   * Realtime echoes this tab's own writes back, so a bump-driven re-read must
   * not read as "no data yet" — every keystroke-driven save bumps the counter.
   */
  const { isLoading, error } = useDomainLoad({
    domain: "Daily",
    snapshotKey: "dailies",
    dataService: ds,
    version: syncVersion,
    // #2325: the list without the bodies. Only the rows whose head cannot be
    // read (a legacy plain-text body) fetch theirs, for the excerpt.
    // A row whose body was already fetched at this `updatedAt` is not
    // fetched again — the merge keeps the body this list already holds.
    load: async (service) => {
      const rows = await service.listDailySummariesUnified();
      const fetchedAt = bodyFetchedAtRef.current;
      const stampOf = new Map(rows.map((r) => [r.id, r.updatedAt]));
      const missing = rowsWithoutHead(rows).filter(
        (id) => fetchedAt.get(id) !== stampOf.get(id),
      );
      if (missing.length === 0) return rows;
      const bodies = await service.fetchDailyBodiesUnified(missing);
      for (const id of missing) fetchedAt.set(id, stampOf.get(id) ?? "");
      return fillDailyBodies(rows, bodies);
    },
    apply: (rows) =>
      setDailies((prev) => {
        const merged = mergeDailySummaries(prev, rows, selectedDateRef.current);
        for (const date of merged.stale) staleDatesRef.current.add(date);
        return merged.list;
      }),
    fallbackMessage: "Failed to load dailies",
    refetchReportsLoading: false,
  });

  /*
   * #2325 — fetch the open day's body when its row is light, or when the row
   * moved while the body stayed on screen. The editor waits for it
   * (DailyView draws a skeleton while `bodyLoaded` is false), so nothing can
   * save a day over a body this client never had.
   */
  useEffect(() => {
    const date = selectedDate;
    const row = dailies.find((d) => d.date === date);
    if (!row) return;
    if (row.bodyLoaded !== false && !staleDatesRef.current.has(date)) return;
    if (hydratingRef.current.has(date)) return;
    hydratingRef.current.add(date);
    staleDatesRef.current.delete(date);
    const gen = writeGenRef.current.get(date) ?? 0;
    void ds
      .getDailyByDateUnified(date)
      .then((full) => {
        if ((writeGenRef.current.get(date) ?? 0) !== gen) return;
        setDailies((prev) =>
          prev.map((d) => {
            if (d.date !== date) return d;
            // No row on the server any more (deleted elsewhere): there is no
            // body to protect, so the day opens empty like a day never
            // written, and a save creates it again.
            if (!full) return { ...d, content: "", bodyLoaded: true };
            return { ...full, bodyLoaded: true };
          }),
        );
      })
      .catch((e) => {
        logServiceError("Daily", "loadBody", e);
        if (bodyRetryTimerRef.current !== null)
          clearTimeout(bodyRetryTimerRef.current);
        bodyRetryTimerRef.current = setTimeout(() => {
          bodyRetryTimerRef.current = null;
          setBodyRetry((n) => n + 1);
        }, BODY_RETRY_MS);
      })
      .finally(() => {
        hydratingRef.current.delete(date);
      });
  }, [ds, selectedDate, dailies, bodyRetry]);

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

  /*
   * #2309 — the writes that wait for a day's first create.
   *
   * The id is `daily-<date>`, so a day can be created exactly once. The
   * service's upsert reads the row and creates it when absent, and on a slow
   * network the editor's next debounced save reads "absent" too, before the
   * first create has landed: both inserted, and the second hit duplicate key
   * (409). The optimistic node below cannot stop that — it is local, the
   * server row is not there yet.
   *
   * So while a create is in flight for a date, every later write for that
   * date queues behind it, in call order: by the time each one runs the row
   * exists and its upsert becomes an update. The entry is dropped when the
   * last queued write settles, and writes for a day that already exists keep
   * running side by side as before — holding all of them in line would make
   * a slow network fall further behind with every keystroke.
   */
  const createGateRef = useRef(new Map<string, Promise<DailyNode>>());

  const writeDaily = useCallback(
    (date: string, content: string, creates: boolean): Promise<DailyNode> => {
      const gates = createGateRef.current;
      const ahead = gates.get(date);
      if (!ahead && !creates) return ds.upsertDailyByDateUnified(date, content);
      const write = ahead
        ? afterSettled(ahead).then(() =>
            ds.upsertDailyByDateUnified(date, content),
          )
        : ds.upsertDailyByDateUnified(date, content);
      gates.set(date, write);
      void afterSettled(write).then(() => {
        if (gates.get(date) === write) gates.delete(date);
      });
      return write;
    },
    [ds],
  );

  /**
   * Optimistic write. The local state update is synchronous; the returned
   * promise resolves with the PERSISTED node once the row actually exists
   * (or null if the write failed — it is already logged).
   *
   * Callers may keep ignoring the promise (fire-and-forget is still the
   * default shape). It exists for work that must not run before the row is
   * in `items_meta`: a brand-new day's `[[ ]]` edge FK-references it, and the
   * optimistic node above appears well before the write lands, so local
   * presence is not proof of persistence (#371).
   */
  const upsertDaily = useCallback(
    (
      date: string,
      content: string,
      opts?: { skipUndo?: boolean },
    ): Promise<DailyNode | null> => {
      const existing = dailiesRef.current.find((m) => m.date === date);
      const now = new Date().toISOString();
      // Started before the push so the undo closure can hold it (#1682): a
      // delete fired while this upsert is in flight would be re-created by it
      // a moment later, leaving the day back with the undo already spent.
      const write = writeDaily(date, content, !existing);
      // A body read for this date that is still out is now older (#2325).
      writeGenRef.current.set(date, (writeGenRef.current.get(date) ?? 0) + 1);
      // Take the server's stamp once the save lands, while the row still
      // holds the text it wrote (#2325). The list's re-read then finds the
      // day unmoved, instead of counting this client's own save as a change
      // and fetching the open day's body again.
      void write.then(
        (saved) =>
          setDailies((prev) =>
            prev.map((m) =>
              m.date === date && m.content === content
                ? { ...m, updatedAt: saved.updatedAt }
                : m,
            ),
          ),
        () => {},
      );

      if (existing) {
        setDailies((prev) =>
          prev.map((m) =>
            m.date === date
              ? {
                  ...m,
                  content,
                  updatedAt: now,
                  // The written text IS the whole body now.
                  ...(m.bodyLoaded === false ? { bodyLoaded: true } : {}),
                }
              : m,
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
            undo: async () => {
              setDailies((p) => p.filter((m) => m.date !== date));
              await afterSettled(write);
              await softDeleteDailyByDate(date);
            },
            redo: () => {
              setDailies((p) => [newDaily, ...p]);
              return writeDaily(date, content, true).then(() => {});
            },
          });
        }
      }

      return write.catch((e) => {
        logServiceError("Daily", "sync", e);
        return null;
      });
    },
    [push, softDeleteDailyByDate, writeDaily],
  );

  const deleteDaily = useCallback(
    (date: string, opts?: { skipUndo?: boolean }) => {
      const target = dailiesRef.current.find((m) => m.date === date);
      setDailies((prev) => prev.filter((m) => m.date !== date));
      const landed = softDeleteDailyByDate(date);
      void landed.catch((e) => logServiceError("Daily", "delete", e));

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
            // #1682: the restore waits for the delete it reverses, and its
            // own failure reaches the manager instead of console.warn.
            undo: async () => {
              setDailies((p) => [target, ...p]);
              setDeletedDailies((d) => d.filter((m) => m.date !== date));
              await afterSettled(landed);
              await ds.restoreDailyUnified(`daily-${date}`);
            },
            redo: () => {
              setDailies((p) => p.filter((m) => m.date !== date));
              setDeletedDailies((d) => [deleted, ...d]);
              return softDeleteDailyByDate(date).then(() => {});
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
      const landed = toggleDailyPinByDate(date);
      void landed.catch((e) => logServiceError("Daily", "pin", e));

      push("daily", {
        label: "togglePin",
        /*
         * #1682 — this one MUST wait, not just report.
         *
         * The write is a toggle, not an assignment: it reads the stored flag
         * and flips it. Two of them racing land on the same value, so an undo
         * fired before the first flip settled would leave the pin exactly
         * where the user did not want it.
         */
        undo: async () => {
          setDailies((p) =>
            p.map((m) =>
              m.date === date ? { ...m, isPinned: !newPinned } : m,
            ),
          );
          await afterSettled(landed);
          await toggleDailyPinByDate(date);
        },
        redo: () => {
          setDailies((p) =>
            p.map((m) => (m.date === date ? { ...m, isPinned: newPinned } : m)),
          );
          return toggleDailyPinByDate(date).then(() => {});
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
      isLoading,
      error,
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
      isLoading,
      error,
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
    ],
  );
}
