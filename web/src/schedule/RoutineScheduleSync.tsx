import { useEffect, useMemo } from "react";
import {
  useRoutineContext,
  useScheduleItemsContext,
  useScheduleItemsRoutineSync,
  type DataService,
  type RoutineGroup,
} from "@life-editor/shared";

/*
 * Web Routine→schedule_items generator trigger (S4-5).
 *
 * Headless: renders nothing. It is the host glue between the shared
 * generator hook and the two Schedule Providers. Mounted INSIDE
 * RoutineProvider + ScheduleItemsProvider (CLAUDE.md §6.2 trio order),
 * so it can read the live routine set and the anchored date. The
 * DataService is the SAME singleton MainScreen injects into every
 * Provider (prop, not a module singleton — CLAUDE.md §6.4 DI).
 *
 * Trigger policy (mirrors the Tauri host, which called
 * ensureRoutineItemsForDate on the active day): whenever the anchored
 * date or the routine inputs change, materialise that day's rows.
 * `onChanged` re-reads the date via `loadDate` because the web Sync
 * Context `syncVersion` is static (no-op until S8 Realtime) — without
 * this the generated rows would not surface until a manual reload.
 *
 * Idempotency: rapid date flips can fire many ensure passes. Duplicate
 * (routine_id, date) writes are absorbed by the migration-0006 partial
 * UNIQUE + the S4-2 createScheduleItem live guard (Issue 011) — the
 * generator never accumulates duplicates even under month-flip spam.
 * This is a QA observation point (plan §S4-0: observe generation count
 * under rapid month flips).
 *
 * The generator only WRITES through the DataService and signals a
 * re-read; it never re-implements the is_deleted filter or a second
 * (routine_id,date) guard (Issue 017 (a)/(c) / Issue 020 stay in the
 * S4-2 DataService layer — no hook-level read-then-write is added).
 */

export function RoutineScheduleSync({
  dataService,
}: {
  dataService: DataService;
}) {
  const { routines, routineGroups, getGroupIdsForRoutine } =
    useRoutineContext();
  const { date, loadDate } = useScheduleItemsContext();

  const generator = useScheduleItemsRoutineSync({
    dataService,
    onChanged: () => {
      if (date) void loadDate(date);
    },
  });

  // Resolve the `group` frequency: Map<routineId, RoutineGroup[]> built
  // from the membership map + the loaded groups. shouldCreateRoutineItem
  // ignores it unless a routine's frequencyType === "group".
  const groupForRoutine = useMemo(() => {
    const byId = new Map<string, RoutineGroup>(
      routineGroups.map((g) => [g.id, g]),
    );
    const map = new Map<string, RoutineGroup[]>();
    for (const r of routines) {
      if (r.frequencyType !== "group") continue;
      const groups = getGroupIdsForRoutine(r.id)
        .map((gid) => byId.get(gid))
        .filter((g): g is RoutineGroup => g !== undefined);
      if (groups.length > 0) map.set(r.id, groups);
    }
    return map;
  }, [routines, routineGroups, getGroupIdsForRoutine]);

  const ensure = generator.ensureRoutineItemsForDate;

  useEffect(() => {
    if (!date) return;
    if (routines.length === 0) return;
    void ensure(date, routines, groupForRoutine);
  }, [date, routines, groupForRoutine, ensure]);

  return null;
}
