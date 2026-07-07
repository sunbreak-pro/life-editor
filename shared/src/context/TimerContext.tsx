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
import { useSyncContext } from "../hooks/useSyncContext";
import { TimerContext, type TimerContextValue } from "./TimerContextValue";
import {
  timerReducer,
  createInitialState,
  phaseDurationSeconds,
  remainingSeconds as computeRemaining,
  elapsedSeconds as computeElapsed,
  type ActiveTask,
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
  const { syncVersion } = useSyncContext();
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
  onSessionCompleteRef.current = onSessionComplete;

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
    (phase: TimerPhase, taskId: string | null) => {
      void ds
        .startTimerSession(phase, taskId ?? undefined)
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
      // Auto-start the freshly-entered phase.
      const now = Date.now();
      startSession(state.phase, state.activeTask?.id ?? null);
      dispatch({ type: "START", now });
      setTickNow(now);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  // --- controls ---
  const start = useCallback(() => {
    if (state.isRunning) return;
    const now = Date.now();
    // A fresh segment from elapsed 0 means a new session row.
    if (state.accumulatedMs === 0 && currentSessionIdRef.current === null) {
      startSession(state.phase, state.activeTask?.id ?? null);
    }
    dispatch({ type: "START", now });
    setTickNow(now);
  }, [
    state.isRunning,
    state.accumulatedMs,
    state.phase,
    state.activeTask,
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

  const setActiveTask = useCallback((task: ActiveTask | null) => {
    dispatch({ type: "SET_ACTIVE_TASK", task });
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

  const setWorkDurationMinutes = useCallback(
    (min: number) => {
      const v = clampMinutes(min, 1, 240);
      dispatch({ type: "SET_CONFIG", config: { workDuration: v } });
      persistSettings({ workDuration: v });
    },
    [persistSettings],
  );

  const setBreakDurationMinutes = useCallback(
    (min: number) => {
      const v = clampMinutes(min, 1, 60);
      dispatch({ type: "SET_CONFIG", config: { breakDuration: v } });
      persistSettings({ breakDuration: v });
    },
    [persistSettings],
  );

  const setLongBreakDurationMinutes = useCallback(
    (min: number) => {
      const v = clampMinutes(min, 1, 60);
      dispatch({ type: "SET_CONFIG", config: { longBreakDuration: v } });
      persistSettings({ longBreakDuration: v });
    },
    [persistSettings],
  );

  const setSessionsBeforeLongBreak = useCallback(
    (count: number) => {
      const v = clampMinutes(count, 1, 20);
      dispatch({ type: "SET_CONFIG", config: { sessionsBeforeLongBreak: v } });
      persistSettings({ sessionsBeforeLongBreak: v });
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

  const setTargetSessions = useCallback(
    (count: number) => {
      const v = clampMinutes(count, 1, 20);
      setTargetSessionsState(v);
      persistSettings({ targetSessions: v });
    },
    [persistSettings],
  );

  // --- preset CRUD ---
  const createPresetFromCurrent = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        const created = await ds.createPomodoroPreset({
          name: trimmed,
          workDuration: state.config.workDuration,
          breakDuration: state.config.breakDuration,
          longBreakDuration: state.config.longBreakDuration,
          sessionsBeforeLongBreak: state.config.sessionsBeforeLongBreak,
        });
        setPresets((prev) => [...prev, created]);
      } catch (e) {
        logServiceError("Timer", "createPomodoroPreset", e);
      }
    },
    [ds, state.config],
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

  const value = useMemo<TimerContextValue>(
    () => ({
      phase: state.phase,
      isRunning: state.isRunning,
      remainingSeconds: remaining,
      progress,
      totalSeconds,
      completedSessions: state.completedSessions,
      formatted,
      activeTask: state.activeTask,
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
      setActiveTask,
      adjustRemainingMinutes,
      setWorkDurationMinutes,
      setBreakDurationMinutes,
      setLongBreakDurationMinutes,
      setSessionsBeforeLongBreak,
      setAutoStartBreaks,
      setTargetSessions,
      createPresetFromCurrent,
      applyPreset,
      deletePreset,
    }),
    [
      state.phase,
      state.isRunning,
      remaining,
      progress,
      totalSeconds,
      state.completedSessions,
      formatted,
      state.activeTask,
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
      setActiveTask,
      adjustRemainingMinutes,
      setWorkDurationMinutes,
      setBreakDurationMinutes,
      setLongBreakDurationMinutes,
      setSessionsBeforeLongBreak,
      setAutoStartBreaks,
      setTargetSessions,
      createPresetFromCurrent,
      applyPreset,
      deletePreset,
    ],
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
