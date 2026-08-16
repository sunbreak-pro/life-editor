import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  formatDateKey,
  useSyncDomains,
  type DataService,
  type NoteNode,
  type ScheduleItem,
  type TimerSession,
  type TodoNode,
  type WikiTagConnectionUnified,
} from "@life-editor/shared";

/*
 * Briefing's READ half (#892 — split out of useBriefingData, zero behavior
 * change). Owns the fetched state and nothing else: no derivation, no writes.
 *
 * Data sources (all EXISTING APIs — Step 1 shipped with zero DDL):
 *   - fetchScheduleItemsByDate(today)     → 今日の予定
 *   - fetchTodoTree()                     → 今日の Todo / 持ち越し / trend widget
 *   - fetchTimerSessions()                → streak + work/break widgets
 *   - getDailyByDateUnified(today)        → the "Briefing"/「朝刊」 section
 *     (extractBriefing convention — written later by MCP write_briefing,
 *     or by hand in the Daily editor today)
 *   - listNotesUnified() + listAllTagConnections()
 *     → todo↔note item links resolved to note titles =「その目的」chips
 *       (read-only Goal links; the unified graph already supports them)
 *   - fetchScheduleItemsByDate(tomorrow)  →「今後の予定」's second half
 *
 * Re-fetches on every Realtime bump of a domain it reads (same pattern as
 * MaterialsCountsBridge) so a briefing written by Claude via MCP appears
 * without a reload. Sits inside SyncProvider (MainScreen mounts the screen
 * there).
 *
 * The setters are part of the returned surface on purpose: the write half
 * folds each result straight into this state so the paper updates without
 * waiting for the Realtime bump, and a delete's undo command puts the row
 * back the same way.
 */

/** The "YYYY-MM-DD" key of the day after `key` (local-time arithmetic). */
function nextDateKey(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return formatDateKey(d);
}

export interface BriefingFetchState {
  loading: boolean;
  tomorrowKey: string;
  scheduleItems: ScheduleItem[];
  setScheduleItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  tomorrowItems: ScheduleItem[];
  todoNodes: TodoNode[];
  setTodoNodes: Dispatch<SetStateAction<TodoNode[]>>;
  sessions: TimerSession[];
  dailyContent: string | null;
  setDailyContent: Dispatch<SetStateAction<string | null>>;
  notes: NoteNode[];
  connections: WikiTagConnectionUnified[];
  setConnections: Dispatch<SetStateAction<WikiTagConnectionUnified[]>>;
}

export function useBriefingFetch(
  ds: DataService,
  todayKey: string,
): BriefingFetchState {
  const syncVersion = useSyncDomains(
    "schedule",
    "todos",
    "timer",
    "dailies",
    "notes",
    "tags",
  );

  const [loading, setLoading] = useState(true);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [tomorrowItems, setTomorrowItems] = useState<ScheduleItem[]>([]);
  const [todoNodes, setTodoNodes] = useState<TodoNode[]>([]);
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [dailyContent, setDailyContent] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [connections, setConnections] = useState<WikiTagConnectionUnified[]>(
    [],
  );

  const tomorrowKey = nextDateKey(todayKey);

  useEffect(() => {
    // loading starts true (useState) so the initial fetch shows the skeleton;
    // re-fetches on syncVersion bumps keep the (still-valid) paper visible
    // until the fresh data resolves (same pattern as WorkScreen's todo fetch).
    let cancelled = false;
    void Promise.allSettled([
      ds.fetchScheduleItemsByDate(todayKey),
      ds.fetchTodoTree(),
      ds.fetchTimerSessions(),
      ds.getDailyByDateUnified(todayKey),
      ds.listNotesUnified(),
      ds.listAllTagConnections(),
      ds.fetchScheduleItemsByDate(tomorrowKey),
    ]).then((results) => {
      if (cancelled) return;
      const [sched, todos, sess, daily, allNotes, links, tomorrow] = results;
      if (sched.status === "fulfilled") setScheduleItems(sched.value);
      if (todos.status === "fulfilled") setTodoNodes(todos.value);
      if (sess.status === "fulfilled") setSessions(sess.value);
      if (daily.status === "fulfilled")
        setDailyContent(daily.value?.content ?? null);
      if (allNotes.status === "fulfilled") setNotes(allNotes.value);
      if (links.status === "fulfilled") setConnections(links.value);
      if (tomorrow.status === "fulfilled") setTomorrowItems(tomorrow.value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ds, todayKey, tomorrowKey, syncVersion]);

  return {
    loading,
    tomorrowKey,
    scheduleItems,
    setScheduleItems,
    tomorrowItems,
    todoNodes,
    setTodoNodes,
    sessions,
    dailyContent,
    setDailyContent,
    notes,
    connections,
    setConnections,
  };
}
