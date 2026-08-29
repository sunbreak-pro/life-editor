import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  formatDateKey,
  useDomainLoad,
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
 *     (follows the `sessions` domain since #993)
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
 * STALE-WHILE-REVALIDATE (#1157). The seven reads used to start from empty
 * state on every mount, and Briefing is the DEFAULT landing screen, so the
 * eight-row skeleton was the first thing shown on every return to it
 * (#1038 §3.1). The load now runs through `useDomainLoad` under the
 * `briefingPaper` slot: the previous paper is replayed before paint and the
 * reads become a background revalidate.
 *
 * `Promise.allSettled` is kept rather than `Promise.all` — one failing source
 * must not blank the other six. That is also why `load` cannot reject.
 *
 * WHAT GETS STORED IS ALWAYS A WHOLE PAPER, never the delta. A failed slot is
 * filled from `lastPaperRef` (what is currently on screen) before `load`
 * returns, so a revalidate in which some reads throw cannot overwrite a good
 * snapshot with an almost-empty one. It matters because `useDomainLoad` stores
 * whatever a non-rejecting `load` resolves with, and a mount that finds a
 * snapshot starts out already-settled: a stored delta would replay onto FRESH
 * mount state, and the paper would open with the gate down over empty blocks —
 * a confident "nothing today" that is only a dropped connection. The editable
 * 宣言 field is right there, and typing into it merges over the stored one.
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

/** One load's worth of paper — every slot present, see the header. */
interface BriefingPaper {
  scheduleItems: ScheduleItem[];
  todoNodes: TodoNode[];
  sessions: TimerSession[];
  dailyContent: string | null;
  notes: NoteNode[];
  connections: WikiTagConnectionUnified[];
  tomorrowItems: ScheduleItem[];
}

/** What an unread paper looks like — the same values the state starts on. */
const BLANK_PAPER: BriefingPaper = {
  scheduleItems: [],
  todoNodes: [],
  sessions: [],
  dailyContent: null,
  notes: [],
  connections: [],
  tomorrowItems: [],
};

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
    // #993: the session LOG, not the timer settings — Briefing reads
    // fetchTimerSessions and nothing else from the timer family, so it follows
    // the `sessions` counter (declaring `timer` here also woke it on every
    // settings edit, and hid that TimerProvider was waking on every session).
    "sessions",
    "dailies",
    "notes",
    "tags",
  );

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

  // The paper currently on screen, so a read that throws can be answered with
  // what it last said instead of with a hole. Mirrored from `apply`, which is
  // the one place a paper becomes "what is on screen".
  const lastPaperRef = useRef<BriefingPaper>(BLANK_PAPER);

  const { isLoading: loading } = useDomainLoad<BriefingPaper>({
    domain: "Briefing",
    dataService: ds,
    version: syncVersion,
    // tomorrowKey is derived from todayKey, so one scalar anchors both reads.
    anchor: todayKey,
    snapshotKey: "briefingPaper",
    // A Realtime bump must not swap a perfectly valid paper for the skeleton:
    // Realtime echoes this tab's OWN writes back, so ticking a todo would
    // blink the whole paper (useNotesUnifiedAPI's reasoning, #1101).
    refetchReportsLoading: false,
    load: async (service) => {
      const results = await Promise.allSettled([
        service.fetchScheduleItemsByDate(todayKey),
        service.fetchTodoTree(),
        service.fetchTimerSessions(),
        service.getDailyByDateUnified(todayKey),
        service.listNotesUnified(),
        service.listAllTagConnections(),
        service.fetchScheduleItemsByDate(tomorrowKey),
      ]);
      const [sched, todos, sess, daily, allNotes, links, tomorrow] = results;
      // A read that threw keeps whatever that block is showing. Note the
      // asymmetry on the daily: a day with no daily row RESOLVES to null, and
      // that null is a result — only a rejection falls back.
      const previous = lastPaperRef.current;
      return {
        scheduleItems:
          sched.status === "fulfilled" ? sched.value : previous.scheduleItems,
        todoNodes:
          todos.status === "fulfilled" ? todos.value : previous.todoNodes,
        sessions: sess.status === "fulfilled" ? sess.value : previous.sessions,
        dailyContent:
          daily.status === "fulfilled"
            ? (daily.value?.content ?? null)
            : previous.dailyContent,
        notes: allNotes.status === "fulfilled" ? allNotes.value : previous.notes,
        connections:
          links.status === "fulfilled" ? links.value : previous.connections,
        tomorrowItems:
          tomorrow.status === "fulfilled"
            ? tomorrow.value
            : previous.tomorrowItems,
      };
    },
    apply: (paper) => {
      lastPaperRef.current = paper;
      setScheduleItems(paper.scheduleItems);
      setTodoNodes(paper.todoNodes);
      setSessions(paper.sessions);
      setDailyContent(paper.dailyContent);
      setNotes(paper.notes);
      setConnections(paper.connections);
      setTomorrowItems(paper.tomorrowItems);
    },
    // Unreachable in practice (`load` swallows every rejection through
    // allSettled) and unread — the paper has no error surface, it just shows
    // whatever it last had.
    fallbackMessage: "Failed to load the briefing",
  });

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
