import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DataService } from "../services/DataService";
import type { PomodoroPreset, TimerSession } from "../types/timer";
import { generateId } from "../utils/generateId";
import {
  ABANDONED_SESSION_SECONDS,
  freeSessionSlot,
  isCountedSession,
  sessionTargetId,
} from "../utils/timerSessions";
import {
  clearOpenSessionMarker,
  planOrphanRecovery,
  readOpenSessionMarker,
  timerTabId,
  writeOpenSessionMarker,
} from "../utils/timerOpenSessionMarker";
import { logServiceError } from "../utils/logError";
import { useSyncDomains } from "../hooks/useSyncDomains";
import {
  TimerContext,
  type TimerContextValue,
  type TimerPresetValues,
  type TimerSettingsPatch,
} from "./TimerContextValue";
import {
  timerReducer,
  createInitialState,
  phaseDurationSeconds,
  remainingSeconds as computeRemaining,
  elapsedSeconds as computeElapsed,
  type ActiveWorkItem,
  type TimerConfig,
  type TimerPhase,
} from "./timerReducer";

/*
 * Shared TimerProvider (W3-B). Pattern A (CLAUDE.md §6.3). Hosts inject the
 * DataService (CLAUDE.md §6.4 — the Provider, being a host-side context, MAY
 * use the injected ds; only shared hooks/primitives may not reach a module
 * singleton). Timer is enabled on Mobile too, so it is a REQUIRED Provider
 * (no Optional variant). Must sit inside a Sync Provider — it reads
 * useSyncContext so a cross-tab settings/preset edit triggers a refetch.
 *
 * Time model (start-time based, plan 確定 #4): the reducer holds wall-clock
 * anchors (startedAt + accumulatedMs); the displayed remainingSeconds is
 * recomputed every render. A 1 s setInterval only bumps `tickNow` to force a
 * re-render — it never decrements a counter, so a throttled/background tab
 * still shows the correct time (the math reads Date.now()).
 *
 * Sessions are logged to timer_sessions on start (startTimerSession) and
 * closed on phase end / pause / reset (endTimerSession), so the started_at /
 * ended_at / duration log is start-time accurate.
 *
 * One row per RUNNING SEGMENT, not per phase (#1853). A pause closes the row
 * with the seconds that segment ran, and a resume opens a fresh one, so a phase
 * paused once is two rows whose durations add up to the time worked. The row
 * that reaches the target is the `completed` one. Keeping the row open across
 * a pause was the alternative, and it loses on two counts: a tab closed while
 * paused would leave the time in a row that never gets a duration, and the
 * row's started_at to ended_at range (which the free-session Event is drawn
 * from) would swallow the pause.
 *
 * A reload or a closed tab closes nothing, so the row it interrupts is picked
 * up at the next startup instead (#1857): see the orphan sweep below. The
 * running state itself is not restored; the timer comes back idle.
 *
 * `onSessionComplete` is an optional host hook fired when a phase reaches 0
 * (the host plays the chime / sends a notification — shared has no audio).
 *
 * A WORK phase started with no todo attached logs `task_id = null` (#1116).
 * It used to mint a placeholder "Untitled todo" first (#882), so that Analytics
 * had a name to bucket the hour under instead of one nameless "__none__" pile.
 * The cost was worse than the gain: running the timer WITHOUT picking a todo is
 * the ordinary way to use it, so every such start dropped a junk row into the
 * user's real Todo list. `timer_sessions.task_id` is nullable and carries no FK
 * (supabase/migrations/0018_timer_audio_tables.sql), so the session row stands
 * on its own — attributing it after the fact stays a UI concern.
 */
export interface TimerProviderProps {
  children: ReactNode;
  dataService: DataService;
  /** Fired when a phase completes (host plays sound / notifies). */
  onSessionComplete?: (completedPhase: TimerPhase) => void;
  /**
   * Title for the Event a WORK session with nothing linked is filed under
   * (#1665) — already translated (§6.4), e.g. "Free session".
   *
   * Omitting it turns the whole free-session path off, which is what every
   * suite that only exercises the timer itself does.
   */
  freeSessionTitle?: string;
}

export function TimerProvider({
  children,
  dataService: ds,
  onSessionComplete,
  freeSessionTitle,
}: TimerProviderProps) {
  const syncVersion = useSyncDomains("timer");
  const [state, dispatch] = useReducer(timerReducer, undefined, () =>
    createInitialState(),
  );

  // Settings not held in the reducer config (UI-level, persisted separately).
  const [autoStartBreaks, setAutoStartBreaksState] = useState(false);
  const [targetSessions, setTargetSessionsState] = useState(4);
  const [presets, setPresets] = useState<PomodoroPreset[]>([]);

  // The id of the open timer_sessions row (null when none in flight).
  const currentSessionIdRef = useRef<number | null>(null);
  /*
   * What the open row was opened FOR (#1665). The close path only receives an
   * id and a duration, and by the time it runs the reducer may already hold
   * the next phase (an ADVANCE dispatches around it) or a target the user
   * picked mid-session — so "was this a WORK phase with nothing linked" has to
   * be the answer from when the row was OPENED, not from live state.
   */
  const openSessionRef = useRef<{ attributed: boolean } | null>(null);
  // Phase-elapsed seconds at which the open row's segment began (#1853): 0 on
  // a fresh start, the paused elapsed on a resume. A close writes
  // `elapsed - this`, the length of the segment rather than of the phase.
  const segmentBaseSecondsRef = useRef(0);
  /*
   * Seconds of the live phase that were written as rows that COUNT, by the
   * same cut `isCountedSession` reads the log with, so the completion modal
   * can say what Analytics will say rather than the phase's nominal length
   * (#1853). A segment paused inside the first minute is a scrap there and is
   * left out here too.
   */
  const phaseLoggedSecondsRef = useRef(0);
  const [lastLoggedWorkSeconds, setLastLoggedWorkSeconds] = useState<
    number | null
  >(null);
  // Tags the next free session will carry. Ref as well as state: the close
  // path reads them outside a render, and state alone would hand it whatever
  // the last render captured.
  const [freeSessionTagIds, setFreeSessionTagIdsState] = useState<string[]>([]);
  const freeSessionTagIdsRef = useRef<string[]>([]);
  const freeSessionTitleRef = useRef(freeSessionTitle);
  // Re-render pulse: bumped each second so the derived display recomputes.
  const [tickNow, setTickNow] = useState(() => Date.now());

  const onSessionCompleteRef = useRef(onSessionComplete);
  // Mirrored in an effect, not during render (#505). It is only read from
  // the tick effect below, which runs after the commit, so the value it
  // sees is unchanged.
  useEffect(() => {
    onSessionCompleteRef.current = onSessionComplete;
    // Same treatment for the free-session title (#1665) — mirrored after the
    // commit, never written during render.
    freeSessionTitleRef.current = freeSessionTitle;
  });

  /**
   * Tags the next free session will carry. Held here rather than on the Work
   * screen because the screen unmounts when the user walks to another section
   * while the timer runs, and the session it started is still the Provider's.
   */
  const setFreeSessionTagIds = useCallback((ids: string[]) => {
    freeSessionTagIdsRef.current = ids;
    setFreeSessionTagIdsState(ids);
  }, []);

  // --- load settings + presets (refetch on sync bump) ---
  useEffect(() => {
    let cancelled = false;
    void ds
      .fetchTimerSettings()
      .then((settings) => {
        if (cancelled) return;
        dispatch({
          type: "SET_CONFIG",
          config: {
            workDuration: settings.workDuration,
            breakDuration: settings.breakDuration,
            longBreakDuration: settings.longBreakDuration,
            sessionsBeforeLongBreak: settings.sessionsBeforeLongBreak,
          },
        });
        setAutoStartBreaksState(settings.autoStartBreaks);
        setTargetSessionsState(settings.targetSessions);
      })
      .catch((e) => logServiceError("Timer", "fetchTimerSettings", e));
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  useEffect(() => {
    let cancelled = false;
    void ds
      .fetchPomodoroPresets()
      .then((rows) => {
        if (!cancelled) setPresets(rows);
      })
      .catch((e) => logServiceError("Timer", "fetchPomodoroPresets", e));
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  // --- 1 s re-render pulse while running (display recompute only) ---
  // The same pulse keeps the open row's marker fresh (#1857), so a tab that
  // dies mid-run leaves behind the last second it was seen alive.
  useEffect(() => {
    if (!state.isRunning) return;
    const id = setInterval(() => {
      const now = Date.now();
      setTickNow(now);
      if (currentSessionIdRef.current !== null)
        writeOpenSessionMarker(currentSessionIdRef.current, now);
    }, 1000);
    return () => clearInterval(id);
  }, [state.isRunning]);

  // --- session log helpers ---
  const startSession = useCallback(
    (phase: TimerPhase, item: ActiveWorkItem | null, baseSeconds = 0) => {
      segmentBaseSecondsRef.current = baseSeconds;
      // Nothing picked → the row logs a null task_id AND a null event_id, and
      // nothing is created on the user's behalf (#1116). Any Todo this path
      // ever mints again must come from `generateTodoId` (utils/generateId),
      // not `generateId("task")` — the latter yields `task-<uuid>` and breaks
      // the CLAUDE.md §4 id invariant, which is the second half of what #1116
      // reported.
      void ds
        .startTimerSession(
          phase,
          item ? { kind: item.kind, id: item.id } : undefined,
        )
        .then((session) => {
          currentSessionIdRef.current = session.id;
          openSessionRef.current = { attributed: item !== null };
          writeOpenSessionMarker(session.id, Date.now());
        })
        .catch((e) => logServiceError("Timer", "startTimerSession", e));
    },
    [ds],
  );

  /*
   * File a closed, unattributed WORK session as a "Free session" Event (#1665).
   *
   * At CLOSE rather than at start, which is the decision this path turns on.
   * An Event minted on Start would have to guess the range, and every aborted
   * start — the seconds-long scraps #1475 is about — would leave a row on the
   * user's calendar. Waiting until the row is closed means the range is the
   * time that was actually worked, and `isCountedSession` (the same test the
   * analytics read the log with) keeps the scraps out. It is also what keeps
   * #1116 intact in spirit: nothing is minted on a plain Start.
   *
   * One Event per session, deliberately. Merging a day's runs into one row
   * would have to decide what counts as "consecutive" and would rewrite a row
   * the user may have edited in between; separate rows read back as what the
   * timer actually did, and the Work history tab lists them that way.
   */
  const fileFreeSession = useCallback(
    async (
      session: TimerSession,
      tagIds: readonly string[] = freeSessionTagIdsRef.current,
    ) => {
      const title = freeSessionTitleRef.current;
      if (!title) return;
      if (session.sessionType !== "WORK") return;
      if (!isCountedSession(session)) return;
      const endedAt =
        session.completedAt ??
        new Date(session.startedAt.getTime() + session.duration * 1000);
      const slot = freeSessionSlot(session.startedAt, endedAt);
      const event = await ds.createScheduleItem(
        generateId("event"),
        slot.date,
        title,
        slot.startTime,
        slot.endTime,
      );
      // Tags first, then the attribution: a tag that fails to land still
      // leaves an Event the session points at, whereas the reverse would leave
      // a tagged Event no session names.
      for (const tagId of tagIds) {
        await ds.assignTagToItem(generateId("tag_assign"), event.id, tagId);
      }
      await ds.attributeTimerSession(session.id, {
        kind: "event",
        id: event.id,
      });
    },
    [ds],
  );

  const closeSession = useCallback(
    (durationSeconds: number, completed: boolean) => {
      const id = currentSessionIdRef.current;
      if (id === null) return;
      currentSessionIdRef.current = null;
      clearOpenSessionMarker(id);
      const opened = openSessionRef.current;
      openSessionRef.current = null;
      if (
        durationSeconds > 0 &&
        (completed || durationSeconds >= ABANDONED_SESSION_SECONDS)
      ) {
        phaseLoggedSecondsRef.current += durationSeconds;
      }
      void ds
        .endTimerSession(id, durationSeconds, completed)
        .then((session) => {
          // The row as the DB now holds it decides whether it earns an Event:
          // it carries the real range and the duration the close just wrote.
          // A suite stubbing `endTimerSession` with a bare resolve gets
          // nothing here, which is the same "feature off" path as no title.
          if (!session || !opened || opened.attributed) return;
          return fileFreeSession(session).catch((e) =>
            logServiceError("Timer", "freeSession", e),
          );
        })
        .catch((e) => logServiceError("Timer", "endTimerSession", e));
    },
    [ds, fileFreeSession],
  );

  /*
   * Startup sweep for rows nobody closed (#1857). Pause, reset and completion
   * all close the open row, but a reload or a closed tab gives the Provider no
   * turn, and the row kept a null `ended_at` with no path that ever came back
   * for it. What gets closed, and with how many seconds, is decided by
   * `planOrphanRecovery`.
   *
   * Once per Provider, behind a ref rather than a cancellable effect: it is
   * fire-and-forget DB work that sets no state, and StrictMode's second effect
   * pass must not find the marker already consumed by a cancelled first one.
   *
   * A recovered free session still earns its Event, by the same
   * `fileFreeSession` a normal close uses, so the calendar and Analytics keep
   * agreeing. It carries no tags: the ones picked for that run went down with
   * the tab, and whatever is selected now belongs to the next session.
   */
  const orphanSweepStartedRef = useRef(false);
  useEffect(() => {
    if (orphanSweepStartedRef.current) return;
    orphanSweepStartedRef.current = true;
    // A suite that stubs only the methods its subject calls has no sweep to
    // run, the same "feature off" path as a missing free-session title.
    if (typeof ds.fetchOpenTimerSessions !== "function") return;
    const marker = readOpenSessionMarker();
    const sweep = async () => {
      const open = (await ds.fetchOpenTimerSessions()).filter(
        (s) => s.id !== currentSessionIdRef.current,
      );
      const plan = planOrphanRecovery(open, marker, timerTabId(), Date.now());
      for (const { session, durationSeconds } of plan) {
        const closed = await ds.recoverTimerSession(session, durationSeconds);
        if (closed && !sessionTargetId(closed)) {
          await fileFreeSession(closed, []).catch((e) =>
            logServiceError("Timer", "freeSession", e),
          );
        }
      }
      // The marker has done its job unless its row is still open, which only
      // happens when another tab is visibly running it.
      if (
        marker &&
        (!open.some((s) => s.id === marker.sessionId) ||
          plan.some((p) => p.session.id === marker.sessionId))
      )
        clearOpenSessionMarker(marker.sessionId);
    };
    void sweep().catch((e) => logServiceError("Timer", "orphanSweep", e));
  }, [ds, fileFreeSession]);

  // --- derived display (recomputed every render via tickNow) ---
  const remaining = computeRemaining(state, tickNow);
  const totalSeconds = state.durationSeconds;
  const progress =
    totalSeconds > 0
      ? Math.min(100, ((totalSeconds - remaining) / totalSeconds) * 100)
      : 0;
  const formatted = useMemo(() => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, [remaining]);

  // --- phase completion: fire when remaining hits 0 while running ---
  // Guard so we ADVANCE exactly once per phase (remaining can stay 0 across
  // ticks). `phase` + `completedSessions` identify the live phase instance.
  const advancedRef = useRef(false);
  useEffect(() => {
    if (!state.isRunning) {
      advancedRef.current = false;
      return;
    }
    if (remaining <= 0 && !advancedRef.current) {
      advancedRef.current = true;
      const completedPhase = state.phase;
      // The phase ran its full target; the row holds the segment since the
      // last resume (#1853), which is the whole phase when nothing paused it.
      closeSession(
        Math.max(0, totalSeconds - segmentBaseSecondsRef.current),
        true,
      );
      if (completedPhase === "WORK") {
        setLastLoggedWorkSeconds(phaseLoggedSecondsRef.current);
      }
      phaseLoggedSecondsRef.current = 0;
      onSessionCompleteRef.current?.(completedPhase);
      dispatch({ type: "ADVANCE", now: Date.now() });
    }
  }, [remaining, state.isRunning, state.phase, totalSeconds, closeSession]);

  // After an ADVANCE the new phase is idle; reset the once-guard and optionally
  // auto-start the break/work (auto_start_breaks). A separate effect keyed on
  // phase identity so it runs once per transition.
  const phaseKey = `${state.phase}:${state.completedSessions}`;
  const prevPhaseKeyRef = useRef(phaseKey);
  useEffect(() => {
    if (prevPhaseKeyRef.current === phaseKey) return;
    prevPhaseKeyRef.current = phaseKey;
    advancedRef.current = false;
    if (autoStartBreaks && !state.isRunning) {
      // Auto-start the freshly-entered phase. No tickNow re-anchor needed
      // (#586): elapsedSeconds clamps (stale tickNow − startedAt) to ≥ 0 and
      // the fresh phase has accumulatedMs 0, so the display shows the full
      // target either way until the 1 s pulse takes over.
      startSession(state.phase, state.activeItem);
      dispatch({ type: "START", now: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  // --- controls ---
  const start = useCallback(() => {
    if (state.isRunning) return;
    const now = Date.now();
    // Every running segment gets its own row: a fresh start AND a resume
    // (#1853). Resume used to open nothing, so the row a pause had closed was
    // the only one the phase ever got and the completion had nothing to close.
    if (currentSessionIdRef.current === null) {
      startSession(
        state.phase,
        state.activeItem,
        Math.floor(state.accumulatedMs / 1000),
      );
    }
    dispatch({ type: "START", now });
    setTickNow(now);
  }, [
    state.isRunning,
    state.accumulatedMs,
    state.phase,
    state.activeItem,
    startSession,
  ]);

  const pause = useCallback(() => {
    if (!state.isRunning) return;
    const now = Date.now();
    const elapsed = computeElapsed(state, now);
    dispatch({ type: "PAUSE", now });
    setTickNow(now);
    // Close the in-flight row as a non-completed partial: the seconds this
    // segment ran, not the phase so far. An earlier segment already wrote its
    // own share (#1853).
    closeSession(Math.max(0, elapsed - segmentBaseSecondsRef.current), false);
  }, [state, closeSession]);

  /*
   * Reset does NOT retract what was already logged (#1475). By the time it runs
   * the row is usually closed already — a pause closes it as a partial — so
   * there is nothing left here to withdraw, and a run abandoned after 20 real
   * minutes is still time that was worked. That holds per segment (#1853):
   * every row a pause closed stays, and a reset while running closes the live
   * segment the same way a pause would. Whether a row counts is decided when
   * the log is read: `isCountedSession` (utils/timerSessions) drops the
   * seconds-long scraps an aborted start leaves behind, which also cleans the
   * ones earlier builds already wrote.
   */
  const reset = useCallback(() => {
    const now = Date.now();
    const elapsed = computeElapsed(state, now);
    if (currentSessionIdRef.current !== null)
      closeSession(Math.max(0, elapsed - segmentBaseSecondsRef.current), false);
    phaseLoggedSecondsRef.current = 0;
    dispatch({ type: "RESET" });
    setTickNow(now);
  }, [state, closeSession]);

  const setPhase = useCallback(
    (phase: TimerPhase) => {
      const now = Date.now();
      if (currentSessionIdRef.current !== null)
        closeSession(
          Math.max(
            0,
            computeElapsed(state, now) - segmentBaseSecondsRef.current,
          ),
          false,
        );
      phaseLoggedSecondsRef.current = 0;
      dispatch({ type: "SET_PHASE", phase });
      setTickNow(now);
    },
    [state, closeSession],
  );

  const setActiveItem = useCallback((item: ActiveWorkItem | null) => {
    dispatch({ type: "SET_ACTIVE_ITEM", item });
  }, []);

  const adjustRemainingMinutes = useCallback(
    (delta: number) => {
      // Guard here too (the reducer no-ops while running, but this avoids a
      // redundant dispatch + tick bump). The reducer keeps remaining >= 1 min.
      if (state.isRunning) return;
      dispatch({ type: "ADJUST_REMAINING", deltaMinutes: delta });
      setTickNow(Date.now());
    },
    [state.isRunning],
  );

  // --- settings mutators (optimistic dispatch + persist) ---
  const persistSettings = useCallback(
    (patch: Parameters<DataService["updateTimerSettings"]>[0]) => {
      void ds
        .updateTimerSettings(patch)
        .catch((e) => logServiceError("Timer", "updateTimerSettings", e));
    },
    [ds],
  );

  /*
   * The Work panel's save button (#714). It used to be five per-field setters
   * that each dispatched and each wrote, so editing the whole block produced
   * five rows, five undo-able states and five sync bumps; the panel now holds
   * a draft and hands the whole thing over at once, which this turns into ONE
   * dispatch and ONE updateTimerSettings call.
   *
   * Clamping still lives here rather than in the panel: the limits belong to
   * the domain, and applying them on the way in is what makes a typed 500 come
   * back as 240 when the panel drops its draft and follows this state again.
   */
  const saveSettings = useCallback(
    (patch: TimerSettingsPatch) => {
      const config: Partial<TimerConfig> = {};
      const write: Parameters<DataService["updateTimerSettings"]>[0] = {};
      if (patch.workDuration !== undefined) {
        const v = clampMinutes(patch.workDuration, 1, 240);
        config.workDuration = v;
        write.workDuration = v;
      }
      if (patch.breakDuration !== undefined) {
        const v = clampMinutes(patch.breakDuration, 1, 60);
        config.breakDuration = v;
        write.breakDuration = v;
      }
      if (patch.longBreakDuration !== undefined) {
        const v = clampMinutes(patch.longBreakDuration, 1, 60);
        config.longBreakDuration = v;
        write.longBreakDuration = v;
      }
      if (patch.sessionsBeforeLongBreak !== undefined) {
        const v = clampMinutes(patch.sessionsBeforeLongBreak, 1, 20);
        config.sessionsBeforeLongBreak = v;
        write.sessionsBeforeLongBreak = v;
      }
      if (patch.targetSessions !== undefined) {
        const v = clampMinutes(patch.targetSessions, 1, 20);
        // Not reducer config — targetSessions is a UI-level goal, held in its
        // own state (see the declaration above).
        setTargetSessionsState(v);
        write.targetSessions = v;
      }
      if (Object.keys(config).length > 0) {
        dispatch({ type: "SET_CONFIG", config });
      }
      if (Object.keys(write).length > 0) persistSettings(write);
    },
    [persistSettings],
  );

  const setAutoStartBreaks = useCallback(
    (enabled: boolean) => {
      setAutoStartBreaksState(enabled);
      persistSettings({ autoStartBreaks: enabled });
    },
    [persistSettings],
  );

  // --- preset CRUD ---
  // The durations arrive from the panel rather than being read off
  // state.config: since #714 the panel can be holding an unsaved draft, and a
  // preset named after the numbers on screen must store those numbers.
  const createPreset = useCallback(
    async (name: string, values: TimerPresetValues) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        const created = await ds.createPomodoroPreset({
          name: trimmed,
          workDuration: values.workDuration,
          breakDuration: values.breakDuration,
          longBreakDuration: values.longBreakDuration,
          sessionsBeforeLongBreak: values.sessionsBeforeLongBreak,
        });
        setPresets((prev) => [...prev, created]);
      } catch (e) {
        logServiceError("Timer", "createPomodoroPreset", e);
      }
    },
    [ds],
  );

  const applyPreset = useCallback(
    (preset: PomodoroPreset) => {
      dispatch({
        type: "SET_CONFIG",
        config: {
          workDuration: preset.workDuration,
          breakDuration: preset.breakDuration,
          longBreakDuration: preset.longBreakDuration,
          sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
        },
      });
      persistSettings({
        workDuration: preset.workDuration,
        breakDuration: preset.breakDuration,
        longBreakDuration: preset.longBreakDuration,
        sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
      });
    },
    [persistSettings],
  );

  const deletePreset = useCallback(
    async (id: number) => {
      try {
        await ds.deletePomodoroPreset(id);
        setPresets((prev) => prev.filter((p) => p.id !== id));
      } catch (e) {
        logServiceError("Timer", "deletePomodoroPreset", e);
      }
    },
    [ds],
  );

  /*
   * The value is assembled from TWO memos, split along the only line that
   * matters here: what the 1 s pulse touches (#676 (d)).
   *
   *  - `live` is the display face. Every field in it is derived from the
   *    wall-clock anchors and so is rebuilt each tick, by design.
   *  - `controls` is the imperative surface plus the settings and presets. It
   *    changes when the user (or a cross-tab edit) changes something, which is
   *    rare — it does NOT move with the clock.
   *
   * They used to be one memo over a 26-entry dependency list, which is the
   * kind of list that goes wrong quietly: drop an entry and the value keeps a
   * stale field forever, add a churning one and the memo never hits. Two short
   * lists say which half a new field belongs to, and the composition below
   * makes "everything is rebuilt every second" visible rather than implied.
   *
   * The composed value still changes each tick, so this is not a render
   * optimisation — both consumers (NavTimerStatus and WorkScreen) show the
   * countdown and must re-render anyway. Giving the halves their own contexts
   * would only pay off with memoised panels inside WorkScreen; that is a
   * bigger, screen-side change and is queued rather than smuggled in here.
   */
  const live = useMemo(
    () => ({
      phase: state.phase,
      isRunning: state.isRunning,
      remainingSeconds: remaining,
      progress,
      totalSeconds,
      completedSessions: state.completedSessions,
      formatted,
      activeItem: state.activeItem,
      lastLoggedWorkSeconds,
    }),
    [
      state.phase,
      state.isRunning,
      remaining,
      progress,
      totalSeconds,
      state.completedSessions,
      formatted,
      state.activeItem,
      lastLoggedWorkSeconds,
    ],
  );

  const controls = useMemo(
    () => ({
      workDurationMinutes: state.config.workDuration,
      breakDurationMinutes: state.config.breakDuration,
      longBreakDurationMinutes: state.config.longBreakDuration,
      sessionsBeforeLongBreak: state.config.sessionsBeforeLongBreak,
      autoStartBreaks,
      targetSessions,
      presets,
      freeSessionTagIds,
      setFreeSessionTagIds,
      start,
      pause,
      reset,
      setPhase,
      setActiveItem,
      adjustRemainingMinutes,
      saveSettings,
      setAutoStartBreaks,
      createPreset,
      applyPreset,
      deletePreset,
    }),
    [
      state.config.workDuration,
      state.config.breakDuration,
      state.config.longBreakDuration,
      state.config.sessionsBeforeLongBreak,
      autoStartBreaks,
      targetSessions,
      presets,
      freeSessionTagIds,
      setFreeSessionTagIds,
      start,
      pause,
      reset,
      setPhase,
      setActiveItem,
      adjustRemainingMinutes,
      saveSettings,
      setAutoStartBreaks,
      createPreset,
      applyPreset,
      deletePreset,
    ],
  );

  const value = useMemo<TimerContextValue>(
    () => ({ ...live, ...controls }),
    [live, controls],
  );

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}

/** Clamp an integer minute/count value to [lo, hi]. */
function clampMinutes(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

// Re-export for the host barrel; keeps phaseDurationSeconds discoverable
// alongside the Provider (used by previews/tests).
export { phaseDurationSeconds };
