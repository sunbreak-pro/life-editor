import type { DataService } from "@life-editor/shared";

/*
 * Web Routine→schedule_items generator trigger (S4-5) — TEMPORARILY
 * NO-OP while the Schedule data services are stubbed for the DU-A/B
 * cutover (2026-05-23).
 *
 * Why disabled
 * ============
 * The original implementation (kept verbatim in git history;
 * `git show HEAD~1 -- web/src/schedule/RoutineScheduleSync.tsx`) wires
 * the shared `useScheduleItemsRoutineSync` generator to a useEffect that
 * fires on `[date, routines, groupForRoutine, ensure]` changes. With the
 * DU-C/D pending stubs in place
 * (`shared/src/services/SupabaseDataService.ts` —
 * `SupabaseScheduleItemsService` / `SupabaseRoutinesService` /
 * `SupabaseRoutineGroupsService`) it triggers a render-tight infinite
 * loop the moment ANY routine state changes:
 *
 *   1. User clicks "Add" in ScheduleView → useRoutinesAPI.createRoutine
 *      pushes an optimistic row → `routines` array gets a new reference.
 *   2. RoutineScheduleSync's effect re-fires →
 *      `generator.ensureRoutineItemsForDate(date, routines, ...)`.
 *   3. `ensureRoutineItemsForDate` (useScheduleItemsRoutineSync.ts:85)
 *      reads existing items via `ds.fetchScheduleItemsByDate` — the
 *      stub returns []. `diffRoutineScheduleItems([], routines, date)`
 *      then decides "create one schedule_item per routine for today" →
 *      `toCreate.length > 0`.
 *   4. `ds.bulkCreateScheduleItems(toCreate)` — the stub throws. The
 *      try/catch in useScheduleItemsRoutineSync.ts:110-114 swallows
 *      the throw and logs `[ScheduleItems] bulkCreate: ...`.
 *   5. **The landmine**: the `if (toCreate.length > 0 || toUpdate.length
 *      > 0) notifyChanged()` block lives OUTSIDE the try/catch
 *      (useScheduleItemsRoutineSync.ts:116-118) so `notifyChanged()`
 *      fires regardless of whether the bulkCreate actually succeeded.
 *   6. `notifyChanged` is wired to `loadDate(date)` (line 51-52 below in
 *      the original) → `ds.fetchScheduleItemsByDateAll(date)` (stub
 *      returns a *fresh* `[]` every call) → `setItems([])` →
 *      ScheduleItemsContext value gets a new reference → consumers
 *      re-render → useEffect re-fires → goto step 3, forever.
 *
 * The user observes "[ScheduleItems] bulkCreate: createScheduleItem:
 * schedule_items pending DU-C/D rewrite ..." flooding the console
 * and the CPU pinned. The original `RoutineGroups` 2-line warning
 * the user reported is unrelated (it is the normal optimistic-add +
 * catch-revert path in useRoutinesAPI.createRoutineGroup; the second
 * line is React 19 StrictMode's dev-mode double-invocation of the
 * setState updater, which IS expected and benign).
 *
 * Restoring this file
 * ===================
 * When DU-C completes and `SupabaseRoutinesService` +
 * `SupabaseScheduleItemsService` are real items_meta + payload
 * implementations, restore the original body (effect that mounts the
 * generator and re-fires on `[date, routines, groupForRoutine,
 * ensure]`). Consider hardening
 * `useScheduleItemsRoutineSync.ensureRoutineItemsForDate` so
 * `notifyChanged()` only fires when at least one write actually
 * succeeded — moving the call INSIDE the try (after `await
 * bulkCreateScheduleItems(...)` returns without throwing) closes the
 * same landmine for any future stubbed dependency.
 *
 * Until then this component renders nothing and consumes no
 * subscriptions — the `dataService` prop is intentionally unused.
 */
export function RoutineScheduleSync({
  dataService,
}: {
  dataService: DataService;
}) {
  void dataService;
  return null;
}
