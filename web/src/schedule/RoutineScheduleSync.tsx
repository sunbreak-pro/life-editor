import { useEffect, useMemo } from "react";
import {
  useRoutineContext,
  useScheduleItemsContext,
  useScheduleItemsRoutineSync,
  buildGroupForRoutineMap,
  type DataService,
} from "@life-editor/shared";

/*
 * Web Routine→schedule_items generator trigger (S4-5; restored DU-C-6).
 *
 * Headless: renders nothing. It is the host glue between the shared
 * generator hook and the two Schedule Providers. Mounted INSIDE
 * RoutineProvider + ScheduleItemsProvider (CLAUDE.md §6.2 trio order),
 * so it can read the live routine set and the anchored date. The
 * DataService is the SAME singleton MainScreen injects into every
 * Provider (prop, not a module singleton — CLAUDE.md §6.4 DI).
 *
 * History
 * =======
 * 2026-05-23 (7fd7100): no-op'd to break an infinite render loop that
 *   triggered while SupabaseScheduleItemsService was a stub. Loop path:
 *   createRoutine optimistic → effect → ensure → bulkCreate STUB throws
 *   → catch swallows → OUTSIDE-try `notifyChanged()` STILL fires →
 *   loadDate → setItems(new [] ref) → context value new ref → re-render
 *   → effect re-fires → loop forever. See file header in the 7fd7100
 *   commit + chat-main HISTORY entry "Schedule 無限ループ修正".
 *
 * 2026-05-24 (DU-C-6): SupabaseScheduleItemsService is now real (DU-C-5)
 *   so the stub-throw landmine is gone. Restored the original effect
 *   wiring. The matching hardening in `useScheduleItemsRoutineSync.ts`
 *   moves `notifyChanged()` INSIDE the bulkCreate try so a future
 *   write-failure cannot re-arm the same loop.
 *
 * Trigger policy (mirrors the Tauri host, which called
 * ensureRoutineItemsForDate on the active day): whenever the anchored
 * date or the routine inputs change, materialise that day's rows.
 * `onChanged` re-reads the date via `loadDate` for immediate same-domain
 * refresh. Schedule rows persist as role='event' into items_meta +
 * events_payload, both of which ARE in S8 REALTIME_TABLES — so a generated
 * row would also surface on its own once Realtime bumps `syncVersion`
 * (after the ~300ms debounce + round-trip). The explicit `loadDate` is a
 * local optimisation that reflects the write immediately without waiting
 * for that Realtime latency; it is not a compensation for a missing
 * subscription.
 *
 * Idempotency: rapid date flips can fire many ensure passes. Duplicate
 * (routine_id, date) writes are absorbed by the 0008 partial UNIQUE
 * (routine_item_id, source_date) WHERE is_deleted_cache=false + the
 * DU-C-5 SupabaseScheduleItemsService.bulkCreateScheduleItems upsert
 * with onConflict ignoreDuplicates (Issue 011) — the generator never
 * accumulates duplicates even under month-flip spam.
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
  // ignores it unless a routine's frequencyType === "group". Shared helper
  // (#296) so the Calendar host's range-ensure resolves the exact same map.
  const groupForRoutine = useMemo(
    () =>
      buildGroupForRoutineMap(routines, routineGroups, getGroupIdsForRoutine),
    [routines, routineGroups, getGroupIdsForRoutine],
  );

  const ensure = generator.ensureRoutineItemsForDate;

  useEffect(() => {
    if (!date) return;
    if (routines.length === 0) return;
    void ensure(date, routines, groupForRoutine);
  }, [date, routines, groupForRoutine, ensure]);

  return null;
}
