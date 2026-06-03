import {
  addTimerSession,
  getState as getMockState,
  setActivePresetId,
  setCurrentTaskId,
  subscribe as subscribeMock,
  updateScheduleItem,
} from "./mockStore";
import type { PomodoroPreset, SessionType } from "./types";

/**
 * Pomodoro timer runtime engine (module singleton).
 *
 * Lives OUTSIDE the React tree (like `mockStore`) so the countdown keeps running
 * regardless of which section is mounted. Components subscribe via the `useTimer`
 * selector hook, so only the parts that read a changing slice re-render on each tick.
 *
 * Countdown is wall-clock authoritative: every timer carries an absolute `endTime`
 * (epoch ms) and remaining seconds are recomputed as `endTime - now`, so background
 * throttling / device lock self-corrects the instant a tick fires.
 *
 * Multi-timer: besides the focused "active" timer there can be up to two background
 * WORK timers (`heldTimers`) — at most 3 WORK timers run in parallel. Switching task
 * can snapshot the current timer into the held set instead of discarding it; the tick
 * loop advances the held timers too and logs them on completion.
 */
export interface CompletionInfo {
  type: SessionType;
  durationSec: number;
  skipped: boolean;
}

/** A backgrounded WORK timer kept alive while another timer is focused. */
export interface HeldTimer {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  remainingSec: number;
  isRunning: boolean;
  endTime: number | null;
  startedAt: number;
  planned: number;
  draftComment: string;
}

export interface TimerEngineState {
  sessionType: SessionType;
  remainingSec: number;
  isRunning: boolean;
  /** Active session begun at least once (running OR paused) → holdable / resumable. */
  hasStarted: boolean;
  completedWorks: number;
  /** Bumped to retrigger the big-number pulse animation (used as a React key). */
  pulseKey: number;
  /** Seconds left before an auto-started break begins, or null when inactive. */
  autoCountdown: number | null;
  completionModal: CompletionInfo | null;
  /** Live memo for the current WORK session; saved onto the session at the end. */
  draftComment: string;
  /** Background WORK timers running in parallel with the active one. */
  heldTimers: HeldTimer[];
}

export const MAX_PARALLEL_TIMERS = 3;
const MAX_HELD = MAX_PARALLEL_TIMERS - 1; // active (1) + held (2) = 3

const FALLBACK_WORK_SEC = 25 * 60;
const FALLBACK_BREAK_SEC = 5 * 60;

const plannedSecFor = (preset: PomodoroPreset, type: SessionType): number => {
  if (type === "WORK") return preset.workMin * 60;
  if (type === "BREAK") return preset.breakMin * 60;
  return preset.longBreakMin * 60;
};

function activePreset(): PomodoroPreset | null {
  const s = getMockState();
  const list = s.presets.filter((p) => !p.isDeleted);
  return list.find((p) => p.id === s.activePresetId) ?? list[0] ?? null;
}

function plannedFor(type: SessionType): number {
  const p = activePreset();
  if (p) return plannedSecFor(p, type);
  return type === "WORK" ? FALLBACK_WORK_SEC : FALLBACK_BREAK_SEC;
}

let state: TimerEngineState = {
  sessionType: "WORK",
  remainingSec: plannedFor("WORK"),
  isRunning: false,
  hasStarted: false,
  completedWorks: 0,
  pulseKey: 0,
  autoCountdown: null,
  completionModal: null,
  draftComment: "",
  heldTimers: [],
};

// Active-timer runtime, kept off the subscribed snapshot (no re-render on change).
let endTime: number | null = null; // absolute epoch ms while the active timer runs
let startedAt = 0; // first start of the active session (for the log)
let planned = state.remainingSec; // planned seconds captured at session start
let tickHandle: number | null = null;
let autoHandle: number | null = null;
let heldCounter = 0;

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function subscribeTimer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTimerState(): TimerEngineState {
  return state;
}

function set(patch: Partial<TimerEngineState>): void {
  state = { ...state, ...patch };
  notify();
}

function clearAuto(): void {
  if (autoHandle !== null) {
    clearTimeout(autoHandle);
    autoHandle = null;
  }
}

/** Any explicit user action cancels a pending auto-start-break countdown. */
function cancelAuto(): void {
  clearAuto();
  if (state.autoCountdown !== null) set({ autoCountdown: null });
}

/** Start/stop the shared interval depending on whether anything is running. */
function ensureTick(): void {
  const need =
    (state.isRunning && endTime !== null) ||
    state.heldTimers.some((t) => t.isRunning);
  if (need && tickHandle === null) {
    tickHandle = window.setInterval(syncAll, 250);
  } else if (!need && tickHandle !== null) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

/** Advance the active timer and every held timer from the wall clock. */
function syncAll(): void {
  if (state.isRunning && endTime !== null) {
    const rem = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    if (rem !== state.remainingSec) set({ remainingSec: rem });
    if (rem <= 0) {
      endTime = null;
      endSession(false);
    }
  }

  if (state.heldTimers.length > 0) {
    let changed = false;
    const next: HeldTimer[] = [];
    for (const t of state.heldTimers) {
      if (t.isRunning && t.endTime !== null) {
        const rem = Math.max(0, Math.ceil((t.endTime - Date.now()) / 1000));
        if (rem <= 0) {
          logHeldCompletion(t);
          changed = true;
          continue; // drop the finished background timer
        }
        if (rem !== t.remainingSec) {
          next.push({ ...t, remainingSec: rem });
          changed = true;
          continue;
        }
      }
      next.push(t);
    }
    if (changed) set({ heldTimers: next });
  }

  ensureTick();
}

// One shared visibility listener: recompute the instant the app is foregrounded.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncAll();
  });
}

/**
 * Keep the idle display in sync with the active preset / session type. Fires on every
 * mock-store change but only acts while idle so a running or paused session (or held
 * timers) are never disturbed.
 */
function refreshIdle(): void {
  if (state.isRunning || state.hasStarted) return;
  const p = plannedFor(state.sessionType);
  planned = p;
  if (state.remainingSec !== p) set({ remainingSec: p });
}
subscribeMock(refreshIdle);

export function setDraftComment(text: string): void {
  if (text !== state.draftComment) set({ draftComment: text });
}

export function startTimer(): void {
  cancelAuto();
  // Only a fresh start fixes the origin + planned; a resume keeps remainingSec.
  if (!state.hasStarted) {
    startedAt = Date.now();
    planned = plannedFor(state.sessionType);
  }
  endTime = Date.now() + state.remainingSec * 1000;
  set({ isRunning: true, hasStarted: true });
  ensureTick();
}

export function pauseTimer(): void {
  if (endTime !== null) {
    const rem = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    set({ remainingSec: rem });
  }
  endTime = null;
  set({ isRunning: false });
  ensureTick();
}

export function resetTimer(): void {
  cancelAuto();
  endTime = null;
  startedAt = 0;
  const p = plannedFor(state.sessionType);
  planned = p;
  set({
    isRunning: false,
    hasStarted: false,
    remainingSec: p,
    draftComment: "",
  });
  ensureTick();
}

function endSession(skipped: boolean): void {
  const mock = getMockState();
  const tasks = mock.scheduleItems.filter(
    (i) => !i.isDeleted && i.type === "task",
  );
  const currentTask = tasks.find((t) => t.id === mock.currentTaskId) ?? null;

  // skip → derive remaining from endTime so the elapsed figure is exact.
  let rem = state.remainingSec;
  if (skipped && endTime !== null) {
    rem = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  }
  endTime = null;
  const elapsed = skipped ? Math.max(0, planned - rem) : planned;
  let startAtMs = startedAt;
  if (startAtMs === 0) startAtMs = Date.now() - elapsed * 1000;

  const wasWork = state.sessionType === "WORK";
  const comment = wasWork ? state.draftComment.trim() || undefined : undefined;
  addTimerSession({
    scheduleItemId: wasWork ? (currentTask?.id ?? null) : null,
    scheduleItemTitle: wasWork ? (currentTask?.title ?? null) : null,
    sessionType: state.sessionType,
    plannedSec: planned,
    durationSec: elapsed,
    startedAt: startAtMs,
    completedAt: Date.now(),
    comment,
  });

  startedAt = 0;
  set({
    isRunning: false,
    hasStarted: false,
    pulseKey: state.pulseKey + 1,
    completedWorks:
      wasWork && !skipped ? state.completedWorks + 1 : state.completedWorks,
    completionModal: { type: state.sessionType, durationSec: elapsed, skipped },
    draftComment: "",
  });

  if (wasWork && !skipped && currentTask && currentTask.status === "todo") {
    updateScheduleItem(currentTask.id, { status: "doing" });
  }
  ensureTick();
}

/** Log a background WORK timer that reached zero, then it is dropped from the set. */
function logHeldCompletion(t: HeldTimer): void {
  addTimerSession({
    scheduleItemId: t.taskId,
    scheduleItemTitle: t.taskTitle,
    sessionType: "WORK",
    plannedSec: t.planned,
    durationSec: t.planned,
    startedAt: t.startedAt || Date.now() - t.planned * 1000,
    completedAt: Date.now(),
    comment: t.draftComment.trim() || undefined,
  });
  const mock = getMockState();
  const task = mock.scheduleItems.find((i) => i.id === t.taskId);
  set({ completedWorks: state.completedWorks + 1 });
  if (task && task.status === "todo") {
    updateScheduleItem(task.id, { status: "doing" });
  }
}

export function skipTimer(): void {
  endSession(true);
}

/**
 * Switch WORK / BREAK / LONG_BREAK. Always stops + resets the ACTIVE timer to the new
 * type's full time (held timers are untouched). Caller confirms first when running.
 */
export function changeSessionType(t: SessionType): void {
  cancelAuto();
  endTime = null;
  startedAt = 0;
  const p = plannedFor(t);
  planned = p;
  set({
    sessionType: t,
    isRunning: false,
    hasStarted: false,
    remainingSec: p,
    draftComment: "",
  });
  ensureTick();
}

/**
 * Switch the active preset and reset the ACTIVE timer to its current-type full time.
 * Caller confirms first when the active timer is in progress.
 */
export function changePreset(id: string): void {
  cancelAuto();
  setActivePresetId(id);
  endTime = null;
  startedAt = 0;
  const p = plannedFor(state.sessionType);
  planned = p;
  set({
    isRunning: false,
    hasStarted: false,
    remainingSec: p,
    draftComment: "",
  });
  ensureTick();
}

function runAutoTick(): void {
  clearAuto();
  const n = state.autoCountdown;
  if (n === null) return;
  if (n <= 0) {
    const p = plannedFor("BREAK");
    planned = p;
    startedAt = Date.now();
    endTime = Date.now() + p * 1000;
    set({
      autoCountdown: null,
      sessionType: "BREAK",
      remainingSec: p,
      isRunning: true,
      hasStarted: true,
    });
    ensureTick();
    return;
  }
  autoHandle = window.setTimeout(() => {
    set({ autoCountdown: (state.autoCountdown ?? 0) - 1 });
    runAutoTick();
  }, 1000);
}

export function nextSession(): void {
  const cm = state.completionModal;
  if (!cm) return;
  const justFinished = cm.type;
  const mock = getMockState();
  const sbl = activePreset()?.sessionsBeforeLongBreak ?? 4;

  let nextType: SessionType;
  if (justFinished === "WORK") {
    const cycle = (state.completedWorks + 1) % sbl;
    nextType = cycle === 0 ? "LONG_BREAK" : "BREAK";
  } else {
    nextType = "WORK";
  }

  endTime = null;
  startedAt = 0;
  const p = plannedFor(nextType);
  planned = p;
  set({
    completionModal: null,
    sessionType: nextType,
    remainingSec: p,
    isRunning: false,
    hasStarted: false,
  });

  if (justFinished === "WORK" && mock.autoStartBreaks && nextType !== "WORK") {
    set({ autoCountdown: 5 });
    runAutoTick();
  }
  ensureTick();
}

export function stopCompletion(): void {
  cancelAuto();
  endTime = null;
  startedAt = 0;
  const p = plannedFor(state.sessionType);
  planned = p;
  set({
    completionModal: null,
    isRunning: false,
    hasStarted: false,
    remainingSec: p,
  });
  ensureTick();
}

// ===== Multi-timer (parallel WORK timers, keyed by task) =====

/** The active timer can be backgrounded only if it is a WORK session in progress. */
function canHoldActive(): boolean {
  return state.sessionType === "WORK" && state.hasStarted;
}

function buildActiveSnapshot(): HeldTimer {
  const mock = getMockState();
  const task = mock.scheduleItems.find(
    (i) => !i.isDeleted && i.type === "task" && i.id === mock.currentTaskId,
  );
  let rem = state.remainingSec;
  let et: number | null = null;
  if (state.isRunning && endTime !== null) {
    rem = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    et = endTime;
  }
  heldCounter += 1;
  return {
    id: `held-${heldCounter}`,
    taskId: mock.currentTaskId,
    taskTitle: task?.title ?? null,
    remainingSec: rem,
    isRunning: state.isRunning,
    endTime: state.isRunning ? et : null,
    startedAt,
    planned,
    draftComment: state.draftComment,
  };
}

function freshActiveForTask(taskId: string | null): void {
  endTime = null;
  startedAt = 0;
  const p = plannedFor("WORK");
  planned = p;
  set({
    sessionType: "WORK",
    isRunning: false,
    hasStarted: false,
    remainingSec: p,
    draftComment: "",
  });
  setCurrentTaskId(taskId);
}

function restoreHeld(held: HeldTimer): void {
  endTime = held.isRunning ? held.endTime : null;
  startedAt = held.startedAt;
  planned = held.planned;
  set({
    sessionType: "WORK",
    remainingSec: held.remainingSec,
    isRunning: held.isRunning,
    hasStarted: true,
    draftComment: held.draftComment,
    completionModal: null,
  });
  setCurrentTaskId(held.taskId);
}

/** Make `taskId` the active timer: resume its held timer if one exists, else fresh. */
function activateTask(taskId: string | null): void {
  cancelAuto();
  const idx = state.heldTimers.findIndex((t) => t.taskId === taskId);
  if (idx >= 0) {
    const held = state.heldTimers[idx];
    set({ heldTimers: state.heldTimers.filter((_, i) => i !== idx) });
    restoreHeld(held);
  } else {
    freshActiveForTask(taskId);
  }
  ensureTick();
}

/** Switch to `taskId`, DISCARDING the current active timer (or it was idle). */
export function switchTask(taskId: string | null): void {
  activateTask(taskId);
}

/**
 * Snapshot the in-progress active timer into the held set, then switch to `taskId`.
 * Returns false when the held set is already full (caller surfaces the limit).
 */
export function keepAndSwitchTask(taskId: string | null): boolean {
  if (canHoldActive()) {
    const targetIsHeld = state.heldTimers.some((t) => t.taskId === taskId);
    const projectedHeld = targetIsHeld
      ? state.heldTimers.length // +1 hold, -1 restore → unchanged
      : state.heldTimers.length + 1;
    if (projectedHeld > MAX_HELD) return false;
    set({ heldTimers: [...state.heldTimers, buildActiveSnapshot()] });
  }
  activateTask(taskId);
  return true;
}

/** Focus a held timer (sidebar). Keeps the current active by snapshotting it first. */
export function activateHeldTimer(heldId: string): void {
  cancelAuto();
  const target = state.heldTimers.find((t) => t.id === heldId);
  if (!target) return;
  let held = state.heldTimers.filter((t) => t.id !== heldId);
  if (canHoldActive()) {
    held = [...held, buildActiveSnapshot()];
  }
  set({ heldTimers: held });
  restoreHeld(target);
  ensureTick();
}
