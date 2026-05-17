import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { CalendarTag } from "../types/calendarTag";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { useSyncContext } from "./useSyncContext";

/**
 * Behaviour-preserving port of the Tauri CalendarTags trio
 * (frontend/src/hooks/useCalendarTags.ts + useCalendarTagAssignments.ts)
 * consolidated into one shared API hook — same shape as useRoutinesAPI /
 * useScheduleItemsAPI. Host dependencies are injected, not imported
 * (CLAUDE.md §6.4): `getDataService()` singleton → `options.dataService`.
 *
 * Sync classes (S4-0):
 * - calendar_tag_definitions: VERSIONED but FULL-REPLICATE (V65 sync
 *   columns are present yet the table is OUTSIDE VERSIONED_TABLES — see
 *   the plan S8 申し送り item 5 / S4-1 "ctd full-replicate" note). It is
 *   NOT a delta table; `version` exists but does not classify it for
 *   delta sync. ctd.id is `integer generated always as identity`
 *   (CalendarTag.id = number) — a create OMITS id (the DataService layer
 *   handles that; this hook never sends an id).
 * - calendar_tag_assignments: RELATION, physical-delete, NO version /
 *   soft-delete. UNIQUE(entity_type, entity_id) = strictly 1:1.
 *
 * CalendarTags is a Mobile 省略 Provider (CLAUDE.md §2 — iOS/Android
 * omit it). The Provider therefore ships an Optional variant
 * (`useCalendarTagsContextOptional`) so shared components that read it
 * `if (!ctx) return null` on Mobile (vision/coding-principles.md §4).
 *
 * Scope (S4-6): faithful port only — no new CalendarTag features (plan
 * §スコープ外). The schedule_item physical-delete → cta orphan cleanup
 * (sync-auditor High-2) lives in the DataService layer, not here (same
 * single-layer rule as Issue 011 / 020 — a duplicate guard in the hook
 * would diverge from the Tauri repository contract).
 */

export type CalendarTagEntityType = "task" | "schedule_item";

const entityKey = (type: CalendarTagEntityType, id: string): string =>
  `${type}:${id}`;

export interface UseCalendarTagsAPIOptions {
  dataService: DataService;
}

export function useCalendarTagsAPI(options: UseCalendarTagsAPIOptions) {
  const ds = options.dataService;
  const { syncVersion } = useSyncContext();

  const [tags, setTags] = useState<CalendarTag[]>([]);
  // Map<entityKey, tagId>. 1:1 — each entity has at most one tag.
  const [assignmentsMap, setAssignmentsMap] = useState<Map<string, number>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tagsRef = useRef(tags);
  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);

  const assignmentsMapRef = useRef(assignmentsMap);
  useEffect(() => {
    assignmentsMapRef.current = assignmentsMap;
  }, [assignmentsMap]);

  // Initial load + every syncVersion bump (mirrors routines/notes). The
  // definitions and assignments reads run independently so a failure in
  // one does not block the other.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const list = await ds.fetchCalendarTags();
        if (cancelled) return;
        setTags(list);
      } catch (e) {
        logServiceError("CalendarTags", "fetch", e);
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load calendar tags",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    (async () => {
      try {
        const data = await ds.fetchAllCalendarTagAssignments();
        if (cancelled) return;
        const map = new Map<string, number>();
        for (const { entityType, entityId, tagId } of data) {
          map.set(entityKey(entityType, entityId), tagId);
        }
        setAssignmentsMap(map);
      } catch (e) {
        logServiceError("CalendarTagAssignments", "fetch", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  // ── Tag definitions ────────────────────────────────────────────────

  // ctd.id is server-assigned (integer identity); the optimistic row is
  // skipped — the create resolves with the real numeric id (otherwise an
  // optimistic temp id would collide with the number contract).
  const createCalendarTag = useCallback(
    async (name: string, color: string): Promise<CalendarTag | null> => {
      try {
        const tag = await ds.createCalendarTag(name, color);
        setTags((prev) => [...prev, tag]);
        return tag;
      } catch (e) {
        logServiceError("CalendarTags", "create", e);
        return null;
      }
    },
    [ds],
  );

  const updateCalendarTag = useCallback(
    (
      id: number,
      updates: Partial<
        Pick<CalendarTag, "name" | "color" | "textColor" | "order">
      >,
    ) => {
      setTags((p) => p.map((t) => (t.id === id ? { ...t, ...updates } : t)));
      ds.updateCalendarTag(id, updates)
        .then((saved) =>
          setTags((prev) => prev.map((t) => (t.id === id ? saved : t))),
        )
        .catch((e) => logServiceError("CalendarTags", "update", e));
    },
    [ds],
  );

  // Physical delete (S4-0: ctd omits is_deleted — full-replicate). The
  // DataService cascade also clears every cta row for this tag + bumps
  // the parent entities; mirror that locally so a deleted tag never
  // lingers in the assignment map.
  const deleteCalendarTag = useCallback(
    (id: number) => {
      setTags((prev) => prev.filter((t) => t.id !== id));
      setAssignmentsMap((prev) => {
        const next = new Map<string, number>();
        for (const [key, tagId] of prev) {
          if (tagId !== id) next.set(key, tagId);
        }
        return next;
      });
      ds.deleteCalendarTag(id).catch((e) =>
        logServiceError("CalendarTags", "delete", e),
      );
    },
    [ds],
  );

  // ── Assignments (1:1) ──────────────────────────────────────────────

  const setTagForEntity = useCallback(
    (
      entityType: CalendarTagEntityType,
      entityId: string,
      tagId: number | null,
    ) => {
      const key = entityKey(entityType, entityId);
      setAssignmentsMap((prev) => {
        const next = new Map(prev);
        if (tagId == null) {
          next.delete(key);
        } else {
          next.set(key, tagId);
        }
        return next;
      });
      ds.setTagForEntity(entityType, entityId, tagId).catch((e) =>
        logServiceError("CalendarTagAssignments", "setTag", e),
      );
    },
    [ds],
  );

  const getTagForEntity = useCallback(
    (entityType: CalendarTagEntityType, entityId: string): number | null => {
      return assignmentsMap.get(entityKey(entityType, entityId)) ?? null;
    },
    [assignmentsMap],
  );

  return useMemo(
    () => ({
      tags,
      assignmentsMap,
      isLoading,
      error,
      createCalendarTag,
      updateCalendarTag,
      deleteCalendarTag,
      setTagForEntity,
      getTagForEntity,
    }),
    [
      tags,
      assignmentsMap,
      isLoading,
      error,
      createCalendarTag,
      updateCalendarTag,
      deleteCalendarTag,
      setTagForEntity,
      getTagForEntity,
    ],
  );
}
