import { useCallback, useEffect, useRef } from "react";
import {
  useSyncDomains,
  type DataService,
  type MaterialsCounts,
} from "@life-editor/shared";

/*
 * Headless Materials badge bridge (plan 2026-07-08 Step 4).
 *
 * The Materials tab count badges (Tasks unfinished / Notes / Daily) need
 * numbers for ALL surfaces at once, but each surface's Provider is mounted
 * per-tab inside the section body — so the shell can't read the counts from
 * context (they only exist while that tab is active). This tiny child sits
 * inside SyncProvider, asks the injected DataService for the three counts
 * (hosts may — CLAUDE.md §6.4), and reports them up to MainScreen. Renders
 * nothing (like GlobalShortcuts / AudioChimeBridge).
 *
 * #499 — one effect per domain, not one effect for all three. This bridge is
 * mounted app-wide, so a single combined effect made it the last thing turning
 * every note keystroke into a task + note + daily re-pull: exactly the
 * cross-role traffic the domain split removes everywhere else. Each count now
 * refetches only when its own domain moves, and the last-known numbers live in
 * refs so the badges stay whole across a partial refresh.
 *
 * #511 — count reads, not list reads. Each domain used to pull its whole
 * collection (every column of every row) so the bridge could call `.length`
 * on it; now the DataService returns just the number and the row bodies never
 * cross the wire. The counting rules moved with it — see
 * shared/src/materials/materialsCounts.ts for what each number means.
 */
export function MaterialsCountsBridge({
  dataService: ds,
  onCounts,
}: {
  dataService: DataService;
  onCounts: (counts: MaterialsCounts) => void;
}) {
  const tasksVersion = useSyncDomains("todos");
  const notesVersion = useSyncDomains("notes");
  const dailiesVersion = useSyncDomains("dailies");

  const countsRef = useRef<MaterialsCounts>({ tasks: 0, notes: 0, daily: 0 });
  // Which counts have arrived at least once. Publishing before all three have
  // landed would flash a real badge next to two zeros that only mean "not
  // fetched yet" — worse than showing no badges for another moment.
  const arrivedRef = useRef({ tasks: false, notes: false, daily: false });

  const report = useCallback(() => {
    const arrived = arrivedRef.current;
    if (!arrived.tasks || !arrived.notes || !arrived.daily) return;
    onCounts({ ...countsRef.current });
  }, [onCounts]);

  useEffect(() => {
    let cancelled = false;
    // A failed refetch keeps the last known count (transient network / Realtime
    // blip) rather than flashing that badge back to zero.
    void ds
      .countUnfinishedTodos()
      .then((count) => {
        if (cancelled) return;
        countsRef.current.tasks = count;
        arrivedRef.current.tasks = true;
        report();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ds, tasksVersion, report]);

  useEffect(() => {
    let cancelled = false;
    void ds
      .countLiveNotes()
      .then((count) => {
        if (cancelled) return;
        countsRef.current.notes = count;
        arrivedRef.current.notes = true;
        report();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ds, notesVersion, report]);

  useEffect(() => {
    let cancelled = false;
    void ds
      .countLiveDailies()
      .then((count) => {
        if (cancelled) return;
        countsRef.current.daily = count;
        arrivedRef.current.daily = true;
        report();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ds, dailiesVersion, report]);

  return null;
}
