import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PomodoroTimer,
  PomodoroTaskSelector,
  PomodoroSettings,
  AudioMixer,
  useTimerContext,
  useAudioContext,
  useTranslation,
  SOUND_PRESETS,
  type DataService,
  type TaskOption,
  type TimerPhase,
  type AudioMixerSound,
} from "@life-editor/shared";

/*
 * Web Work tab host (W3-B). Mounts inside the TimerProvider (wired in
 * MainScreen) and reads useTimerContext, then feeds the pure shared Pomodoro
 * primitives with t()-resolved copy (§6.4 — primitives never call
 * useTranslation). It also fetches the (leaf, non-deleted) task list directly
 * from the injected DataService for the TaskSelector — the same "hosts may
 * call getDataService" allowance the TrashScreen uses (§6.4).
 *
 * Work tab surface (section-unification 確定): Pomodoro timer + TaskSelector +
 * settings/preset editor only. History / Music / FREE are intentionally
 * dropped.
 */

export function WorkScreen({ dataService: ds }: { dataService: DataService }) {
  const { t } = useTranslation();
  const timer = useTimerContext();
  // Optional (Mobile 省略 Provider) — null when no AudioProvider mounted.
  const audio = useAudioContext();
  const [tasks, setTasks] = useState<TaskOption[]>([]);

  // Resolve the 5 preset labels via t() (primitive never calls useTranslation
  // — §6.4 i18n props injection). Icons come from the preset definitions.
  const mixerSounds = useMemo<AudioMixerSound[]>(
    () =>
      SOUND_PRESETS.map((p) => ({
        id: p.id,
        label: t(p.labelKey),
        icon: p.icon,
      })),
    [t],
  );

  // Load candidate tasks (leaf, not deleted) for the selector. Re-fetch is
  // left to navigation / Sync — the list is a convenience picker, not live
  // critical state.
  useEffect(() => {
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

  const handleSelectTask = useCallback(
    (task: TaskOption | null) => {
      timer.setActiveTask(task);
    },
    [timer],
  );

  // Skip = ADVANCE without finishing: end the current phase early and move on.
  // Implemented via setPhase to the WORK phase when in a break, or reset+pause
  // otherwise. We expose it as "reset then move to next" through the context's
  // setPhase — simplest correct behaviour: jump straight to the opposite phase.
  const handleSkip = useCallback(() => {
    timer.setPhase(timer.phase === "WORK" ? "BREAK" : "WORK");
  }, [timer]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <PomodoroTimer
          phase={timer.phase}
          isRunning={timer.isRunning}
          formatted={timer.formatted}
          progress={timer.progress}
          labels={{
            phase: phaseLabels,
            start: t("work.controls.start"),
            pause: t("work.controls.pause"),
            reset: t("work.controls.reset"),
            skip: t("work.controls.skip"),
            sessionsProgress,
          }}
          onStart={timer.start}
          onPause={timer.pause}
          onReset={timer.reset}
          onSkip={handleSkip}
        />
        <PomodoroTaskSelector
          tasks={tasks}
          selectedId={timer.activeTask?.id ?? null}
          labels={{
            heading: t("work.taskSelector.heading"),
            placeholder: t("work.taskSelector.placeholder"),
            none: t("work.taskSelector.none"),
            clear: t("work.taskSelector.clear"),
          }}
          onSelect={handleSelectTask}
        />
        {/*
         * Ambient mixer (W3-C). Only rendered when the AudioProvider is
         * mounted (web/desktop) — Mobile omits the Provider, so audio is null
         * and the mixer is skipped (CLAUDE.md §2 + vision §4 null-guard).
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
      </div>

      <PomodoroSettings
        workDurationMinutes={timer.workDurationMinutes}
        breakDurationMinutes={timer.breakDurationMinutes}
        longBreakDurationMinutes={timer.longBreakDurationMinutes}
        sessionsBeforeLongBreak={timer.sessionsBeforeLongBreak}
        autoStartBreaks={timer.autoStartBreaks}
        targetSessions={timer.targetSessions}
        presets={timer.presets}
        labels={{
          workDuration: t("pomodoro.workDuration"),
          breakDuration: t("pomodoro.breakDuration"),
          longBreakDuration: t("pomodoro.longBreakDuration"),
          sessionsPerSet: t("pomodoro.sessionsPerSet"),
          autoStartBreaks: t("pomodoro.autoStartBreaks"),
          targetSessions: t("work.sidebar.targetSessions"),
          minutesUnit: t("work.settings.minutesUnit"),
          presets: t("pomodoro.presets"),
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
          // The settings primitive emits a PomodoroPresetOption (no createdAt);
          // applyPreset reads only the four duration fields. Find the full
          // preset by id to satisfy the PomodoroPreset shape.
          timer.applyPreset(
            timer.presets.find((x) => x.id === p.id) ?? {
              ...p,
              createdAt: "",
            },
          )
        }
        onCreatePreset={(name) => void timer.createPresetFromCurrent(name)}
        onDeletePreset={(id) => void timer.deletePreset(id)}
      />
    </div>
  );
}
