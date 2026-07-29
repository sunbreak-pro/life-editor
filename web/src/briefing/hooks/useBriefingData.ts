import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dateKeyOfInstant,
  extractBriefing,
  formatDateKey,
  localDateTimeToISO,
  pickAddableTasks,
  tasksToCalendarChips,
  useSyncContext,
  useTranslation,
  type BriefingCarryoverEntry,
  type BriefingData,
  type BriefingScheduleEntry,
  type BriefingTaskEntry,
  type DataService,
  type EveningScheduleEntry,
  type EveningTodoEntry,
  type NoteNode,
  type ScheduleItem,
  type TaskNode,
  type TimerSession,
  type TodayTodoRow,
  type WikiTagConnectionUnified,
} from "@life-editor/shared";

/*
 * Data half of the Briefing host (extracted from BriefingScreen.tsx —
 * hooks split, zero behavior change). Owns fetching, aggregation and the
 * direct DataService writes that update fetched state.
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
 * without a reload. Sits inside SyncProvider (MainScreen mounts the
 * screen there).
 */

/*
 * LOCAL "YYYY-MM-DD" from a stored scheduledAt (#413 fix). This used to slice
 * the first 10 chars, which reads the UTC day: in JST an all-day task staged
 * at local midnight is stored as `…T15:00:00Z` on the PREVIOUS date, so the
 * paper filed every such task under 持ち越し「2日目」 instead of 今日の Todo
 * — including the ones the new rightSidebar tray adds. The tray itself keys
 * on the LOCAL day (tasksToCalendarChips), and now so does the paper.
 */
const dateKeyOf = dateKeyOfInstant;

/** Whole-day difference between two "YYYY-MM-DD" keys (b - a). */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** The "YYYY-MM-DD" key of the day after `key` (local-time arithmetic). */
function nextDateKey(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return formatDateKey(d);
}

export function useBriefingData(ds: DataService, todayKey: string) {
  const { t, i18n } = useTranslation();
  const { syncVersion } = useSyncContext();

  const [loading, setLoading] = useState(true);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [tomorrowItems, setTomorrowItems] = useState<ScheduleItem[]>([]);
  const [taskNodes, setTaskNodes] = useState<TaskNode[]>([]);
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
    // until the fresh data resolves (same pattern as WorkScreen's task fetch).
    let cancelled = false;
    void Promise.allSettled([
      ds.fetchScheduleItemsByDate(todayKey),
      ds.fetchTaskTree(),
      ds.fetchTimerSessions(),
      ds.getDailyByDateUnified(todayKey),
      ds.listNotesUnified(),
      ds.listAllTagConnections(),
      ds.fetchScheduleItemsByDate(tomorrowKey),
    ]).then((results) => {
      if (cancelled) return;
      const [sched, tasks, sess, daily, allNotes, links, tomorrow] = results;
      if (sched.status === "fulfilled") setScheduleItems(sched.value);
      if (tasks.status === "fulfilled") setTaskNodes(tasks.value);
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
          if (key === null || key >= todayKey) return false;
          if (n.status !== "DONE") return true;
          return (
            n.completedAt !== undefined &&
            Date.parse(n.completedAt) >= Date.parse(`${todayKey}T00:00:00`)
          );
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
          completed: node.status === "DONE",
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

  //「残りの Todo」— today's unfinished + open carryover (display only).
  const remainingTodos = useMemo<EveningTodoEntry[]>(
    () => [
      ...todayTasks
        .filter((task) => task.status !== "DONE")
        .map(({ id, title }) => ({ id, title })),
      ...carryover
        .filter((item) => !item.completed)
        .map((item) => ({
          id: item.id,
          title: item.title,
          meta: item.daysLabel,
        })),
    ],
    [todayTasks, carryover],
  );

  //「今後の予定」— the rest of today (from now) + all of tomorrow.
  const upcoming = useMemo<EveningScheduleEntry[]>(() => {
    const now = new Date();
    const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
    const todayRest = schedule
      .filter((s) => !s.completed && (s.isAllDay || s.startTime >= nowHHMM))
      .map((s) => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        isAllDay: s.isAllDay,
        isTomorrow: false,
      }));
    const tomorrow = tomorrowItems
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
        isAllDay: s.isAllDay === true,
        isTomorrow: true,
      }));
    return [...todayRest, ...tomorrow];
  }, [schedule, tomorrowItems]);

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

  const handleToggleTask = useCallback(
    (id: string) => {
      const target = taskNodes.find((n) => n.id === id);
      if (target === undefined) return;
      const done = target.status === "DONE";
      void ds
        .updateTask(
          id,
          done
            ? { status: "NOT_STARTED", completedAt: undefined }
            : { status: "DONE", completedAt: new Date().toISOString() },
        )
        .then((updated) => {
          setTaskNodes((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          );
        })
        // The row also renders in the rightSidebar tray now (#413), so a
        // failed write is worth a console line instead of an unhandled
        // rejection: the checkbox just stays put and nothing says why.
        .catch((err) => {
          console.error("[BriefingScreen] task completion toggle failed", err);
        });
    },
    [ds, taskNodes],
  );

  // ── Today's Todo tray (rightSidebar — #413) ──────────────────────────
  // The SAME <TodayTodoTray> the Schedule rightSidebar mounts (#298), backed
  // by the same pure selectors: today's task chips split into placed (has a
  // time) and unplaced (all-day candidate), plus pickAddableTasks for the
  // "add from tasks" picker. One implementation, two hosts — a second copy
  // here would drift the moment one side is fixed.
  //
  // Host difference: Briefing mounts no TaskTreeProvider (MainScreen renders
  // this screen bare and injects the DataService instead), so completion and
  // "add to today" write through ds.updateTask rather than the provider's
  // setTaskStatus / updateNode. Both end up on the same items_meta +
  // tasks_payload columns (taskUpdatesToPatches), so the two trays agree.
  //
  // "Today" here is Briefing's own todayKey (todayDateKey — day-start-hour
  // aware, #373), NOT Schedule's plain calendar key: the tray sits beside the
  // paper's 今日の Todo list and has to agree with it. The two definitions
  // differ only between midnight and the configured day-start hour.
  const todayChips = useMemo(
    () => tasksToCalendarChips(liveTasks, todayKey, todayKey),
    [liveTasks, todayKey],
  );
  const todoPlaced = useMemo<TodayTodoRow[]>(
    () =>
      todayChips
        .filter((c) => !c.isAllDay)
        .map((c) => ({
          id: c.id,
          title: c.title,
          timeLabel: c.startTime,
          completed: c.completed,
        })),
    [todayChips],
  );
  const todoUnplaced = useMemo<TodayTodoRow[]>(
    () =>
      todayChips
        .filter((c) => c.isAllDay)
        .map((c) => ({ id: c.id, title: c.title, completed: c.completed })),
    [todayChips],
  );
  const todoAddable = useMemo(() => pickAddableTasks(liveTasks), [liveTasks]);

  // "Add to today" (案 c staging — the same write Schedule's tray makes):
  // scheduledAt = today's local midnight + all-day, so the task lands in the
  // unplaced group; giving it a time (a Schedule drag) promotes it to placed.
  const handleAddTodoCandidate = useCallback(
    (taskId: string) => {
      void ds
        .updateTask(taskId, {
          scheduledAt: localDateTimeToISO(todayKey, "00:00"),
          isAllDay: true,
        })
        .then((updated) => {
          setTaskNodes((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          );
        })
        .catch((err) => {
          console.error("[BriefingScreen] add-to-today failed", err);
        });
    },
    [ds, todayKey],
  );

  return {
    loading,
    data,
    dateLine,
    dailyContent,
    setDailyContent,
    remainingTodos,
    upcoming,
    handleToggleScheduleItem,
    handleToggleTask,
    todoPlaced,
    todoUnplaced,
    todoAddable,
    handleAddTodoCandidate,
  };
}
