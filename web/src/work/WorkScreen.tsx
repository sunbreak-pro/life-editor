import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  PomodoroTimer,
  PomodoroTaskSelector,
  PomodoroTaskSheet,
  PomodoroSettings,
  SessionCompletionModal,
  AudioMixer,
  RightSidebarPortal,
  useTimerContext,
  useAudioContext,
  useMediaQuery,
  useTranslation,
  SOUND_PRESETS,
  cn,
  type DataService,
  type TaskOption,
  type TimerPhase,
  type AudioMixerSound,
} from "@life-editor/shared";
import { X, ChevronDown } from "lucide-react";

/*
 * Web Work tab host (target-IA import). Mounts inside the TimerProvider (wired
 * in MainScreen) and reads useTimerContext, then feeds the pure shared Pomodoro
 * primitives with t()-resolved copy (§6.4 — primitives never call
 * useTranslation). It fetches the (leaf, non-deleted) task list from the
 * injected DataService for the picker — the same "hosts may call getDataService"
 * allowance TrashScreen uses (§6.4).
 *
 * Layout (isWide = min-width 768px):
 *  - Desktop → three cards (timer / task / ambient) stacked; the shell's
 *    PageContainer (width="reading", #180 — adopted here per #181) owns the
 *    centered measure + page gutter, so this view keeps only its own card
 *    rhythm. The settings +
 *    presets editor is pushed into the shell rightSidebar via
 *    RightSidebarPortal (dimmed while the timer runs).
 *  - Mobile  → a single fullscreen timer face; the task chip opens a BottomSheet
 *    picker; the settings editor lives only in the shell's left drawer (also the
 *    portal). The ambient mixer is Desktop-only.
 *
 * A WORK-session completion (completedSessions increments) opens the
 * SessionCompletionModal.
 */

const WIDE_QUERY = "(min-width: 768px)";

/** Filled session dots: completedSessions within the current set. During a
 *  LONG_BREAK the set just wrapped, so show all dots filled (mod === 0). */
function filledDots(
  completed: number,
  perSet: number,
  phase: TimerPhase,
): number {
  if (perSet <= 0) return 0;
  const mod = completed % perSet;
  if (mod === 0 && completed > 0 && phase === "LONG_BREAK") return perSet;
  return mod;
}

/** "MM:SS" for a whole-minute phase length (the "/ 25:00" denominator). */
function formatMinutes(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WorkScreen({ dataService: ds }: { dataService: DataService }) {
  const { t } = useTranslation();
  const timer = useTimerContext();
  const isWide = useMediaQuery(WIDE_QUERY, true);
  // Optional (Mobile 省略 Provider) — null when no AudioProvider mounted.
  const audio = useAudioContext();
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);

  const mixerSounds = useMemo<AudioMixerSound[]>(
    () =>
      SOUND_PRESETS.map((p) => ({
        id: p.id,
        label: t(p.labelKey),
        icon: p.icon,
      })),
    [t],
  );

  useEffect(() => {
    // tasksLoading starts true (useState) so the initial fetch shows the
    // skeleton; the async .finally clears it. We avoid a synchronous
    // setState(true) here (react-hooks/set-state-in-effect) — a re-fetch on
    // ds change simply keeps the (still-valid) list visible until it resolves.
    let cancelled = false;
    void ds
      .fetchTaskTree()
      .then((nodes) => {
        if (cancelled) return;
        const options = nodes
          .filter((n) => n.type === "task" && !n.isDeleted)
          .map((n) => ({ id: n.id, title: n.title || t("common.untitled") }));
        setTasks(options);
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ds, t]);

  const phaseLabels = useMemo(
    (): Record<TimerPhase, string> => ({
      WORK: t("work.phase.WORK"),
      BREAK: t("work.phase.BREAK"),
      LONG_BREAK: t("work.phase.LONG_BREAK"),
    }),
    [t],
  );

  const sessionsProgress = t("work.sidebar.sessionsProgress", {
    completed: timer.completedSessions,
    target: timer.targetSessions,
  });

  const sessions = useMemo(
    () => ({
      total: timer.sessionsBeforeLongBreak,
      filled: filledDots(
        timer.completedSessions,
        timer.sessionsBeforeLongBreak,
        timer.phase,
      ),
    }),
    [timer.completedSessions, timer.sessionsBeforeLongBreak, timer.phase],
  );

  const totalFormatted = useMemo(
    () => formatMinutes(timer.totalSeconds),
    [timer.totalSeconds],
  );

  const handleSelectTask = useCallback(
    (task: TaskOption | null) => {
      timer.setActiveTask(task);
    },
    [timer],
  );

  // Skip = jump straight to the opposite phase (ends the current one early).
  const handleSkip = useCallback(() => {
    timer.setPhase(timer.phase === "WORK" ? "BREAK" : "WORK");
  }, [timer]);

  // --- WORK completion detection (open the modal on the count edge) ---
  // Initialise the ref to the current count on mount so a fresh mount with
  // completedSessions > 0 doesn't false-fire.
  const prevCompletedRef = useRef(timer.completedSessions);
  useEffect(() => {
    const prev = prevCompletedRef.current;
    if (timer.completedSessions > prev) {
      setCompletionOpen(true);
    }
    prevCompletedRef.current = timer.completedSessions;
  }, [timer.completedSessions]);

  // Completion copy: the WORK that just finished logged workDuration minutes;
  // the phase is already the upcoming break, so its length is the break copy.
  const breakMinutes =
    timer.phase === "LONG_BREAK"
      ? timer.longBreakDurationMinutes
      : timer.breakDurationMinutes;
  // `index`, not `count` — count is i18next's plural trigger and would look
  // up title_one/title_other instead of the base key.
  const completionTitle = t("work.completion.title", {
    index: timer.completedSessions,
  });
  const completionBody = timer.activeTask
    ? t("work.completion.body", {
        minutes: timer.workDurationMinutes,
        task: timer.activeTask.title,
        breakMinutes,
      })
    : t("work.completion.bodyNoTask", {
        minutes: timer.workDurationMinutes,
        breakMinutes,
      });

  const timerLabels = {
    phase: phaseLabels,
    start: t("work.controls.start"),
    pause: t("work.controls.pause"),
    resume: t("work.controls.resume"),
    reset: t("work.controls.reset"),
    skip: t("work.controls.skip"),
    paused: t("work.status.paused"),
    subtractFive: t("work.controls.subtractFive"),
    addFive: t("work.controls.addFive"),
    sessionsProgress,
  };

  const timerFace = (variant: "card" | "fullscreen", taskSlot?: ReactNode) => (
    <PomodoroTimer
      variant={variant}
      phase={timer.phase}
      isRunning={timer.isRunning}
      formatted={timer.formatted}
      totalFormatted={totalFormatted}
      progress={timer.progress}
      sessions={sessions}
      labels={timerLabels}
      taskSlot={taskSlot}
      onStart={timer.start}
      onPause={timer.pause}
      onReset={timer.reset}
      onSkip={handleSkip}
      onAdjust={timer.adjustRemainingMinutes}
    />
  );

  // Settings + presets — pushed into the shell detail panel (Desktop right /
  // Mobile left drawer). Dimmed while running (§design 367) — still operable.
  const settingsPanel = (
    <div className={cn(timer.isRunning && "opacity-[0.55]")}>
      <PomodoroSettings
        workDurationMinutes={timer.workDurationMinutes}
        breakDurationMinutes={timer.breakDurationMinutes}
        longBreakDurationMinutes={timer.longBreakDurationMinutes}
        sessionsBeforeLongBreak={timer.sessionsBeforeLongBreak}
        autoStartBreaks={timer.autoStartBreaks}
        targetSessions={timer.targetSessions}
        presets={timer.presets}
        labels={{
          settingsHeading: t("pomodoro.title"),
          workDuration: t("pomodoro.workDuration"),
          breakDuration: t("pomodoro.breakDuration"),
          longBreakDuration: t("pomodoro.longBreakDuration"),
          sessionsPerSet: t("pomodoro.sessionsPerSet"),
          targetSessions: t("work.sidebar.targetSessions"),
          autoStartBreaks: t("pomodoro.autoStartBreaks"),
          presets: t("pomodoro.presets"),
          presetsEmpty: t("work.settings.presetsEmpty"),
          presetNamePlaceholder: t("work.settings.presetNamePlaceholder"),
          saveAsPreset: t("work.settings.saveAsPreset"),
          apply: t("work.settings.apply"),
          deletePreset: t("pomodoro.deletePreset"),
        }}
        onWorkDurationChange={timer.setWorkDurationMinutes}
        onBreakDurationChange={timer.setBreakDurationMinutes}
        onLongBreakDurationChange={timer.setLongBreakDurationMinutes}
        onSessionsBeforeLongBreakChange={timer.setSessionsBeforeLongBreak}
        onAutoStartBreaksChange={timer.setAutoStartBreaks}
        onTargetSessionsChange={timer.setTargetSessions}
        onApplyPreset={(p) =>
          timer.applyPreset(
            timer.presets.find((x) => x.id === p.id) ?? { ...p, createdAt: "" },
          )
        }
        onCreatePreset={(name) => void timer.createPresetFromCurrent(name)}
        onDeletePreset={(id) => void timer.deletePreset(id)}
      />
    </div>
  );

  // Mobile task slot: the chip (selected) or a "choose a task" button that
  // opens the BottomSheet picker.
  const mobileTaskSlot = timer.activeTask ? (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lumen-md bg-lumen-chip-task-bg py-2 pl-3.5 pr-2.5 text-[13px] font-medium text-lumen-chip-task-fg">
      <span className="truncate">{timer.activeTask.title}</span>
      <button
        type="button"
        aria-label={t("work.taskSelector.clear")}
        onClick={() => handleSelectTask(null)}
        className="inline-flex shrink-0 items-center justify-center rounded p-0.5 hover:opacity-70"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setSheetOpen(true)}
      className="inline-flex items-center gap-2 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-3.5 py-2 text-[13px] font-medium text-lumen-text-secondary hover:bg-lumen-hover"
    >
      {t("work.taskSelector.select")}
      <ChevronDown size={15} aria-hidden="true" />
    </button>
  );

  const completionModal = (
    <SessionCompletionModal
      open={completionOpen}
      onClose={() => setCompletionOpen(false)}
      sessions={sessions}
      labels={{
        title: completionTitle,
        body: completionBody,
        startBreak: t("work.completion.startBreak"),
        oneMore: t("work.completion.oneMore"),
        close: t("work.completion.close"),
      }}
      onStartBreak={() => {
        timer.start();
        setCompletionOpen(false);
      }}
      onOneMore={() => {
        timer.setPhase("WORK");
        timer.start();
        setCompletionOpen(false);
      }}
    />
  );

  if (!isWide) {
    return (
      <div className="flex flex-col">
        {timerFace("fullscreen", mobileTaskSlot)}
        <RightSidebarPortal>{settingsPanel}</RightSidebarPortal>
        <PomodoroTaskSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          tasks={tasks}
          selectedId={timer.activeTask?.id ?? null}
          labels={{
            title: t("work.taskSelector.select"),
            clearSelection: t("work.taskSelector.clearSelection"),
            emptyHint: t("work.taskSelector.emptyHint"),
          }}
          onSelect={handleSelectTask}
        />
        {completionModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {timerFace("card")}
      <PomodoroTaskSelector
        tasks={tasks}
        selectedId={timer.activeTask?.id ?? null}
        loading={tasksLoading}
        labels={{
          heading: t("work.taskSelector.heading"),
          placeholder: t("work.taskSelector.placeholder"),
          clear: t("work.taskSelector.clear"),
          emptyHint: t("work.taskSelector.emptyHint"),
          menuLabel: t("work.taskSelector.heading"),
        }}
        onSelect={handleSelectTask}
      />
      {/*
       * Ambient mixer (W3-C). Only rendered when the AudioProvider is mounted
       * (web/desktop) — Mobile omits the Provider, so audio is null and the
       * mixer is skipped (CLAUDE.md §2 + vision §4 null-guard).
       */}
      {audio && (
        <AudioMixer
          sounds={mixerSounds}
          settings={audio.settings}
          labels={{
            heading: t("audioMixer.heading"),
            toggle: t("audioMixer.toggle"),
            volume: t("audioMixer.volume"),
          }}
          onToggle={audio.toggleEnabled}
          onVolumeChange={audio.setVolume}
        />
      )}
      <RightSidebarPortal>{settingsPanel}</RightSidebarPortal>
      {completionModal}
    </div>
  );
}
