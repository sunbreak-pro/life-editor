import {
  useReducer,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { TimerContext } from "./TimerContextValue";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { getDataService } from "../services";
import { timerReducer, createInitialState, getDuration } from "./timerReducer";
import { playEffectSound } from "../utils/playEffectSound";

function sendNotification(body: string) {
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    const enabled = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
    if (enabled === "true") {
      new Notification("Life Editor", { body });
    }
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(timerReducer, undefined, () =>
    createInitialState(),
  );
  const intervalRef = useRef<number | null>(null);
  const currentSessionIdRef = useRef<number | null>(null);
  const [autoStartBreaks, setAutoStartBreaksState] = useState(false);
  const [targetSessions, setTargetSessionsState] = useState(4);
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);

  // Load settings from DataService on mount
  useEffect(() => {
    let cancelled = false;
    getDataService()
      .fetchTimerSettings()
      .then((settings) => {
        if (cancelled) return;
        dispatch({
          type: "SET_CONFIG",
          config: {
            workDuration: (settings.workDuration ?? 25) * 60,
            breakDuration: (settings.breakDuration ?? 5) * 60,
            longBreakDuration: (settings.longBreakDuration ?? 15) * 60,
            sessionsBeforeLongBreak: settings.sessionsBeforeLongBreak ?? 4,
          },
        });
        setAutoStartBreaksState(!!settings.autoStartBreaks);
        setTargetSessionsState(settings.targetSessions ?? 4);
      })
      .catch((e) => console.warn("[Timer] fetch settings:", e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const totalDuration = getDuration(state.sessionType, state.config);
  const progress =
    ((totalDuration - state.remainingSeconds) / totalDuration) * 100;

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const endCurrentSession = useCallback(
    (duration: number, completed: boolean) => {
      if (currentSessionIdRef.current !== null) {
        getDataService()
          .endTimerSession(currentSessionIdRef.current, duration, completed)
          .catch((e) => console.warn("[Timer] end session:", e.message));
        currentSessionIdRef.current = null;
      }
    },
    [],
  );

  const advanceSession = useCallback(() => {
    clearTimer();
    // End current session as completed
    const completedDuration = getDuration(state.sessionType, state.config);
    endCurrentSession(completedDuration, true);

    dispatch({ type: "ADVANCE_SESSION" });

    if (state.sessionType === "WORK") {
      const nextCompleted = state.completedSessions + 1;
      const willBeLongBreak =
        nextCompleted % state.config.sessionsBeforeLongBreak === 0;
      sendNotification("WORK完了！");
      if (willBeLongBreak) {
        playEffectSound(
          "/sounds/pomodoro_complete_sound.mp3",
          "pomodoroComplete",
        );
      } else {
        playEffectSound(
          "/sounds/session_complete_sound.mp3",
          "sessionComplete",
        );
      }
    } else {
      sendNotification("休憩終了！作業を再開しましょう");
      playEffectSound("/sounds/session_complete_sound.mp3", "sessionComplete");
    }
  }, [
    clearTimer,
    endCurrentSession,
    state.sessionType,
    state.config,
    state.completedSessions,
  ]);

  // Timer interval effect
  useEffect(() => {
    if (!state.isRunning) {
      clearTimer();
      return;
    }

    intervalRef.current = window.setInterval(() => {
      dispatch({ type: "TICK" });
    }, 1000);

    return clearTimer;
  }, [state.isRunning, clearTimer]);

  // Watch for timer reaching zero
  useEffect(() => {
    if (state.isRunning && state.remainingSeconds <= 0) {
      advanceSession();
    }
  }, [state.remainingSeconds, state.isRunning, advanceSession]);

  // Update tray timer display
  useEffect(() => {
    if (!window.electronAPI) return;
    const mins = Math.floor(state.remainingSeconds / 60);
    const secs = state.remainingSeconds % 60;
    const remaining = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    window.electronAPI
      .invoke("tray:updateTimer", { remaining, isRunning: state.isRunning })
      .catch(() => {});
  }, [state.remainingSeconds, state.isRunning]);

  const start = useCallback(() => {
    if (state.sessionType === "WORK") {
      playEffectSound("/sounds/session_start_sound.mp3", "sessionStart");
    }
    dispatch({ type: "START" });
    getDataService()
      .startTimerSession(state.sessionType, state.activeTask?.id)
      .then((session) => {
        currentSessionIdRef.current = session.id;
      })
      .catch((e) => console.warn("[Timer] start session:", e.message));
  }, [state.sessionType, state.activeTask]);

  const pause = useCallback(() => {
    dispatch({ type: "PAUSE" });
    const total = getDuration(state.sessionType, state.config);
    endCurrentSession(total - state.remainingSeconds, false);
  }, [
    endCurrentSession,
    state.sessionType,
    state.config,
    state.remainingSeconds,
  ]);

  const reset = useCallback(() => {
    clearTimer();
    endCurrentSession(0, false);
    dispatch({ type: "RESET" });
  }, [clearTimer, endCurrentSession]);

  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  const startForTask = useCallback(
    (id: string, title: string) => {
      clearTimer();
      endCurrentSession(0, false);
      playEffectSound("/sounds/session_start_sound.mp3", "sessionStart");
      const durationSeconds = state.config.workDuration;
      dispatch({
        type: "START_FOR_TASK",
        task: { id, title },
        durationSeconds,
      });
      getDataService()
        .startTimerSession("WORK", id)
        .then((session) => {
          currentSessionIdRef.current = session.id;
        })
        .catch((e) => console.warn("[Timer] start session:", e.message));
    },
    [clearTimer, endCurrentSession, state.config.workDuration],
  );

  const openForTask = useCallback(
    (id: string, title: string, durationMinutes?: number) => {
      clearTimer();
      endCurrentSession(0, false);
      const dur = durationMinutes ?? state.config.workDuration / 60;
      dispatch({
        type: "OPEN_FOR_TASK",
        task: { id, title },
        durationSeconds: dur * 60,
      });
    },
    [clearTimer, endCurrentSession, state.config.workDuration],
  );

  const clearTask = useCallback(() => {
    dispatch({ type: "SET_ACTIVE_TASK", task: null });
  }, []);

  const updateActiveTaskTitle = useCallback((title: string) => {
    dispatch({ type: "UPDATE_ACTIVE_TASK_TITLE", title });
  }, []);

  const syncSettings = useCallback(
    (w: number, b: number, lb: number, s: number) => {
      getDataService()
        .updateTimerSettings({
          workDuration: w,
          breakDuration: b,
          longBreakDuration: lb,
          sessionsBeforeLongBreak: s,
        })
        .catch((e) => console.warn("[Timer] sync settings:", e.message));
    },
    [],
  );

  const workDurationMinutes = state.config.workDuration / 60;
  const breakDurationMinutes = state.config.breakDuration / 60;
  const longBreakDurationMinutes = state.config.longBreakDuration / 60;

  const setWorkDurationMinutes = useCallback(
    (min: number) => {
      const clamped = Math.max(5, Math.min(240, min));
      dispatch({ type: "SET_CONFIG", config: { workDuration: clamped * 60 } });
      syncSettings(
        clamped,
        state.config.breakDuration / 60,
        state.config.longBreakDuration / 60,
        state.config.sessionsBeforeLongBreak,
      );
    },
    [syncSettings, state.config],
  );

  const setBreakDurationMinutes = useCallback(
    (min: number) => {
      const clamped = Math.max(1, Math.min(60, min));
      dispatch({ type: "SET_CONFIG", config: { breakDuration: clamped * 60 } });
      syncSettings(
        state.config.workDuration / 60,
        clamped,
        state.config.longBreakDuration / 60,
        state.config.sessionsBeforeLongBreak,
      );
    },
    [syncSettings, state.config],
  );

  const setLongBreakDurationMinutes = useCallback(
    (min: number) => {
      const clamped = Math.max(1, Math.min(60, min));
      dispatch({
        type: "SET_CONFIG",
        config: { longBreakDuration: clamped * 60 },
      });
      syncSettings(
        state.config.workDuration / 60,
        state.config.breakDuration / 60,
        clamped,
        state.config.sessionsBeforeLongBreak,
      );
    },
    [syncSettings, state.config],
  );

  const setSessionsBeforeLongBreak = useCallback(
    (count: number) => {
      const clamped = Math.max(1, Math.min(20, count));
      dispatch({
        type: "SET_CONFIG",
        config: { sessionsBeforeLongBreak: clamped },
      });
      syncSettings(
        state.config.workDuration / 60,
        state.config.breakDuration / 60,
        state.config.longBreakDuration / 60,
        clamped,
      );
    },
    [syncSettings, state.config],
  );

  const extendWork = useCallback(
    (minutes: number) => {
      dispatch({ type: "EXTEND_WORK", minutes });
      getDataService()
        .startTimerSession("WORK", state.activeTask?.id)
        .then((session) => {
          currentSessionIdRef.current = session.id;
        })
        .catch((e) => console.warn("[Timer] start session:", e.message));
    },
    [state.activeTask],
  );

  const startRest = useCallback(() => {
    const isLongBreak =
      state.completedSessions % state.config.sessionsBeforeLongBreak === 0;
    dispatch({ type: "START_REST" });
    const st = isLongBreak ? "LONG_BREAK" : "BREAK";
    getDataService()
      .startTimerSession(st as "LONG_BREAK" | "BREAK", state.activeTask?.id)
      .then((session) => {
        currentSessionIdRef.current = session.id;
      })
      .catch((e) => console.warn("[Timer] start session:", e.message));
  }, [
    state.completedSessions,
    state.config.sessionsBeforeLongBreak,
    state.activeTask,
  ]);

  const dismissCompletionModal = useCallback(() => {
    dispatch({ type: "DISMISS_COMPLETION_MODAL" });
  }, []);

  const setAutoStartBreaks = useCallback((enabled: boolean) => {
    setAutoStartBreaksState(enabled);
    getDataService()
      .updateTimerSettings({ autoStartBreaks: enabled })
      .catch((e) => console.warn("[Timer] update autoStartBreaks:", e.message));
  }, []);

  const setTargetSessions = useCallback((count: number) => {
    const clamped = Math.max(1, Math.min(20, count));
    setTargetSessionsState(clamped);
    getDataService()
      .updateTimerSettings({ targetSessions: clamped })
      .catch((e) => console.warn("[Timer] update targetSessions:", e.message));
  }, []);

  const adjustRemainingSeconds = useCallback(
    (delta: number) => {
      const newSeconds = Math.max(0, state.remainingSeconds + delta);
      dispatch({ type: "SET_REMAINING", seconds: newSeconds });
    },
    [state.remainingSeconds],
  );

  const startRoutineTimer = useCallback(
    (routineId: string, title: string, durationMinutes?: number) => {
      clearTimer();
      endCurrentSession(0, false);
      playEffectSound("/sounds/session_start_sound.mp3", "sessionStart");
      setActiveRoutineId(routineId);
      const dur = durationMinutes ?? state.config.workDuration / 60;
      dispatch({
        type: "START_FOR_TASK",
        task: { id: routineId, title },
        durationSeconds: dur * 60,
      });
      getDataService()
        .startTimerSession("WORK", routineId)
        .then((session) => {
          currentSessionIdRef.current = session.id;
        })
        .catch((e) => console.warn("[Timer] start session:", e.message));
    },
    [clearTimer, endCurrentSession, state.config.workDuration],
  );

  const value = useMemo(
    () => ({
      sessionType: state.sessionType,
      remainingSeconds: state.remainingSeconds,
      isRunning: state.isRunning,
      completedSessions: state.completedSessions,
      progress,
      totalDuration,
      sessionsBeforeLongBreak: state.config.sessionsBeforeLongBreak,
      workDurationMinutes,
      breakDurationMinutes,
      longBreakDurationMinutes,
      activeTask: state.activeTask,
      showCompletionModal: state.showCompletionModal,
      completedSessionType: state.completedSessionType,
      start,
      pause,
      reset,
      formatTime,
      startForTask,
      openForTask,
      clearTask,
      updateActiveTaskTitle,
      setWorkDurationMinutes,
      setBreakDurationMinutes,
      setLongBreakDurationMinutes,
      setSessionsBeforeLongBreak,
      extendWork,
      startRest,
      dismissCompletionModal,
      autoStartBreaks,
      setAutoStartBreaks,
      targetSessions,
      setTargetSessions,
      adjustRemainingSeconds,
      activeRoutineId,
      startRoutineTimer,
    }),
    [
      state.sessionType,
      state.remainingSeconds,
      state.isRunning,
      state.completedSessions,
      progress,
      totalDuration,
      state.config.sessionsBeforeLongBreak,
      workDurationMinutes,
      breakDurationMinutes,
      longBreakDurationMinutes,
      state.activeTask,
      state.showCompletionModal,
      state.completedSessionType,
      start,
      pause,
      reset,
      formatTime,
      startForTask,
      openForTask,
      clearTask,
      updateActiveTaskTitle,
      setWorkDurationMinutes,
      setBreakDurationMinutes,
      setLongBreakDurationMinutes,
      setSessionsBeforeLongBreak,
      extendWork,
      startRest,
      dismissCompletionModal,
      autoStartBreaks,
      setAutoStartBreaks,
      targetSessions,
      setTargetSessions,
      adjustRemainingSeconds,
      activeRoutineId,
      startRoutineTimer,
    ],
  );

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}
