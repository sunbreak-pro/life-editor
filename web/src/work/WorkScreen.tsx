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
  useDomainLoad,
  useSyncDomains,
  SOUND_PRESETS,
  cn,
  formatDateKey,
  todayCalendarKey,
  workTargetChipClass,
  workTargetIcon,
  type DataService,
  type ScheduleItem,
  type TodoNode,
  type WorkTargetOption,
  type TimerPhase,
  type AudioMixerSound,
  WIDE_QUERY,
} from "@life-editor/shared";
import { X, ChevronDown } from "lucide-react";

/*
 * Web Work tab host (target-IA import). Mounts inside the TimerProvider (wired
 * in MainScreen) and reads useTimerContext, then feeds the pure shared Pomodoro
 * primitives with t()-resolved copy (§6.4 — primitives never call
 * useTranslation). It fetches the picker's candidates from the injected
 * DataService — the same "hosts may call getDataService" allowance TrashScreen
 * uses (§6.4).
 *
 * The candidates are todos AND the events of the coming week (#1375): a session
 * can be measured against either since 0029. The event side is WINDOWED rather
 * than "every live event" on purpose — the picker answers "what am I working on
 * right now", and a list carrying every calendar entry the account has ever
 * held would bury today's three. Seven days forward covers working ahead
 * without turning the dropdown into an archive.
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

/**
 * How far ahead the picker offers events (#1375). A week: far enough to start
 * on something scheduled for tomorrow, short enough that the dropdown still
 * reads as "what is coming up" rather than as the whole calendar.
 */
const EVENT_WINDOW_DAYS = 7;

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
  const [todoNodes, setTodoNodes] = useState<TodoNode[]>([]);
  const [eventItems, setEventItems] = useState<ScheduleItem[]>([]);
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

  // The pick list is todos AND events, so it follows both counters — without
  // this a task (or an event) created in another section never appeared here
  // until the screen was remounted (rules/frontend.md §Sync: declare every
  // domain the effect reads, and over-declare rather than under-declare).
  const syncVersion = useSyncDomains("todos", "schedule");

  // The event window, resolved once per render pass rather than inside the
  // load: `useDomainLoad` restarts on any `anchor` change, and a key computed
  // from `new Date()` inside the fetch would be invisible to it — the list
  // would keep yesterday's window until something else bumped the version.
  const eventWindow = useMemo(() => {
    const startKey = todayCalendarKey();
    const end = new Date();
    end.setDate(end.getDate() + EVENT_WINDOW_DAYS);
    return { startKey, endKey: formatDateKey(end) };
  }, []);

  // #1157: the read used to start from an empty list on every mount, so the
  // selector showed its loading state each time Work was opened. It runs
  // through `useDomainLoad` under `workTargetOptions` now — its OWN slot, not
  // `todoTree`: that one holds the `[active, deleted]` tuple useTodoTreeAPI
  // stores, and a bare array written there would break that hook's replay.
  //
  // `load` returns the RAW nodes and the labelling happens in the memo below.
  // Folding `t` into the fetch made `t` a dependency of the load, and an
  // unstable `t` (a test mock returning a fresh function each render) turned
  // that into an endless refetch — the trap that timed the #1038 harness out
  // at 20 s.
  const { isLoading: todosLoading } = useDomainLoad<
    [TodoNode[], ScheduleItem[]]
  >({
    domain: "Work target options",
    dataService: ds,
    version: syncVersion,
    anchor: eventWindow.startKey,
    snapshotKey: "workTargetOptions",
    // Editing a todo while the timer runs must not blank the picker.
    refetchReportsLoading: false,
    load: (service) =>
      Promise.all([
        service.fetchTodoTree(),
        service.fetchScheduleItemsByDateRange(
          eventWindow.startKey,
          eventWindow.endKey,
        ),
      ]),
    // One load, not two: two `useDomainLoad`s would each own a loading flag,
    // and the picker would flip out of its skeleton the moment the FASTER one
    // landed — showing a list that is still missing half its rows.
    apply: ([nodes, events]) => {
      setTodoNodes(nodes);
      setEventItems(events);
    },
    fallbackMessage: "Failed to load work targets",
  });

  const options = useMemo<WorkTargetOption[]>(
    () => [
      ...todoNodes
        .filter((n) => n.type === "task" && !n.isDeleted)
        .map((n) => ({
          id: n.id,
          title: n.title || t("common.untitled"),
          kind: "todo" as const,
        })),
      // Todos first, then events in calendar order. A routine occurrence is an
      // ordinary event here — it has its own row and its own id, so the time
      // lands on the day that was actually worked rather than on the series.
      ...eventItems
        .filter((e) => !e.isDeleted && !e.isDismissed)
        .slice()
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.startTime.localeCompare(b.startTime),
        )
        .map((e) => ({
          id: e.id,
          title: e.title || t("common.untitled"),
          kind: "event" as const,
        })),
    ],
    [todoNodes, eventItems, t],
  );

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

  const handleSelectTarget = useCallback(
    (item: WorkTargetOption | null) => {
      timer.setActiveItem(item);
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
  const completionBody = timer.activeItem
    ? t("work.completion.body", {
        minutes: timer.workDurationMinutes,
        todo: timer.activeItem.title,
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
  const mobileTodoSlot = timer.activeItem ? (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-lumen-md py-2 pl-3.5 pr-2.5 text-sm font-medium",
        workTargetChipClass(timer.activeItem.kind),
      )}
    >
      <span className="shrink-0">{workTargetIcon(timer.activeItem.kind, 15)}</span>
      <span className="truncate">{timer.activeItem.title}</span>
      <button
        type="button"
        aria-label={t("work.todoSelector.clear")}
        onClick={() => handleSelectTarget(null)}
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
          items={options}
          selectedId={timer.activeItem?.id ?? null}
          labels={{
            title: t("work.todoSelector.select"),
            close: t("common.close"),
            clearSelection: t("work.todoSelector.clearSelection"),
            emptyHint: t("work.todoSelector.emptyHint"),
          }}
          onSelect={handleSelectTarget}
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
        items={options}
        selectedId={timer.activeItem?.id ?? null}
        loading={todosLoading}
        labels={{
          heading: t("work.todoSelector.heading"),
          placeholder: t("work.todoSelector.placeholder"),
          clear: t("work.todoSelector.clear"),
          emptyHint: t("work.todoSelector.emptyHint"),
          menuLabel: t("work.todoSelector.heading"),
        }}
        onSelect={handleSelectTarget}
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
