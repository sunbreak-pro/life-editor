import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { RoutineNode, FrequencyType } from "../types/routine";
import type { RoutineGroup } from "../types/routineGroup";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { createNoopUndoRedo, type UndoRedoLike } from "./useTaskTreeHistory";
import { useSyncContext } from "./useSyncContext";

/**
 * Behaviour-preserving port of the Tauri routine trio
 * (frontend/src/hooks/useRoutines.ts + useRoutineGroups.ts +
 * useRoutineGroupAssignments.ts) consolidated into one shared API hook
 * — same shape as useNotesAPI / useDailyAPI. Host dependencies are
 * injected, not imported (CLAUDE.md §6.4):
 * - `getDataService()` singleton → `options.dataService`
 * - host UndoRedo Context        → `options.undoRedo` (no-op default;
 *   real UndoRedo lands in S6, same as tasks/daily/notes)
 *
 * Must sit inside a Sync Provider (reads `useSyncContext`) — CLAUDE.md
 * §6.2 places Routine after Sync and as the first of the Schedule trio
 * (… → Routine → ScheduleItems → CalendarTags → …).
 *
 * Scope (S4-3): routines + routine_groups + routine_group_assignments
 * CRUD only. The Routine→schedule_items generator lands in S4-5 and is
 * NOT wired here.
 */

function sameGroupSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const x of b) if (!setA.has(x)) return false;
  return true;
}

export interface UseRoutinesAPIOptions {
  dataService: DataService;
  undoRedo?: UndoRedoLike;
}

export function useRoutinesAPI(options: UseRoutinesAPIOptions) {
  const ds = options.dataService;
  const { push } = options.undoRedo ?? createNoopUndoRedo();
  const { syncVersion } = useSyncContext();

  const [routines, setRoutines] = useState<RoutineNode[]>([]);
  const [deletedRoutines, setDeletedRoutines] = useState<RoutineNode[]>([]);
  const [routineGroups, setRoutineGroups] = useState<RoutineGroup[]>([]);
  const [assignmentsMap, setAssignmentsMap] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const routinesRef = useRef(routines);
  useEffect(() => {
    routinesRef.current = routines;
  }, [routines]);

  // `assignmentsMap` empty during initial load: setGroupsForRoutine
  // calls in that window would persist [] and wipe genuine memberships
  // (frontend useRoutineGroupAssignments guard, ported verbatim).
  const assignmentsLoadedRef = useRef(false);

  // Initial load + every syncVersion bump (mirrors notes/daily). The
  // three reads run independently so a failure in one (e.g. trash) does
  // not block the others. Trash list is loaded alongside the active set.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    assignmentsLoadedRef.current = false;
    (async () => {
      try {
        const [r, g, a] = await Promise.all([
          ds.fetchAllRoutines(),
          ds.fetchRoutineGroups(),
          ds.fetchAllRoutineGroupAssignments(),
        ]);
        if (cancelled) return;
        setRoutines(r);
        setRoutineGroups(g);
        const map = new Map<string, string[]>();
        for (const row of a) {
          if (row.isDeleted) continue;
          const existing = map.get(row.routineId) ?? [];
          existing.push(row.groupId);
          map.set(row.routineId, existing);
        }
        setAssignmentsMap(map);
        assignmentsLoadedRef.current = true;
      } catch (e) {
        logServiceError("Routines", "fetch", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load routines");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    (async () => {
      try {
        const deleted = await ds.fetchDeletedRoutines();
        if (!cancelled) setDeletedRoutines(deleted);
      } catch (e) {
        logServiceError("Routines", "fetchDeleted", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  // ── Routines ──────────────────────────────────────────────────────

  const createRoutine = useCallback(
    (
      title: string,
      startTime?: string,
      endTime?: string,
      frequencyType?: FrequencyType,
      frequencyDays?: number[],
      frequencyInterval?: number | null,
      frequencyStartDate?: string | null,
      reminderEnabled?: boolean,
      reminderOffset?: number,
    ) => {
      const id = generateId("routine");
      const now = new Date().toISOString();
      const optimistic: RoutineNode = {
        id,
        title,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        isArchived: false,
        isVisible: true,
        isDeleted: false,
        deletedAt: null,
        order: routinesRef.current.length,
        frequencyType: frequencyType ?? "daily",
        frequencyDays: frequencyDays ?? [],
        frequencyInterval: frequencyInterval ?? null,
        frequencyStartDate: frequencyStartDate ?? null,
        reminderEnabled,
        reminderOffset,
        createdAt: now,
        updatedAt: now,
      };
      setRoutines((prev) => [...prev, optimistic]);
      ds.createRoutine(
        id,
        title,
        startTime,
        endTime,
        frequencyType,
        frequencyDays,
        frequencyInterval,
        frequencyStartDate,
        reminderEnabled,
        reminderOffset,
      ).catch((e) => logServiceError("Routines", "create", e));

      push("routine", {
        label: "createRoutine",
        undo: () => {
          setRoutines((prev) => prev.filter((r) => r.id !== id));
          ds.softDeleteRoutine(id).catch((e) =>
            logServiceError("Routines", "undoCreate", e),
          );
        },
        redo: () => {
          setRoutines((prev) => [...prev, optimistic]);
          ds.restoreRoutine(id).catch((e) =>
            logServiceError("Routines", "redoCreate", e),
          );
        },
      });

      return id;
    },
    [ds, push],
  );

  const updateRoutine = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          RoutineNode,
          | "title"
          | "startTime"
          | "endTime"
          | "isArchived"
          | "isVisible"
          | "order"
          | "frequencyType"
          | "frequencyDays"
          | "frequencyInterval"
          | "frequencyStartDate"
          | "reminderEnabled"
          | "reminderOffset"
        >
      >,
      opts?: { skipUndo?: boolean },
    ) => {
      const prev = routinesRef.current.find((r) => r.id === id);
      setRoutines((p) =>
        p.map((r) =>
          r.id === id
            ? { ...r, ...updates, updatedAt: new Date().toISOString() }
            : r,
        ),
      );
      ds.updateRoutine(id, updates).catch((e) =>
        logServiceError("Routines", "update", e),
      );

      if (prev && !opts?.skipUndo) {
        const prevValues: typeof updates = {};
        for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
          (prevValues as Record<string, unknown>)[key] = prev[key];
        }
        push("routine", {
          label: "updateRoutine",
          undo: () => {
            setRoutines((p) =>
              p.map((r) =>
                r.id === id
                  ? { ...r, ...prevValues, updatedAt: new Date().toISOString() }
                  : r,
              ),
            );
            ds.updateRoutine(id, prevValues).catch((e) =>
              logServiceError("Routines", "undoUpdate", e),
            );
          },
          redo: () => {
            setRoutines((p) =>
              p.map((r) =>
                r.id === id
                  ? { ...r, ...updates, updatedAt: new Date().toISOString() }
                  : r,
              ),
            );
            ds.updateRoutine(id, updates).catch((e) =>
              logServiceError("Routines", "redoUpdate", e),
            );
          },
        });
      }
    },
    [ds, push],
  );

  const deleteRoutine = useCallback(
    async (
      id: string,
      opts?: { skipUndo?: boolean },
    ): Promise<{ deletedScheduleItemIds: string[] }> => {
      const target = routinesRef.current.find((r) => r.id === id);
      if (target) {
        const deleted: RoutineNode = {
          ...target,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        };
        setDeletedRoutines((d) => [deleted, ...d]);
      }
      setRoutines((prev) => prev.filter((r) => r.id !== id));

      let result: { deletedScheduleItemIds: string[] } = {
        deletedScheduleItemIds: [],
      };
      try {
        result = await ds.softDeleteRoutine(id);
      } catch (e) {
        logServiceError("Routines", "softDelete", e);
      }

      if (target && !opts?.skipUndo) {
        push("routine", {
          label: "deleteRoutine",
          undo: () => {
            setRoutines((prev) => [...prev, target]);
            setDeletedRoutines((prev) => prev.filter((r) => r.id !== id));
            ds.restoreRoutine(id).catch((e) =>
              logServiceError("Routines", "undoDelete", e),
            );
          },
          redo: () => {
            setRoutines((prev) => prev.filter((r) => r.id !== id));
            setDeletedRoutines((prev) => {
              const redoDeleted: RoutineNode = {
                ...target,
                isDeleted: true,
                deletedAt: new Date().toISOString(),
              };
              return [redoDeleted, ...prev];
            });
            ds.softDeleteRoutine(id).catch((e) =>
              logServiceError("Routines", "redoDelete", e),
            );
          },
        });
      }

      return result;
    },
    [ds, push],
  );

  const loadDeletedRoutines = useCallback(async () => {
    try {
      const data = await ds.fetchDeletedRoutines();
      setDeletedRoutines(data);
    } catch (e) {
      logServiceError("Routines", "fetchDeleted", e);
    }
  }, [ds]);

  const restoreRoutine = useCallback(
    (id: string) => {
      setDeletedRoutines((prev) => {
        const target = prev.find((r) => r.id === id);
        if (target) {
          const restored: RoutineNode = {
            ...target,
            isDeleted: false,
            deletedAt: null,
          };
          setRoutines((r) => [...r, restored]);
        }
        return prev.filter((r) => r.id !== id);
      });
      ds.restoreRoutine(id).catch((e) =>
        logServiceError("Routines", "restore", e),
      );
    },
    [ds],
  );

  const permanentDeleteRoutine = useCallback(
    (id: string) => {
      setDeletedRoutines((prev) => prev.filter((r) => r.id !== id));
      ds.permanentDeleteRoutine(id).catch((e) =>
        logServiceError("Routines", "permanentDelete", e),
      );
    },
    [ds],
  );

  // ── Routine Groups ────────────────────────────────────────────────

  const createRoutineGroup = useCallback(
    async (
      name: string,
      color: string,
      frequencyType?: FrequencyType,
      frequencyDays?: number[],
      frequencyInterval?: number | null,
      frequencyStartDate?: string | null,
    ): Promise<RoutineGroup | null> => {
      const id = generateId("rgroup");
      const now = new Date().toISOString();
      const optimistic: RoutineGroup = {
        id,
        name,
        color,
        isVisible: true,
        order: routineGroups.length,
        frequencyType: frequencyType ?? "daily",
        frequencyDays: frequencyDays ?? [],
        frequencyInterval: frequencyInterval ?? null,
        frequencyStartDate: frequencyStartDate ?? null,
        createdAt: now,
        updatedAt: now,
      };
      setRoutineGroups((prev) => [...prev, optimistic]);
      try {
        const group = await ds.createRoutineGroup(
          id,
          name,
          color,
          frequencyType,
          frequencyDays,
          frequencyInterval,
          frequencyStartDate,
        );
        setRoutineGroups((prev) => prev.map((g) => (g.id === id ? group : g)));

        push("routine", {
          label: "createRoutineGroup",
          undo: async () => {
            setRoutineGroups((prev) => prev.filter((g) => g.id !== group.id));
            try {
              await ds.deleteRoutineGroup(group.id);
            } catch (e) {
              logServiceError("RoutineGroups", "undoCreate", e);
            }
          },
          redo: async () => {
            try {
              const restored = await ds.createRoutineGroup(
                id,
                name,
                color,
                frequencyType,
                frequencyDays,
                frequencyInterval,
                frequencyStartDate,
              );
              setRoutineGroups((prev) => [...prev, restored]);
            } catch (e) {
              logServiceError("RoutineGroups", "redoCreate", e);
            }
          },
        });

        return group;
      } catch (e) {
        logServiceError("RoutineGroups", "create", e);
        setRoutineGroups((prev) => prev.filter((g) => g.id !== id));
        return null;
      }
    },
    [ds, routineGroups.length, push],
  );

  const updateRoutineGroup = useCallback(
    async (
      id: string,
      updates: Partial<
        Pick<
          RoutineGroup,
          | "name"
          | "color"
          | "isVisible"
          | "order"
          | "frequencyType"
          | "frequencyDays"
          | "frequencyInterval"
          | "frequencyStartDate"
        >
      >,
    ) => {
      const prev = routineGroups.find((g) => g.id === id);
      setRoutineGroups((p) =>
        p.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      );
      try {
        await ds.updateRoutineGroup(id, updates);
      } catch (e) {
        logServiceError("RoutineGroups", "update", e);
      }

      if (prev) {
        const prevValues: typeof updates = {};
        for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
          (prevValues as Record<string, unknown>)[key] = prev[key];
        }
        push("routine", {
          label: "updateRoutineGroup",
          undo: async () => {
            setRoutineGroups((p) =>
              p.map((g) => (g.id === id ? { ...g, ...prevValues } : g)),
            );
            try {
              await ds.updateRoutineGroup(id, prevValues);
            } catch (e) {
              logServiceError("RoutineGroups", "undoUpdate", e);
            }
          },
          redo: async () => {
            setRoutineGroups((p) =>
              p.map((g) => (g.id === id ? { ...g, ...updates } : g)),
            );
            try {
              await ds.updateRoutineGroup(id, updates);
            } catch (e) {
              logServiceError("RoutineGroups", "redoUpdate", e);
            }
          },
        });
      }
    },
    [ds, routineGroups, push],
  );

  const deleteRoutineGroup = useCallback(
    async (id: string) => {
      const target = routineGroups.find((g) => g.id === id);
      setRoutineGroups((prev) => prev.filter((g) => g.id !== id));
      // Drop dangling memberships locally so a deleted group never lingers
      // in the assignment map (DB cascade removes the rows server-side).
      setAssignmentsMap((prev) => {
        const next = new Map<string, string[]>();
        for (const [routineId, groupIds] of prev) {
          const kept = groupIds.filter((g) => g !== id);
          if (kept.length > 0) next.set(routineId, kept);
        }
        return next;
      });
      try {
        await ds.deleteRoutineGroup(id);
      } catch (e) {
        logServiceError("RoutineGroups", "delete", e);
      }

      if (target) {
        push("routine", {
          label: "deleteRoutineGroup",
          undo: async () => {
            try {
              const restored = await ds.createRoutineGroup(
                target.id,
                target.name,
                target.color,
                target.frequencyType,
                target.frequencyDays,
                target.frequencyInterval,
                target.frequencyStartDate,
              );
              setRoutineGroups((prev) => [...prev, restored]);
            } catch (e) {
              logServiceError("RoutineGroups", "undoDelete", e);
            }
          },
          redo: async () => {
            setRoutineGroups((prev) => prev.filter((g) => g.id !== id));
            try {
              await ds.deleteRoutineGroup(id);
            } catch (e) {
              logServiceError("RoutineGroups", "redoDelete", e);
            }
          },
        });
      }
    },
    [ds, routineGroups, push],
  );

  // ── Routine ↔ Group membership ────────────────────────────────────

  const setGroupsForRoutine = useCallback(
    (routineId: string, groupIds: string[]) => {
      // Guard: assignmentsMap is empty during initial load — calls in
      // this window would persist [] and wipe genuine memberships
      // (ported from frontend useRoutineGroupAssignments).
      if (!assignmentsLoadedRef.current) {
        logServiceError(
          "RoutineGroupAssignments",
          "setGroups",
          new Error(
            `Blocked setGroupsForRoutine during initial load (routineId=${routineId})`,
          ),
        );
        return;
      }
      const prevGroupIds = assignmentsMap.get(routineId) ?? [];
      if (sameGroupSet(prevGroupIds, groupIds)) return;

      setAssignmentsMap((prev) => {
        const next = new Map(prev);
        if (groupIds.length === 0) {
          next.delete(routineId);
        } else {
          next.set(routineId, [...groupIds]);
        }
        return next;
      });
      ds.setGroupsForRoutine(routineId, groupIds).catch((e) =>
        logServiceError("RoutineGroupAssignments", "setGroups", e),
      );

      push("routine", {
        label: "setGroupsForRoutine",
        undo: () => {
          setAssignmentsMap((prev) => {
            const next = new Map(prev);
            if (prevGroupIds.length === 0) {
              next.delete(routineId);
            } else {
              next.set(routineId, [...prevGroupIds]);
            }
            return next;
          });
          ds.setGroupsForRoutine(routineId, prevGroupIds).catch((e) =>
            logServiceError("RoutineGroupAssignments", "undoSetGroups", e),
          );
        },
        redo: () => {
          setAssignmentsMap((prev) => {
            const next = new Map(prev);
            if (groupIds.length === 0) {
              next.delete(routineId);
            } else {
              next.set(routineId, [...groupIds]);
            }
            return next;
          });
          ds.setGroupsForRoutine(routineId, groupIds).catch((e) =>
            logServiceError("RoutineGroupAssignments", "redoSetGroups", e),
          );
        },
      });
    },
    [ds, assignmentsMap, push],
  );

  const getGroupIdsForRoutine = useCallback(
    (routineId: string): string[] => {
      return assignmentsMap.get(routineId) ?? [];
    },
    [assignmentsMap],
  );

  const getRoutineIdsForGroup = useCallback(
    (groupId: string): string[] => {
      const result: string[] = [];
      for (const [routineId, groupIds] of assignmentsMap) {
        if (groupIds.includes(groupId)) result.push(routineId);
      }
      return result;
    },
    [assignmentsMap],
  );

  return useMemo(
    () => ({
      routines,
      deletedRoutines,
      routineGroups,
      assignmentsMap,
      isLoading,
      error,
      createRoutine,
      updateRoutine,
      deleteRoutine,
      loadDeletedRoutines,
      restoreRoutine,
      permanentDeleteRoutine,
      createRoutineGroup,
      updateRoutineGroup,
      deleteRoutineGroup,
      setGroupsForRoutine,
      getGroupIdsForRoutine,
      getRoutineIdsForGroup,
    }),
    [
      routines,
      deletedRoutines,
      routineGroups,
      assignmentsMap,
      isLoading,
      error,
      createRoutine,
      updateRoutine,
      deleteRoutine,
      loadDeletedRoutines,
      restoreRoutine,
      permanentDeleteRoutine,
      createRoutineGroup,
      updateRoutineGroup,
      deleteRoutineGroup,
      setGroupsForRoutine,
      getGroupIdsForRoutine,
      getRoutineIdsForGroup,
    ],
  );
}
