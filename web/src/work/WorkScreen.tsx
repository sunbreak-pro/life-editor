import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  PomodoroTimer,
  PomodoroTodoSelector,
  PomodoroTodoSheet,
  PomodoroSettings,
  SessionCompletionModal,
  AudioMixer,
  RightSidebarPortal,
  useTimerContext,
  useAudioContext,
  useMediaQuery,
  isNativeMobile,
  useTranslation,
  SOUND_PRESETS,
  cn,
  type DataService,
  type TodoOption,
  type TimerPhase,
  type AudioMixerSound,
  WIDE_QUERY,
} from "@life-editor/shared";
import { X, ChevronDown } from "lucide-react";

/*
 * Web Work tab host (target-IA import). Mounts inside the TimerProvider (wired
 * in MainScreen) and reads useTimerContext, then feeds the pure shared Pomodoro
 * primitives with t()-resolved copy (§6.4 — primitives never call
 * useTranslation). It fetches the (leaf, non-deleted) todo list from the
 * injected DataService for the picker — the same "hosts may call getDataService"
 * allowance TrashScreen uses (§6.4).
 *
 * Layout (isWide = min-width 768px):
 *  - Desktop → three cards (timer / todo / ambient) stacked. ALL the section
 *    chrome belongs to the shell (Layout Standard v2 adoption, #590): the
 *    standard <SectionHeader> in AppShell's header slot carries the title
 *    (section.work) + divider + rightSidebar toggle, and MainScreen's
 *    PageContainer (width="wide" — one column for every section since
 *    #305/#210) owns the measure, gutter and scroll. So this view renders NO
 *    in-body title row and keeps only its own card rhythm — gap-6, the stack
 *    rhythm Settings / Trash already use. The settings + presets editor is
 *    pushed into the shell rightSidebar via RightSidebarPortal (dimmed while
 *    the timer runs), which under v2 §4 opens BELOW the header's divider.
 *  - Mobile  → the header slot is wide-only, so below 768px there is no title
 *    row at all (v2 non-goal: mobile unchanged): a single fullscreen timer
 *    face; the todo chip opens a BottomSheet picker; the settings editor is
 *    reached through the shell's left drawer (the same portal), opened from
 *    MainScreen's hamburger row. The ambient mixer is Desktop-only.
 *
 * A WORK-session completion (completedSessions increments) opens the
 * SessionCompletionModal.
 */

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
  const [todos, setTodos] = useState<TodoOption[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
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
    // todosLoading starts true (useState) so the initial fetch shows the
    // skeleton; the async .finally clears it. We avoid a synchronous
    // setState(true) here (react-hooks/set-state-in-effect) — a re-fetch on
    // ds change simply keeps the (still-valid) list visible until it resolves.
    let cancelled = false;
    void ds
      .fetchTodoTree()
      .then((nodes) => {
        if (cancelled) return;
        const options = nodes
          .filter((n) => n.type === "task" && !n.isDeleted)
          .map((n) => ({ id: n.id, title: n.title || t("common.untitled") }));
        setTodos(options);
      })
      .catch(() => {
        if (!cancelled) setTodos([]);
      })
      .finally(() => {
        if (!cancelled) setTodosLoading(false);
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

  const handleSelectTodo = useCallback(
    (todo: TodoOption | null) => {
      timer.setActiveTodo(todo);
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
  const completionBody = timer.activeTodo
    ? t("work.completion.body", {
        minutes: timer.workDurationMinutes,
        todo: timer.activeTodo.title,
        breakMinutes,
      })
    : t("work.completion.bodyNoTodo", {
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

  const timerFace = (variant: "card" | "fullscreen", todoSlot?: ReactNode) => (
    <PomodoroTimer
      variant={variant}
      phase={timer.phase}
      isRunning={timer.isRunning}
      formatted={timer.formatted}
      totalFormatted={totalFormatted}
      progress={timer.progress}
      sessions={sessions}
      labels={timerLabels}
      todoSlot={todoSlot}
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
          emptyValueConfirm: t("common.ok"),
          save: t("work.settings.save"),
          saved: t("work.settings.saved"),
          unsaved: t("work.settings.unsaved"),
        }}
        formatEmptyValueMessage={(field) => t("pomodoro.emptyValue", { field })}
        // #714: one patch per press of the panel's save button — the five
        // per-field setters it replaced wrote (and synced) five times.
        onSaveSettings={timer.saveSettings}
        onAutoStartBreaksChange={timer.setAutoStartBreaks}
        onApplyPreset={(p) =>
          timer.applyPreset(
            timer.presets.find((x) => x.id === p.id) ?? { ...p, createdAt: "" },
          )
        }
        onCreatePreset={(name, values) => void timer.createPreset(name, values)}
        onDeletePreset={(id) => void timer.deletePreset(id)}
      />
    </div>
  );

  // Mobile todo slot: the chip (selected) or a "choose a todo" button that
  // opens the BottomSheet picker.
  const mobileTodoSlot = timer.activeTodo ? (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lumen-md bg-lumen-chip-task-bg py-2 pl-3.5 pr-2.5 text-sm font-medium text-lumen-chip-task-fg">
      <span className="truncate">{timer.activeTodo.title}</span>
      <button
        type="button"
        aria-label={t("work.todoSelector.clear")}
        onClick={() => handleSelectTodo(null)}
        className="inline-flex shrink-0 items-center justify-center rounded p-0.5 hover:opacity-70"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setSheetOpen(true)}
      className="inline-flex items-center gap-2 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-3.5 py-2 text-sm font-medium text-lumen-text-secondary hover:bg-lumen-hover"
    >
      {t("work.todoSelector.select")}
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
        {timerFace("fullscreen", mobileTodoSlot)}
        <RightSidebarPortal>{settingsPanel}</RightSidebarPortal>
        <PomodoroTodoSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          todos={todos}
          selectedId={timer.activeTodo?.id ?? null}
          labels={{
            title: t("work.todoSelector.select"),
            close: t("common.close"),
            clearSelection: t("work.todoSelector.clearSelection"),
            emptyHint: t("work.todoSelector.emptyHint"),
          }}
          onSelect={handleSelectTodo}
        />
        {completionModal}
      </div>
    );
  }

  return (
    // gap-6 = the card-stack rhythm of the sections that adopted v2 before this
    // one (Settings / Trash). The vertical space above the first card is the
    // PageContainer's alone — this stack adds no top padding of its own, so the
    // new header row cannot double up with it.
    <div className="flex flex-col gap-6">
      {timerFace("card")}
      <PomodoroTodoSelector
        todos={todos}
        selectedId={timer.activeTodo?.id ?? null}
        loading={todosLoading}
        labels={{
          heading: t("work.todoSelector.heading"),
          placeholder: t("work.todoSelector.placeholder"),
          clear: t("work.todoSelector.clear"),
          emptyHint: t("work.todoSelector.emptyHint"),
          menuLabel: t("work.todoSelector.heading"),
        }}
        onSelect={handleSelectTodo}
      />
      {/*
       * Ambient mixer (W3-C). Desktop/web-only per mobile-scope.md #11 (#320):
       * on the native shells the UI is skipped here while the AudioProvider
       * stays mounted, so the Pomodoro completion chime keeps ringing
       * (mobile-scope.md #10 — the timer is Mobile-Full). The `audio` null
       * guard stays as the coding-principles §4 contract for any host that
       * does omit the Provider.
       */}
      {audio && !isNativeMobile() && (
        <AudioMixer
          sounds={mixerSounds}
          settings={audio.settings}
          labels={{
            heading: t("audioMixer.heading"),
            toggle: t("audioMixer.toggle"),
            volume: t("audioMixer.volume"),
            // Same three keys the settings panel uses — one wording for the
            // one save affordance this section has (#714).
            save: t("work.settings.save"),
            saved: t("work.settings.saved"),
            unsaved: t("work.settings.unsaved"),
          }}
          onToggle={audio.toggleEnabled}
          // Audible per drag; only the write waits for the button (#714).
          onVolumeChange={audio.setVolume}
          dirty={audio.volumeDirty}
          onSave={audio.saveVolumes}
        />
      )}
      <RightSidebarPortal>{settingsPanel}</RightSidebarPortal>
      {completionModal}
    </div>
  );
}
