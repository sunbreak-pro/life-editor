import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefingView,
  extractBriefing,
  todayDateKey,
  useSyncContext,
  useTranslation,
  type BriefingCarryoverEntry,
  type BriefingData,
  type BriefingScheduleEntry,
  type BriefingTaskEntry,
  type DataService,
  type NoteNode,
  type ScheduleItem,
  type TaskNode,
  type TimerSession,
  type WikiTagConnectionUnified,
} from "@life-editor/shared";

/*
 * Briefing host shell (Briefing plan Step 1). Owns data fetching (it may
 * call the injected DataService — §6.4) and i18n `t`, then injects the
 * aggregated BriefingData + labels into the pure shared <BriefingView>.
 *
 * Data sources (all EXISTING APIs — Step 1 ships with zero DDL):
 *   - fetchScheduleItemsByDate(today)     → 今日の予定
 *   - fetchTaskTree()                     → 今日の Todo / 持ち越し / trend widget
 *   - fetchTimerSessions()                → streak + work/break widgets
 *   - getDailyByDateUnified(today)        → the "Briefing"/「朝刊」 section
 *     (extractBriefing convention — written later by MCP write_briefing,
 *     or by hand in the Daily editor today)
 *   - listNotesUnified() + listAllTagConnections()
 *     → task↔note item links resolved to note titles =「その目的」chips
 *       (read-only Goal links; the unified graph already supports them)
 *
 * Re-fetches on every Realtime `syncVersion` bump (same pattern as
 * MaterialsCountsBridge) so a briefing written by Claude via MCP appears
 * without a reload. Sits inside SyncProvider (MainScreen mounts it there).
 */

interface BriefingScreenProps {
  dataService: DataService;
}

/** Lexical "YYYY-MM-DD" from a scheduledAt-ish string ("YYYY-MM-DD…"). */
function dateKeyOf(value: string | undefined): string | null {
  if (value === undefined || value.length < 10) return null;
  return value.slice(0, 10);
}

/** Whole-day difference between two "YYYY-MM-DD" keys (b - a). */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function BriefingScreen({
  dataService: ds,
}: BriefingScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const { syncVersion } = useSyncContext();

  const [loading, setLoading] = useState(true);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [taskNodes, setTaskNodes] = useState<TaskNode[]>([]);
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [dailyContent, setDailyContent] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [connections, setConnections] = useState<WikiTagConnectionUnified[]>(
    [],
  );

  const todayKey = todayDateKey();

  useEffect(() => {
    // loading starts true (useState) so the initial fetch shows the skeleton;
    // re-fetches on syncVersion bumps keep the (still-valid) paper visible
    // until the fresh data resolves (same pattern as WorkScreen's task fetch).
    let cancelled = false;
    void Promise.allSettled([
      ds.fetchScheduleItemsByDate(todayKey),
      ds.fetchTaskTree(),
      ds.fetchTimerSessions(),
      ds.getDailyByDateUnified(todayKey),
      ds.listNotesUnified(),
      ds.listAllTagConnections(),
    ]).then((results) => {
      if (cancelled) return;
      const [sched, tasks, sess, daily, allNotes, links] = results;
      if (sched.status === "fulfilled") setScheduleItems(sched.value);
      if (tasks.status === "fulfilled") setTaskNodes(tasks.value);
      if (sess.status === "fulfilled") setSessions(sess.value);
      if (daily.status === "fulfilled")
        setDailyContent(daily.value?.content ?? null);
      if (allNotes.status === "fulfilled") setNotes(allNotes.value);
      if (links.status === "fulfilled") setConnections(links.value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ds, todayKey, syncVersion]);

  // ── Aggregation (host-side; the view stays pure) ─────────────────────
  const noteTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of notes) {
      if (n.isDeleted !== true) map.set(n.id, n.title || "");
    }
    return map;
  }, [notes]);

  /** Titles of notes linked to an item (either link direction). */
  const purposesOf = useCallback(
    (itemId: string): string[] => {
      const titles: string[] = [];
      for (const link of connections) {
        const other =
          link.fromItemId === itemId
            ? link.toItemId
            : link.toItemId === itemId
              ? link.fromItemId
              : null;
        if (other === null) continue;
        const title = noteTitleById.get(other);
        if (title !== undefined && title !== "") titles.push(title);
      }
      return titles;
    },
    [connections, noteTitleById],
  );

  const schedule = useMemo<BriefingScheduleEntry[]>(
    () =>
      scheduleItems
        .filter((s) => s.isDeleted !== true && s.isDismissed !== true)
        .sort((a, b) => {
          const aAll = a.isAllDay === true ? 0 : 1;
          const bAll = b.isAllDay === true ? 0 : 1;
          if (aAll !== bAll) return aAll - bAll;
          return a.startTime.localeCompare(b.startTime);
        })
        .map((s) => ({
          id: s.id,
          title: s.title,
          startTime: s.startTime,
          completed: s.completed,
          isRoutine: s.routineId !== null,
          isAllDay: s.isAllDay === true,
        })),
    [scheduleItems],
  );

  const liveTasks = useMemo(
    () => taskNodes.filter((n) => n.type === "task" && n.isDeleted !== true),
    [taskNodes],
  );

  const todayTasks = useMemo<BriefingTaskEntry[]>(
    () =>
      liveTasks
        .filter((n) => dateKeyOf(n.scheduledAt) === todayKey)
        .map((n) => ({
          id: n.id,
          title: n.title,
          status: n.status ?? "NOT_STARTED",
          purposes: purposesOf(n.id),
        })),
    [liveTasks, todayKey, purposesOf],
  );

  const carryover = useMemo<BriefingCarryoverEntry[]>(
    () =>
      liveTasks
        .filter((n) => {
          const key = dateKeyOf(n.scheduledAt);
          return key !== null && key < todayKey && n.status !== "DONE";
        })
        .map((n) => ({
          node: n,
          days: daysBetween(dateKeyOf(n.scheduledAt) ?? todayKey, todayKey),
        }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 5)
        .map(({ node, days }) => ({
          id: node.id,
          title: node.title,
          daysLabel: t("briefing.carryoverDays", { count: days + 1 }),
        })),
    [liveTasks, todayKey, t],
  );

  const dateLine = useMemo(() => {
    const locale = i18n.language.startsWith("ja") ? "ja-JP" : "en-US";
    return new Date(`${todayKey}T00:00:00`).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, [todayKey, i18n.language]);

  const data = useMemo<BriefingData>(
    () => ({
      dateLine,
      briefing: extractBriefing(dailyContent),
      schedule,
      tasks: todayTasks,
      carryover,
      sessions,
      taskNodes: liveTasks,
    }),
    [
      dateLine,
      dailyContent,
      schedule,
      todayTasks,
      carryover,
      sessions,
      liveTasks,
    ],
  );

  const handleToggleScheduleItem = useCallback(
    (id: string) => {
      void ds.toggleScheduleItemComplete(id).then((updated) => {
        setScheduleItems((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        );
      });
    },
    [ds],
  );

  // ── Labels (§6.4 — resolved here, injected as props) ─────────────────
  const labels = useMemo(
    () => ({
      masthead: t("briefing.masthead"),
      focusLabel: t("briefing.focusLabel"),
      aiTitle: t("briefing.aiTitle"),
      aiSource: t("briefing.aiSource"),
      noBriefing: t("briefing.noBriefing"),
      scheduleTitle: t("briefing.scheduleTitle"),
      noSchedule: t("briefing.noSchedule"),
      routineTag: t("briefing.routineTag"),
      allDay: t("briefing.allDay"),
      tasksTitle: t("briefing.tasksTitle"),
      noTasks: t("briefing.noTasks"),
      vizTitle: t("briefing.vizTitle"),
      carryoverTitle: t("briefing.carryoverTitle"),
      toggleComplete: t("briefing.toggleComplete"),
    }),
    [t],
  );
  // Widget copy re-uses the EXISTING analytics.* keys (Analytics shrink:
  // the three widgets moved in here — their labels come along unduplicated).
  const streakLabels = useMemo(
    () => ({
      title: t("analytics.streak.title"),
      current: t("analytics.streak.current"),
      longest: t("analytics.streak.longest"),
      days: t("analytics.streak.days"),
      noStreak: t("analytics.streak.noStreak"),
    }),
    [t],
  );
  const trendLabels = useMemo(
    () => ({
      title: t("analytics.taskTrend.title"),
      completedCount: t("analytics.taskTrend.completedCount"),
    }),
    [t],
  );
  const balanceLabels = useMemo(
    () => ({
      title: t("analytics.workBreak.title"),
      work: t("analytics.workBreak.work"),
      break: t("analytics.workBreak.break"),
      longBreak: t("analytics.workBreak.longBreak"),
    }),
    [t],
  );

  return (
    <BriefingView
      loading={loading}
      data={data}
      labels={labels}
      streakLabels={streakLabels}
      trendLabels={trendLabels}
      balanceLabels={balanceLabels}
      onToggleScheduleItem={handleToggleScheduleItem}
    />
  );
}
