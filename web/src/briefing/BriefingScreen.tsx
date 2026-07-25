import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BriefingView,
  EveningView,
  extractBriefing,
  extractEveningSection,
  extractIntentionSection,
  isEmptyDocJson,
  mergeEveningSection,
  mergeIntentionSection,
  normalizeIntentionText,
  todayDateKey,
  formatDateKey,
  useSyncContext,
  useTranslation,
  type BriefingCarryoverEntry,
  type BriefingData,
  type BriefingScheduleEntry,
  type BriefingTab,
  type BriefingTaskEntry,
  type DataService,
  type EveningScheduleEntry,
  type EveningTodoEntry,
  type NavSection,
  type NoteNode,
  type ScheduleItem,
  type TaskNode,
  type TimerSession,
  type WikiTagConnectionUnified,
} from "@life-editor/shared";
import { RichTextEditor } from "../notes/RichTextEditor";

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
  onNavigate: (nav: NavSection) => void;
  /** Active header tab (朝刊 / 夕刊, #263 F-6) — lifted to MainScreen. */
  tab: BriefingTab;
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

/** The "YYYY-MM-DD" key of the day after `key` (local-time arithmetic). */
function nextDateKey(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return formatDateKey(d);
}

/** Debounce for the 宣言 textarea → section-merge save (flushed on blur). */
const INTENTION_SAVE_DEBOUNCE_MS = 800;

export function BriefingScreen({
  dataService: ds,
  onNavigate,
  tab,
}: BriefingScreenProps): React.JSX.Element {
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

  const todayKey = todayDateKey();
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

  // ── Evening tab (#263 F-6) ───────────────────────────────────────────
  // The 夕刊 tab is a dedicated editing view of the daily's evening section.
  // Persistence is a SECTION-MERGE write (Risks): each save re-reads the
  // freshest daily content, replaces only the 夕刊 range via
  // mergeEveningSection, and writes the whole document back — a save from
  // here can never clobber the 朝刊 section or Daily-side edits. Writes are
  // serialized through a promise chain so the editor's debounced emissions
  // and mood taps cannot interleave their read-merge-write cycles.
  const eveningStored = useMemo(
    () => extractEveningSection(dailyContent),
    [dailyContent],
  );

  // Editor remount bookkeeping (same idea as DailyView): bump the key only
  // when the STORED evening body changes from OUTSIDE this editor (sync
  // refetch / MCP / Daily-side edit). Our own save echoes match
  // lastEmittedBody and never remount, so typing keeps cursor + IME state.
  const [lastEmittedBody, setLastEmittedBody] = useState<string | null>(null);
  const [eveningGen, setEveningGen] = useState(0);
  const [syncedBody, setSyncedBody] = useState<string | null>(
    eveningStored.bodyDocJson,
  );
  // Mood draft: undefined = no local draft (show stored), null = cleared.
  const [moodDraft, setMoodDraft] = useState<number | null | undefined>(
    undefined,
  );
  const [syncedMood, setSyncedMood] = useState<number | null>(
    eveningStored.mood,
  );
  if (syncedBody !== eveningStored.bodyDocJson) {
    if (eveningStored.bodyDocJson !== lastEmittedBody) {
      setEveningGen((g) => g + 1);
    }
    setSyncedBody(eveningStored.bodyDocJson);
  }
  // Mood reconcile: when the STORED mood changes (external edit or our own
  // echo), drop a diverging local draft so the tab tracks Daily-side edits;
  // a draft the store just caught up with is kept (equal — no visual jump).
  if (syncedMood !== eveningStored.mood) {
    if (moodDraft !== undefined && moodDraft !== eveningStored.mood) {
      setMoodDraft(undefined);
    }
    setSyncedMood(eveningStored.mood);
  }

  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  // Each save carries ONLY what the user just changed (a body emission OR a
  // mood tap) — mergeEveningSection keeps the freshest stored value for the
  // undefined half, so a mood tap can never write back a stale body that an
  // external edit (Daily side / another device / MCP) has since replaced.
  const persistEvening = useCallback(
    (patch: { bodyDocJson?: string | null; mood?: number | null }) => {
      saveChainRef.current = saveChainRef.current.then(async () => {
        try {
          const fresh = await ds.getDailyByDateUnified(todayKey);
          const freshContent = fresh?.content ?? "";
          const merged = mergeEveningSection(freshContent, patch);
          if (merged === freshContent) return;
          const updated = await ds.upsertDailyByDateUnified(todayKey, merged);
          setDailyContent(updated.content ?? merged);
        } catch (err) {
          console.error("[BriefingScreen] evening section save failed", err);
        }
      });
    },
    [ds, todayKey],
  );

  const handleEveningUpdate = useCallback(
    (json: string) => {
      // A cleared editor round-trips to a null stored body — normalize the
      // echo target so clearing doesn't remount mid-typing.
      setLastEmittedBody(isEmptyDocJson(json) ? null : json);
      persistEvening({ bodyDocJson: json });
    },
    [persistEvening],
  );

  const eveningMood = moodDraft === undefined ? eveningStored.mood : moodDraft;

  const handleSelectMood = useCallback(
    (n: number) => {
      const next = eveningMood === n ? null : n; // tap again to clear
      setMoodDraft(next);
      persistEvening({ mood: next });
    },
    [eveningMood, persistEvening],
  );

  const eveningSaved =
    (lastEmittedBody === null ||
      lastEmittedBody === eveningStored.bodyDocJson) &&
    (moodDraft === undefined || moodDraft === eveningStored.mood);

  // ── Intention (宣言 — Step 4) ────────────────────────────────────────
  // The morning declaration lives in the daily's 宣言 section; saves ride
  // the SAME serialized chain as the evening writes — two concurrent
  // read-merge-write cycles on different sections could otherwise resurrect
  // each other's stale halves.
  const intentionStored = useMemo(
    () => extractIntentionSection(dailyContent),
    [dailyContent],
  );

  // Draft model (controlled textarea — no remounts): draft ?? stored is what
  // the field shows. `intentionSynced` pairs the last reconciled stored text
  // with the queue of our own not-yet-landed save values (echoes): a stored
  // change matching a queued echo is our own save landing and KEEPS the
  // draft (clearing it would eat e.g. a trailing newline typed since the
  // save); anything else is a genuinely external change (Daily side / MCP /
  // another device) and drops the draft — external wins, same rule as mood.
  // Reconciliation is the render-phase adjustment pattern on pure state
  // (no refs — idempotent under StrictMode's double render).
  const [intentionDraft, setIntentionDraft] = useState<string | undefined>(
    undefined,
  );
  const [intentionSynced, setIntentionSynced] = useState<{
    text: string | null;
    echoes: (string | null)[];
  }>({ text: intentionStored.text, echoes: [] });
  if (intentionSynced.text !== intentionStored.text) {
    const echoIdx = intentionSynced.echoes.indexOf(intentionStored.text);
    if (echoIdx < 0 && intentionDraft !== undefined) {
      setIntentionDraft(undefined);
    }
    setIntentionSynced({
      text: intentionStored.text,
      // A matching echo retires itself and any stale ones queued before it.
      echoes:
        echoIdx < 0
          ? intentionSynced.echoes
          : intentionSynced.echoes.slice(echoIdx + 1),
    });
  }

  const persistIntention = useCallback(
    (text: string) => {
      const normalized = normalizeIntentionText(text);
      setIntentionSynced((s) => ({ ...s, echoes: [...s.echoes, normalized] }));
      saveChainRef.current = saveChainRef.current.then(async () => {
        try {
          const fresh = await ds.getDailyByDateUnified(todayKey);
          const freshContent = fresh?.content ?? "";
          const merged = mergeIntentionSection(freshContent, normalized);
          if (merged === freshContent) {
            // No-op write — retire the echo queued for it.
            setIntentionSynced((s) => {
              const i = s.echoes.indexOf(normalized);
              if (i < 0) return s;
              return { ...s, echoes: s.echoes.filter((_, idx) => idx !== i) };
            });
            return;
          }
          const updated = await ds.upsertDailyByDateUnified(todayKey, merged);
          setDailyContent(updated.content ?? merged);
        } catch (err) {
          console.error("[BriefingScreen] intention section save failed", err);
        }
      });
    },
    [ds, todayKey],
  );

  const intentionTimerRef = useRef<number | null>(null);
  const intentionPendingRef = useRef<string | null>(null);

  const flushIntention = useCallback(() => {
    if (intentionTimerRef.current !== null) {
      window.clearTimeout(intentionTimerRef.current);
      intentionTimerRef.current = null;
    }
    const pending = intentionPendingRef.current;
    if (pending === null) return;
    intentionPendingRef.current = null;
    persistIntention(pending);
  }, [persistIntention]);

  // Unmount (or a persist identity change) must not drop tail keystrokes.
  useEffect(() => flushIntention, [flushIntention]);

  const handleIntentionChange = useCallback(
    (text: string) => {
      setIntentionDraft(text);
      intentionPendingRef.current = text;
      if (intentionTimerRef.current !== null)
        window.clearTimeout(intentionTimerRef.current);
      intentionTimerRef.current = window.setTimeout(
        flushIntention,
        INTENTION_SAVE_DEBOUNCE_MS,
      );
    },
    [flushIntention],
  );

  const intentionText = intentionDraft ?? intentionStored.text ?? "";
  const intentionSaved =
    intentionDraft === undefined ||
    normalizeIntentionText(intentionDraft) === intentionStored.text;

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
        });
    },
    [ds, taskNodes],
  );

  // ── Labels (§6.4 — resolved here, injected as props) ─────────────────
  const labels = useMemo(
    () => ({
      masthead: t("briefing.masthead"),
      focusLabel: t("briefing.focusLabel"),
      aiTitle: t("briefing.aiTitle"),
      aiSource: t("briefing.aiSource"),
      noBriefing: t("briefing.noBriefing"),
      intentionTitle: t("briefing.intentionTitle"),
      intentionCaption: intentionSaved
        ? t("materials.daily.saved")
        : t("materials.daily.unsaved"),
      intentionPlaceholder: t("briefing.intentionPlaceholder"),
      scheduleTitle: t("briefing.scheduleTitle"),
      noSchedule: t("briefing.noSchedule"),
      routineTag: t("briefing.routineTag"),
      allDay: t("briefing.allDay"),
      tasksTitle: t("briefing.tasksTitle"),
      noTasks: t("briefing.noTasks"),
      vizTitle: t("briefing.vizTitle"),
      carryoverTitle: t("briefing.carryoverTitle"),
      toggleComplete: t("briefing.toggleComplete"),
      jumpToSchedule: t("briefing.jumpToSchedule"),
      jumpToTasks: t("briefing.jumpToTasks"),
    }),
    [t, intentionSaved],
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

  const eveningLabels = useMemo(
    () => ({
      masthead: t("briefing.evening.masthead"),
      moodTitle: t("briefing.evening.moodTitle"),
      moodStars: [1, 2, 3, 4, 5].map((n) =>
        t("briefing.evening.moodStar", { value: n }),
      ),
      intentionTitle: t("briefing.evening.intentionTitle"),
      reflectionTitle: t("briefing.evening.reflectionTitle"),
      savedCaption: eveningSaved
        ? t("materials.daily.saved")
        : t("materials.daily.unsaved"),
      todosTitle: t("briefing.evening.todosTitle"),
      noTodos: t("briefing.evening.noTodos"),
      upcomingTitle: t("briefing.evening.upcomingTitle"),
      noUpcoming: t("briefing.evening.noUpcoming"),
      tomorrowTag: t("briefing.evening.tomorrowTag"),
      allDay: t("briefing.allDay"),
    }),
    [t, eveningSaved],
  );

  if (tab === "evening") {
    return (
      <EveningView
        loading={loading}
        dateLine={dateLine}
        mood={eveningMood}
        onSelectMood={handleSelectMood}
        editorSlot={
          <RichTextEditor
            key={`evening:${todayKey}:${eveningGen}`}
            noteId={`evening-${todayKey}`}
            initialContent={eveningStored.bodyDocJson ?? undefined}
            onUpdate={handleEveningUpdate}
            placeholder={t("briefing.evening.placeholder")}
            className="min-h-[180px] px-4 py-3"
          />
        }
        intention={intentionStored.text}
        todos={remainingTodos}
        schedule={upcoming}
        labels={eveningLabels}
      />
    );
  }

  return (
    <BriefingView
      loading={loading}
      data={data}
      labels={labels}
      streakLabels={streakLabels}
      trendLabels={trendLabels}
      balanceLabels={balanceLabels}
      intentionText={intentionText}
      onIntentionChange={handleIntentionChange}
      onIntentionBlur={flushIntention}
      onToggleScheduleItem={handleToggleScheduleItem}
      onToggleTask={handleToggleTask}
      onJumpToSchedule={() => onNavigate("schedule")}
      onJumpToTasks={() => onNavigate("tasks")}
    />
  );
}
