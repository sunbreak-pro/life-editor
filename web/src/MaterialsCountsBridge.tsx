import { useCallback, useEffect, useRef } from "react";
import {
  useSyncDomains,
  computeMaterialsCounts,
  type DataService,
  type MaterialsCounts,
  type TaskNode,
  type NoteNode,
  type DailyNode,
} from "@life-editor/shared";

/*
 * Headless Materials badge bridge (plan 2026-07-08 Step 4).
 *
 * The Materials tab count badges (Tasks unfinished / Notes / Daily) need
 * numbers for ALL surfaces at once, but each surface's Provider is mounted
 * per-tab inside the section body — so the shell can't read the counts from
 * context (they only exist while that tab is active). This tiny child sits
 * inside SyncProvider, fetches the lists directly via the injected DataService
 * (hosts may — CLAUDE.md §6.4), derives the counts with the pure shared
 * helper, and reports them up to MainScreen. Renders nothing (like
 * GlobalShortcuts / AudioChimeBridge).
 *
 * #499 — one effect per domain, not one effect for all three. This bridge is
 * mounted app-wide, so a single combined effect made it the last thing turning
 * every note keystroke into a task + note + daily re-pull: exactly the
 * cross-role traffic the domain split removes everywhere else. Each list now
 * refetches only when its own domain moves, and the last-known lists live in
 * refs so the counts stay whole across a partial refresh.
 */
export function MaterialsCountsBridge({
  dataService: ds,
  onCounts,
}: {
  dataService: DataService;
  onCounts: (counts: MaterialsCounts) => void;
}) {
  const tasksVersion = useSyncDomains("tasks");
  const notesVersion = useSyncDomains("notes");
  const dailiesVersion = useSyncDomains("dailies");

  const nodesRef = useRef<readonly TaskNode[]>([]);
  const notesRef = useRef<readonly NoteNode[]>([]);
  const dailiesRef = useRef<readonly DailyNode[]>([]);
  // Which lists have arrived at least once. Publishing before all three have
  // landed would flash a real badge next to two zeros that only mean "not
  // fetched yet" — worse than showing no badges for another moment.
  const arrivedRef = useRef({ tasks: false, notes: false, dailies: false });

  const report = useCallback(() => {
    const arrived = arrivedRef.current;
    if (!arrived.tasks || !arrived.notes || !arrived.dailies) return;
    onCounts(
      computeMaterialsCounts({
        nodes: nodesRef.current,
        notes: notesRef.current,
        dailies: dailiesRef.current,
      }),
    );
  }, [onCounts]);

  useEffect(() => {
    let cancelled = false;
    // A failed refetch keeps the last known list (transient network / Realtime
    // blip) rather than flashing that badge back to zero.
    void ds
      .fetchTaskTree()
      .then((nodes) => {
        if (cancelled) return;
        nodesRef.current = nodes;
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
      .listNotesUnified()
      .then((notes) => {
        if (cancelled) return;
        notesRef.current = notes;
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
      .listDailiesUnified()
      .then((dailies) => {
        if (cancelled) return;
        dailiesRef.current = dailies;
        arrivedRef.current.dailies = true;
        report();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ds, dailiesVersion, report]);

  return null;
}
