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
import type { PomodoroPreset } from "../types/timer";
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
}

export function TimerProvider({
  children,
  dataService: ds,
  onSessionComplete,
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
  // Re-render pulse: bumped each second so the derived display recomputes.
  const [tickNow, setTickNow] = useState(() => Date.now());

  const onSessionCompleteRef = useRef(onSessionComplete);
  // Mirrored in an effect, not during render (#505). It is only read from
  // the tick effect below, which runs after the commit, so the value it
  // sees is unchanged.
  useEffect(() => {
    onSessionCompleteRef.current = onSessionComplete;
  });

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
  useEffect(() => {
    if (!state.isRunning) return;
    const id = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.isRunning]);

  // --- session log helpers ---
  const startSession = useCallback(
    (phase: TimerPhase, item: ActiveWorkItem | null) => {
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
        })
        .catch((e) => logServiceError("Timer", "startTimerSession", e));
    },
    [ds],
  );

  const closeSession = useCallback(
    (durationSeconds: number, completed: boolean) => {
      const id = currentSessionIdRef.current;
      if (id === null) return;
      currentSessionIdRef.current = null;
      void ds
        .endTimerSession(id, durationSeconds, completed)
        .catch((e) => logServiceError("Timer", "endTimerSession", e));
    },
    [ds],
  );

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
      // The phase ran its full target.
      closeSession(totalSeconds, true);
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
    // A fresh segment from elapsed 0 means a new session row.
    if (state.accumulatedMs === 0 && currentSessionIdRef.current === null) {
      startSession(state.phase, state.activeItem);
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
    // Close the in-flight row as a non-completed partial (elapsed seconds).
    closeSession(elapsed, false);
  }, [state, closeSession]);

  /*
   * Reset does NOT retract what was already logged (#1475). By the time it runs
   * the row is usually closed already — a pause closes it as a partial — so
   * there is nothing left here to withdraw, and a run abandoned after 20 real
   * minutes is still time that was worked. Whether a row counts is decided when
   * the log is read: `isCountedSession` (utils/timerSessions) drops the
   * seconds-long scraps an aborted start leaves behind, which also cleans the
   * ones earlier builds already wrote.
   */
  const reset = useCallback(() => {
    const now = Date.now();
    const elapsed = computeElapsed(state, now);
    if (currentSessionIdRef.current !== null) closeSession(elapsed, false);
    dispatch({ type: "RESET" });
    setTickNow(now);
  }, [state, closeSession]);

  const setPhase = useCallback(
    (phase: TimerPhase) => {
      const now = Date.now();
      if (currentSessionIdRef.current !== null)
        closeSession(computeElapsed(state, now), false);
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
